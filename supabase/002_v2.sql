-- Agendo v2: link bonito, contacto, pagos, tasa Bs, tiempo muerto, liberación de pendientes, horario/ausencias por empleado
alter table negocios
  add column if not exists slug text,
  add column if not exists logo_texto text,
  add column if not exists whatsapp text,
  add column if not exists instagram text,
  add column if not exists direccion text,
  add column if not exists buffer_minutos integer not null default 0,
  add column if not exists liberar_horas integer not null default 2,
  add column if not exists tasa_bs numeric(14,2),
  add column if not exists metodos_pago jsonb not null default '[]';

update negocios set slug = trim(both '-' from regexp_replace(lower(translate(nombre, 'áéíóúüñÁÉÍÓÚÜÑ', 'aeiouunaeiouun')), '[^a-z0-9]+', '-', 'g')) || '-' || left(id::text, 4)
  where slug is null;
alter table negocios alter column slug set not null;
create unique index if not exists negocios_slug on negocios (slug);
alter table negocios drop constraint if exists negocios_slug_formato;
alter table negocios add constraint negocios_slug_formato check (
  slug ~ '^[a-z0-9]([a-z0-9-]{1,38})[a-z0-9]$'
  and slug not in ('app','login','registro','dashboard','booking','privacidad','assets','api','admin','index','sw','manifest','logo','icon','config')
);
alter table negocios drop constraint if exists negocios_buffer_rango;
alter table negocios add constraint negocios_buffer_rango check (buffer_minutos between 0 and 240 and liberar_horas between 0 and 168);

alter table empleados
  add column if not exists hora_apertura time,
  add column if not exists hora_cierre time,
  add column if not exists dias_laborales smallint[];

create table if not exists ausencias (
  id uuid default uuid_generate_v4() primary key,
  empleado_id uuid not null references empleados(id) on delete cascade,
  desde date not null,
  hasta date not null,
  motivo text,
  check (hasta >= desde)
);
alter table ausencias enable row level security;
drop policy if exists ausencias_dueno on ausencias;
create policy ausencias_dueno on ausencias for all to authenticated
  using (exists (select 1 from empleados e join negocios n on n.id = e.negocio_id where e.id = empleado_id and n.owner_id = auth.uid()))
  with check (exists (select 1 from empleados e join negocios n on n.id = e.negocio_id where e.id = empleado_id and n.owner_id = auth.uid()));
grant all on ausencias to authenticated;

alter table citas drop constraint if exists citas_sin_choque;
alter table citas drop column if exists rango;
alter table citas
  add column if not exists buffer_minutos integer not null default 0,
  add column if not exists precio numeric(10,2);
alter table citas add column rango tsrange generated always as
  (tsrange(fecha_hora, fecha_hora + make_interval(mins => duracion_minutos + buffer_minutos), '[)')) stored;
alter table citas drop constraint if exists citas_estatus_check;
alter table citas add constraint citas_estatus_check check (estatus in ('pendiente_pago','confirmado','terminado','cancelado','expirado'));
alter table citas add constraint citas_sin_choque exclude using gist (empleado_id with =, rango with &&)
  where (estatus not in ('cancelado','expirado'));

