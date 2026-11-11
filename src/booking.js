import { supabase, $, $$, esc, toast, aplicarMarca, hoyISO, sumarDias, DIAS, MESES, dinero, bs, hora12, horarioDe, slotsLibres, waLink, insigniaNegocio, piePagina, metodosDe, esEfectivo, fechaLarga } from './lib.js';

const CLIENTE_KEY = 'agendo_cliente';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const clave = new URLSearchParams(location.search).get('n') || location.pathname.replace(/^\/|\.html$|\/$/g, '');
const estado = { paso: 1, servicio: null, empleado: null, fecha: null, hora: null };
let negocio, servicios, empleados;

document.body.append(piePagina());

function fallar(msg) {
  $('#negNombre').textContent = msg;
  $('#negInfo').innerHTML = '<a href="/" class="text-brand">Crea tu propia página de reservas con Agendo</a>';
  $$('[data-paso],#pasos,#barra').forEach((s) => s.remove());
}

async function iniciar() {
  if (!clave || clave === 'booking') return fallar('Link de reservas inválido');
  const campos = 'id,nombre,categoria,color_marca,hora_apertura,hora_cierre,intervalo_minutos,dias_laborales,slug,logo_texto,logo_url,whatsapp,instagram,direccion,buffer_minutos,tasa_bs,metodos_pago';
  const { data: n } = await supabase.from('negocios').select(campos).eq(UUID.test(clave) ? 'id' : 'slug', clave).maybeSingle();
  if (!n) return fallar('Este negocio no existe');
  negocio = n;
  aplicarMarca(n.color_marca);
  document.title = `Reservar · ${n.nombre}`;
  $('#cabecera').firstElementChild.outerHTML = insigniaNegocio(n, 'h-14 w-14 text-xl');
  $('#negNombre').textContent = n.nombre;
  $('#negInfo').textContent = [n.categoria, n.direccion].filter(Boolean).join(' · ');
  $('#contactos').innerHTML = [
    n.whatsapp && `<a href="${waLink(n.whatsapp)}" target="_blank" class="chip">WhatsApp</a>`,
    n.instagram && `<a href="https://instagram.com/${esc(n.instagram)}" target="_blank" class="chip">@${esc(n.instagram)}</a>`,
  ].filter(Boolean).join('');

  const [s, e] = await Promise.all([
    supabase.from('servicios').select('*').eq('negocio_id', n.id).order('precio'),
    supabase.from('empleados').select('*').eq('negocio_id', n.id).order('nombre'),
  ]);
  servicios = s.data ?? [];
  empleados = e.data ?? [];
  if (!servicios.length || !empleados.length) return fallar(`${n.nombre} aún no tiene horarios disponibles`);

  $('#listaServicios').innerHTML = servicios.map((x) => `
    <button data-srv="${x.id}" class="opcion flex w-full items-center justify-between gap-3 p-4 text-left">
      <span><b class="block">${esc(x.nombre)}</b><span class="text-sm text-zinc-400">${x.duracion_minutos} min</span></span>
      <span class="text-right"><b class="block font-display text-lg text-brand">${dinero(x.precio)}</b><span class="text-xs text-zinc-500">${bs(x.precio, n.tasa_bs)}</span></span>
    </button>`).join('');
  $('#listaEmpleados').innerHTML = empleados.map((x) => `
    <button data-emp="${x.id}" class="opcion flex w-24 shrink-0 flex-col items-center gap-2 p-3">
      <span class="grid h-12 w-12 place-items-center rounded-full bg-brand/15 text-lg font-bold text-brand">${esc(x.nombre[0]?.toUpperCase())}</span>
      <span class="w-full truncate text-center text-sm font-medium">${esc(x.nombre)}</span>
    </button>`).join('');
  if (empleados.length === 1) {
    estado.empleado = empleados[0];
    $('#bloqueEmpleados').classList.add('hidden');
    $('#unico').classList.remove('hidden');
    $('#unico').innerHTML = `Te atiende <b>${esc(empleados[0].nombre)}</b>`;
  }
  $('#opcionesPago').innerHTML = metodosDe(n).map((m) => `<label><input type="radio" name="metodo_pago" value="${esc(m)}" class="peer sr-only"><span class="chip block">${esc(m)}</span></label>`).join('');
  $('#opcionesPago').onchange = (e) => {
    const datos = (n.metodos_pago || []).filter((m) => m.tipo === e.target.value && m.datos);
    $('#datosPago').classList.toggle('hidden', !datos.length);
    $('#datosPago').innerHTML = datos.map((m) => `
    <div class="flex items-center gap-3 rounded-2xl bg-zinc-800 p-3 ring-1 ring-zinc-700">
      <div class="min-w-0 flex-1"><p class="text-xs font-semibold uppercase tracking-wide text-brand">${esc(m.tipo)}</p><p class="break-words text-sm">${esc(m.datos)}</p></div>
      <button type="button" data-copiar="${esc(m.datos)}" class="btn-ghost btn-sm shrink-0">Copiar</button>
    </div>`).join('');
  };

  const guardado = JSON.parse(localStorage.getItem(CLIENTE_KEY) || 'null');
  if (guardado) {
    $('#formCita').cliente_nombre.value = guardado.nombre || '';
    $('#formCita').cliente_whatsapp.value = guardado.whatsapp || '';
    $('#recordar').checked = true;
  }
  $('#barra').classList.remove('hidden');
  irA(1);
}

