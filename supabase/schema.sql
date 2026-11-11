-- Agendo: esquema multi-negocio (Supabase)
create extension if not exists "uuid-ossp";
create extension if not exists btree_gist;

create table if not exists negocios (
  id uuid default uuid_generate_v4() primary key,
  owner_id uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre text not null,
  categoria text not null,
  color_marca text default '#0ea5e9',
  hora_apertura time not null default '09:00',
  hora_cierre time not null default '18:00',
  intervalo_minutos integer not null default 30 check (intervalo_minutos between 5 and 240),
  dias_laborales smallint[] not null default '{1,2,3,4,5,6}',
  creado_en timestamp default now()
);

create table if not exists empleados (
  id uuid default uuid_generate_v4() primary key,
  negocio_id uuid not null references negocios(id) on delete cascade,
  nombre text not null
);

create table if not exists servicios (
  id uuid default uuid_generate_v4() primary key,
  negocio_id uuid not null references negocios(id) on delete cascade,
  nombre text not null,
  duracion_minutos integer not null check (duracion_minutos > 0),
  precio decimal(10,2) not null check (precio >= 0)
);

create table if not exists citas (
  id uuid default uuid_generate_v4() primary key,
  negocio_id uuid not null references negocios(id) on delete cascade,
  empleado_id uuid not null references empleados(id) on delete cascade,
  servicio_id uuid references servicios(id) on delete set null,
  duracion_minutos integer not null default 30,
  cliente_nombre text not null,
  cliente_whatsapp text not null,
  fecha_hora timestamp not null,
  estatus text default 'pendiente_pago' check (estatus in ('pendiente_pago','confirmado','terminado','cancelado')),
  referencia_pago text,
  banco_origen text,
  pago_titular text,
  pago_cedula text,
  pago_telefono text,
  notas_crm text,
  creado_en timestamp default now(),
  rango tsrange generated always as (tsrange(fecha_hora, fecha_hora + make_interval(mins => duracion_minutos), '[)')) stored,
  constraint citas_sin_choque exclude using gist (empleado_id with =, rango with &&) where (estatus <> 'cancelado')
);

create index if not exists citas_negocio_fecha on citas (negocio_id, fecha_hora);
create index if not exists empleados_negocio on empleados (negocio_id);
create index if not exists servicios_negocio on servicios (negocio_id);

-- Duración y negocio validados en servidor; los clientes anónimos siempre entran como pendiente_pago
create or replace function citas_validar() returns trigger language plpgsql security definer set search_path = public as $$
declare dur integer; es_dueno boolean;
begin
  select duracion_minutos into dur from servicios where id = new.servicio_id and negocio_id = new.negocio_id;
  if dur is null then raise exception 'Servicio inválido'; end if;
  if not exists (select 1 from empleados where id = new.empleado_id and negocio_id = new.negocio_id) then
    raise exception 'Empleado inválido';
  end if;
  if new.fecha_hora < now() at time zone 'America/Caracas' then raise exception 'La hora ya pasó'; end if;
  new.duracion_minutos := dur;
  select exists (select 1 from negocios where id = new.negocio_id and owner_id = auth.uid()) into es_dueno;
  if not es_dueno then new.estatus := 'pendiente_pago'; new.notas_crm := null; end if;
  return new;
end $$;
drop trigger if exists citas_validar on citas;
create trigger citas_validar before insert on citas for each row execute function citas_validar();

-- Horarios ocupados de un empleado en un día (sin datos del cliente)
create or replace function horarios_ocupados(p_empleado uuid, p_fecha date)
returns table (inicio timestamp, fin timestamp) language sql stable security definer set search_path = public as $$
  select lower(rango), upper(rango) from citas
  where empleado_id = p_empleado and estatus <> 'cancelado'
    and rango && tsrange(p_fecha::timestamp, (p_fecha + 1)::timestamp)
$$;
grant execute on function horarios_ocupados(uuid, date) to anon, authenticated;

alter table negocios enable row level security;
alter table empleados enable row level security;
alter table servicios enable row level security;
alter table citas enable row level security;

drop policy if exists negocios_leer on negocios;
create policy negocios_leer on negocios for select using (true);
drop policy if exists negocios_dueno on negocios;
create policy negocios_dueno on negocios for all to authenticated using (owner_id = auth.uid()) with check (owner_id = auth.uid());

drop policy if exists empleados_leer on empleados;
create policy empleados_leer on empleados for select using (true);
drop policy if exists empleados_dueno on empleados;
create policy empleados_dueno on empleados for all to authenticated
  using (exists (select 1 from negocios n where n.id = negocio_id and n.owner_id = auth.uid()))
  with check (exists (select 1 from negocios n where n.id = negocio_id and n.owner_id = auth.uid()));

drop policy if exists servicios_leer on servicios;
create policy servicios_leer on servicios for select using (true);
drop policy if exists servicios_dueno on servicios;
create policy servicios_dueno on servicios for all to authenticated
  using (exists (select 1 from negocios n where n.id = negocio_id and n.owner_id = auth.uid()))
  with check (exists (select 1 from negocios n where n.id = negocio_id and n.owner_id = auth.uid()));

drop policy if exists citas_reservar on citas;
create policy citas_reservar on citas for insert to anon, authenticated with check (true);
drop policy if exists citas_dueno on citas;
create policy citas_dueno on citas for all to authenticated
  using (exists (select 1 from negocios n where n.id = negocio_id and n.owner_id = auth.uid()))
  with check (exists (select 1 from negocios n where n.id = negocio_id and n.owner_id = auth.uid()));

grant select on negocios, empleados, servicios to anon;
grant insert on citas to anon;
grant all on negocios, empleados, servicios, citas to authenticated;

do $$ begin
  alter publication supabase_realtime add table citas;
exception when duplicate_object then null; end $$;