create or replace function citas_validar() returns trigger language plpgsql security definer set search_path = public as $$
declare n negocios; s servicios; e empleados; es_dueno boolean; ini int; fin int; ap time; ci time; dias smallint[];
begin
  select * into n from negocios where id = new.negocio_id;
  select * into s from servicios where id = new.servicio_id and negocio_id = new.negocio_id;
  select * into e from empleados where id = new.empleado_id and negocio_id = new.negocio_id;
  if s.id is null then raise exception 'Servicio inválido'; end if;
  if e.id is null then raise exception 'Empleado inválido'; end if;
  es_dueno := n.owner_id = auth.uid();
  if tg_op = 'INSERT' then
    new.duracion_minutos := s.duracion_minutos;
    new.buffer_minutos := n.buffer_minutos;
    new.precio := s.precio;
    if not es_dueno then new.estatus := 'pendiente_pago'; new.notas_crm := null; end if;
  elsif new.servicio_id is distinct from old.servicio_id then
    new.duracion_minutos := s.duracion_minutos;
    new.precio := s.precio;
  end if;
  if new.estatus in ('pendiente_pago','confirmado') then
    if new.fecha_hora < now() at time zone 'America/Caracas' then raise exception 'La hora ya pasó'; end if;
    ap := coalesce(e.hora_apertura, n.hora_apertura);
    ci := coalesce(e.hora_cierre, n.hora_cierre);
    dias := coalesce(e.dias_laborales, n.dias_laborales);
    ini := extract(hour from new.fecha_hora) * 60 + extract(minute from new.fecha_hora);
    fin := ini + new.duracion_minutos;
    if not (extract(dow from new.fecha_hora)::smallint = any (dias)) then raise exception 'Ese día no se trabaja'; end if;
    if ini < extract(hour from ap) * 60 + extract(minute from ap) or fin > extract(hour from ci) * 60 + extract(minute from ci) then
      raise exception 'Fuera del horario de trabajo';
    end if;
    if exists (select 1 from ausencias a where a.empleado_id = new.empleado_id and new.fecha_hora::date between a.desde and a.hasta) then
      raise exception 'Ese día no está disponible';
    end if;
  end if;
  update citas c set estatus = 'expirado'
    from negocios nn
    where c.empleado_id = new.empleado_id and c.estatus = 'pendiente_pago' and nn.id = c.negocio_id
      and nn.liberar_horas > 0 and c.creado_en < now() - make_interval(hours => nn.liberar_horas)
      and c.id is distinct from new.id;
  return new;
end $$;
drop trigger if exists citas_validar on citas;
create trigger citas_validar before insert or update of fecha_hora, empleado_id, servicio_id on citas
  for each row execute function citas_validar();

create or replace function horarios_ocupados(p_empleado uuid, p_fecha date)
returns table (inicio timestamp, fin timestamp) language sql stable security definer set search_path = public as $$
  select lower(c.rango), upper(c.rango) from citas c join negocios n on n.id = c.negocio_id
  where c.empleado_id = p_empleado and c.estatus not in ('cancelado','expirado')
    and not (c.estatus = 'pendiente_pago' and n.liberar_horas > 0 and c.creado_en < now() - make_interval(hours => n.liberar_horas))
    and c.rango && tsrange(p_fecha::timestamp, (p_fecha + 1)::timestamp)
  union all
  select p_fecha::timestamp, (p_fecha + 1)::timestamp
  where exists (select 1 from ausencias a where a.empleado_id = p_empleado and p_fecha between a.desde and a.hasta)
$$;
grant execute on function horarios_ocupados(uuid, date) to anon, authenticated;

create or replace function liberar_vencidas(p_negocio uuid) returns integer language sql security definer set search_path = public as $$
  with u as (
    update citas c set estatus = 'expirado' from negocios n
    where n.id = c.negocio_id and n.id = p_negocio and n.owner_id = auth.uid()
      and c.estatus = 'pendiente_pago' and n.liberar_horas > 0 and c.creado_en < now() - make_interval(hours => n.liberar_horas)
    returning 1)
  select count(*)::int from u
$$;
revoke execute on function liberar_vencidas(uuid) from public, anon;
grant execute on function liberar_vencidas(uuid) to authenticated;

update negocios set slug = 'barberia-demo', logo_texto = 'BD', direccion = 'Caracas',
  metodos_pago = '[{"tipo":"Pago móvil","datos":"Banesco · 0414-0000000 · V-00000000"},{"tipo":"Zelle","datos":"demo@correo.com"}]', tasa_bs = 40, buffer_minutos = 10
  where id = '5274b6a8-0b30-48c4-a76c-f4345a03ef44';