function pintarDias() {
  const h = horarioDe(negocio, estado.empleado);
  const dias = [];
  for (let k = 0, f = hoyISO(); dias.length < 14 && k < 60; k++, f = sumarDias(f, 1)) {
    if (h.dias.includes(new Date(f + 'T12:00:00').getDay())) dias.push(f);
  }
  if (!dias.includes(estado.fecha)) estado.fecha = null;
  $('#listaDias').innerHTML = dias.map((f) => {
    const d = new Date(f + 'T12:00:00');
    return `<button data-dia="${f}" class="opcion ${f === estado.fecha ? 'on' : ''} flex w-16 shrink-0 flex-col items-center py-2.5">
      <span class="text-xs text-zinc-400">${f === hoyISO() ? 'Hoy' : DIAS[d.getDay()]}</span><b class="font-display text-xl">${d.getDate()}</b><span class="text-xs text-zinc-400">${MESES[d.getMonth()]}</span></button>`;
  }).join('');
}

function marcar(cont, attr, valor) {
  $$('.opcion', cont).forEach((b) => b.classList.toggle('on', b.getAttribute(attr) === valor));
}

async function cargarSlots() {
  estado.hora = null;
  actualizarBoton();
  const box = $('#listaSlots');
  if (!estado.empleado || !estado.fecha) { box.innerHTML = `<p class="col-span-3 text-sm text-zinc-500">Elige ${estado.empleado ? 'un día' : 'con quién y qué día'}.</p>`; return; }
  box.innerHTML = '<p class="col-span-3 text-sm text-zinc-500">Buscando horarios…</p>';
  try {
    const libres = await slotsLibres({ negocio, empleado: estado.empleado, servicio: estado.servicio, fecha: estado.fecha });
    box.innerHTML = libres.map((h) => `<button data-hora="${h}" aria-pressed="false" class="slot rounded-2xl border border-zinc-700 bg-zinc-900 py-3 font-semibold">${hora12(h)}</button>`).join('')
      || '<p class="col-span-3 rounded-2xl bg-zinc-800 p-4 text-sm text-zinc-400 ring-1 ring-zinc-700">No quedan horarios este día. Prueba otro día u otra persona.</p>';
  } catch (e) { box.innerHTML = ''; toast(e.message, 'error'); }
}

function actualizarBoton() {
  const ok = { 1: !!estado.servicio, 2: !!estado.hora, 3: true }[estado.paso];
  $('#siguiente').disabled = !ok;
  $('#siguiente').textContent = estado.paso === 3 ? `Confirmar reserva · ${dinero(estado.servicio?.precio)}` : 'Continuar';
  $('#atras').classList.toggle('hidden', estado.paso === 1);
}

function irA(p) {
  estado.paso = p;
  $$('[data-paso]').forEach((s) => s.classList.toggle('hidden', Number(s.dataset.paso) !== p));
  $$('#pasos li').forEach((li) => { li.className = `rounded-full py-2 ${Number(li.dataset.p) <= p ? 'bg-brand text-white' : 'bg-zinc-800 text-zinc-500'}`; });
  if (p !== 2) $('#avisoChoque').classList.add('hidden');
  if (p === 3) {
    const s = estado.servicio;
    $('#resumen').innerHTML = `<p class="text-sm text-zinc-400">${fechaLarga(estado.fecha)} · ${hora12(estado.hora)} · ${s.duracion_minutos} min</p>
      <p class="mt-1 font-bold">${esc(s.nombre)} con ${esc(estado.empleado.nombre)}</p>
      <p class="mt-2 font-display text-2xl font-extrabold text-brand">${dinero(s.precio)} <span class="text-sm font-medium text-zinc-400">${bs(s.precio, negocio.tasa_bs)}</span></p>`;
  }
  actualizarBoton();
  scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('click', async (e) => {
  const t = e.target;
  const srv = t.closest('[data-srv]');
  const emp = t.closest('[data-emp]');
  const dia = t.closest('[data-dia]');
  const hora = t.closest('[data-hora]');
  const copiar = t.closest('[data-copiar]');
  if (srv) { estado.servicio = servicios.find((x) => x.id === srv.dataset.srv); marcar($('#listaServicios'), 'data-srv', srv.dataset.srv); actualizarBoton(); }
  if (emp) { estado.empleado = empleados.find((x) => x.id === emp.dataset.emp); marcar($('#listaEmpleados'), 'data-emp', emp.dataset.emp); pintarDias(); cargarSlots(); }
  if (dia) { estado.fecha = dia.dataset.dia; marcar($('#listaDias'), 'data-dia', dia.dataset.dia); cargarSlots(); }
  if (hora) {
    estado.hora = hora.dataset.hora;
    $$('.slot').forEach((b) => b.setAttribute('aria-pressed', String(b === hora)));
    actualizarBoton();
  }
  if (copiar) { await navigator.clipboard.writeText(copiar.dataset.copiar); toast('Copiado'); }
});

$('#atras').onclick = () => irA(estado.paso - 1);
$('#siguiente').onclick = async () => {
  if (estado.paso === 1) { irA(2); pintarDias(); return cargarSlots(); }
  if (estado.paso === 2) return irA(3);
  const form = $('#formCita');
  const vacio = [...form.elements].find((el) => el.required && !el.value.trim());
  if (vacio) { vacio.focus(); return toast('Completa tu nombre y WhatsApp', 'error'); }
  if (!form.metodo_pago.value) return toast('Elige cómo vas a pagar', 'error');
  const f = Object.fromEntries(new FormData(form));
  Object.keys(f).forEach((k) => { f[k] = f[k].trim() || null; });
  $('#siguiente').disabled = true;
  const { error } = await supabase.from('citas').insert({ ...f, negocio_id: negocio.id, empleado_id: estado.empleado.id, servicio_id: estado.servicio.id, fecha_hora: `${estado.fecha}T${estado.hora}:00` });
  $('#siguiente').disabled = false;
  if (error) {
    if (error.code === '23P01') {
      toast('Ese horario se acaba de ocupar. Elige otro.', 'error');
      irA(2);
      $('#avisoChoque').classList.remove('hidden');
      return cargarSlots();
    }
    return toast(error.message, 'error');
  }
  if ($('#recordar').checked) localStorage.setItem(CLIENTE_KEY, JSON.stringify({ nombre: f.cliente_nombre, whatsapp: f.cliente_whatsapp }));
  else localStorage.removeItem(CLIENTE_KEY);
  $$('[data-paso],#pasos,#barra,#contactos').forEach((s) => s.classList.add('hidden'));
  $('#exito').classList.remove('hidden');
  const s = estado.servicio;
  const cuando = `${fechaLarga(estado.fecha)} a las ${hora12(estado.hora)}`;
  $('#exitoTxt').textContent = `${s.nombre} con ${estado.empleado.nombre}, ${cuando}. Pago: ${f.metodo_pago}.${esEfectivo(f.metodo_pago) ? ' Pagas al llegar.' : ''}`;
  if (negocio.whatsapp) {
    const msg = `Hola ${negocio.nombre}, acabo de reservar:\n• ${s.nombre} con ${estado.empleado.nombre}\n• ${cuando}\n• Monto: ${dinero(s.precio)}${negocio.tasa_bs ? ' (' + bs(s.precio, negocio.tasa_bs) + ')' : ''}\n• Pago: ${f.metodo_pago}\n\nA nombre de ${f.cliente_nombre}.`;
    $('#enviarWa').href = waLink(negocio.whatsapp, msg);
    $('#enviarWa').classList.remove('hidden');
  }
};

$('#otra').onclick = () => location.reload();
iniciar();
