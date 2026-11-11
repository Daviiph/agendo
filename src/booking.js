import { supabase, $, esc, toast, aplicarMarca, hoyISO, minutos, hhmm, dinero } from './lib.js';

const CLIENTE_KEY = 'agendo_cliente';
const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const negocioId = new URLSearchParams(location.search).get('n');
const estado = { paso: 1, servicio: null, empleado: null, fecha: null, hora: null };
let negocio, servicios, empleados;

const fallar = (msg) => { $('#negNombre').textContent = msg; $('#barra').remove(); document.querySelectorAll('[data-paso],#pasos').forEach((s) => s.remove()); };

async function iniciar() {
  if (!negocioId) return fallar('Link de reservas inválido');
  const [n, s, e] = await Promise.all([
    supabase.from('negocios').select('id,nombre,categoria,color_marca,hora_apertura,hora_cierre,intervalo_minutos,dias_laborales').eq('id', negocioId).maybeSingle(),
    supabase.from('servicios').select('*').eq('negocio_id', negocioId).order('nombre'),
    supabase.from('empleados').select('*').eq('negocio_id', negocioId).order('nombre'),
  ]);
  if (!n.data) return fallar('Este negocio no existe');
  negocio = n.data; servicios = s.data; empleados = e.data;
  aplicarMarca(negocio.color_marca);
  document.title = `Reservar · ${negocio.nombre}`;
  $('#negNombre').textContent = negocio.nombre;
  $('#negCategoria').textContent = negocio.categoria;
  $('#inicial').textContent = negocio.nombre[0]?.toUpperCase();
  if (!servicios.length || !empleados.length) return fallar(`${negocio.nombre} aún no tiene servicios disponibles`);

  $('#listaServicios').innerHTML = servicios.map((s) => `
    <button data-srv="${s.id}" class="opcion flex w-full items-center justify-between rounded-2xl border-2 border-transparent bg-white p-4 text-left shadow-sm ring-1 ring-slate-200">
      <span><b class="block">${esc(s.nombre)}</b><span class="text-sm text-slate-500">${s.duracion_minutos} min</span></span>
      <span class="text-lg font-extrabold text-brand">${dinero(s.precio)}</span>
    </button>`).join('');
  $('#listaEmpleados').innerHTML = empleados.map((e) => `
    <button data-emp="${e.id}" class="opcion flex w-24 shrink-0 flex-col items-center gap-2 rounded-2xl border-2 border-transparent bg-white p-3 shadow-sm ring-1 ring-slate-200">
      <span class="grid h-12 w-12 place-items-center rounded-full bg-brand/15 text-lg font-bold text-brand">${esc(e.nombre[0]?.toUpperCase())}</span>
      <span class="w-full truncate text-center text-sm font-medium">${esc(e.nombre)}</span>
    </button>`).join('');
  pintarDias();

  const guardado = JSON.parse(localStorage.getItem(CLIENTE_KEY) || '{}');
  const f = $('#formCita');
  f.cliente_nombre.value = guardado.nombre || '';
  f.cliente_whatsapp.value = guardado.whatsapp || '';
  irA(1);
}

function pintarDias() {
  const dias = [];
  for (let i = 0, d = new Date(); dias.length < 14 && i < 60; i++, d.setDate(d.getDate() + 1)) {
    if (negocio.dias_laborales.includes(d.getDay())) dias.push(new Date(d));
  }
  $('#listaDias').innerHTML = dias.map((d) => `
    <button data-dia="${hoyISO(d)}" class="opcion flex w-16 shrink-0 flex-col items-center rounded-2xl border-2 border-transparent bg-white py-2 shadow-sm ring-1 ring-slate-200">
      <span class="text-xs text-slate-500">${DIAS[d.getDay()]}</span><b class="text-xl">${d.getDate()}</b><span class="text-xs text-slate-500">${MESES[d.getMonth()]}</span>
    </button>`).join('');
}

function marcar(contenedor, attr, valor) {
  contenedor.querySelectorAll('.opcion').forEach((b) => {
    const on = b.getAttribute(attr) === valor;
    b.classList.toggle('border-brand', on);
    b.classList.toggle('border-transparent', !on);
  });
}

export function calcularSlots({ apertura, cierre, intervalo, duracion, ocupados, desdeMin = 0 }) {
  const libres = [];
  for (let ini = minutos(apertura); ini + duracion <= minutos(cierre); ini += intervalo) {
    const fin = ini + duracion;
    if (ini < desdeMin) continue;
    if (ocupados.some((o) => ini < o.fin && fin > o.ini)) continue;
    libres.push(ini);
  }
  return libres;
}

async function cargarSlots() {
  estado.hora = null;
  actualizarBoton();
  const box = $('#listaSlots');
  if (!estado.empleado || !estado.fecha) { box.innerHTML = '<p class="col-span-3 text-sm text-slate-500">Elige con quién y qué día.</p>'; return; }
  box.innerHTML = '<p class="col-span-3 text-sm text-slate-500">Buscando horarios…</p>';
  const { data, error } = await supabase.rpc('horarios_ocupados', { p_empleado: estado.empleado.id, p_fecha: estado.fecha });
  if (error) { box.innerHTML = ''; return toast(error.message, 'error'); }
  const aMin = (ts, base) => (ts.slice(0, 10) < base ? 0 : ts.slice(0, 10) > base ? 24 * 60 : minutos(ts.slice(11, 16)));
  const ocupados = data.map((o) => ({ ini: aMin(o.inicio, estado.fecha), fin: aMin(o.fin, estado.fecha) }));
  const ahora = new Date();
  const desdeMin = estado.fecha === hoyISO() ? ahora.getHours() * 60 + ahora.getMinutes() + 1 : 0;
  const libres = calcularSlots({ apertura: negocio.hora_apertura.slice(0, 5), cierre: negocio.hora_cierre.slice(0, 5), intervalo: negocio.intervalo_minutos, duracion: estado.servicio.duracion_minutos, ocupados, desdeMin });
  box.innerHTML = libres.map((m) => `<button data-hora="${hhmm(m)}" aria-pressed="false" class="slot rounded-xl border border-slate-300 bg-white py-2.5 font-semibold">${hhmm(m)}</button>`).join('')
    || '<p class="col-span-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">No quedan horarios este día. Prueba otro día u otra persona.</p>';
}

function actualizarBoton() {
  const ok = { 1: !!estado.servicio, 2: !!estado.hora, 3: true }[estado.paso];
  $('#siguiente').disabled = !ok;
  $('#siguiente').textContent = estado.paso === 3 ? 'Confirmar reserva' : 'Continuar';
  $('#atras').classList.toggle('hidden', estado.paso === 1);
}

function irA(p) {
  estado.paso = p;
  document.querySelectorAll('[data-paso]').forEach((s) => s.classList.toggle('hidden', Number(s.dataset.paso) !== p));
  document.querySelectorAll('#pasos li').forEach((li) => {
    const n = Number(li.dataset.p);
    li.className = `rounded-full py-1.5 ${n <= p ? 'bg-brand text-white' : 'bg-slate-200 text-slate-500'}`;
  });
  if (p === 3) {
    const [y, m, d] = estado.fecha.split('-').map(Number);
    const f = new Date(y, m - 1, d);
    $('#resumen').innerHTML = `<b>${esc(estado.servicio.nombre)}</b> con <b>${esc(estado.empleado.nombre)}</b><br>${DIAS[f.getDay()]} ${d} ${MESES[m - 1]} · ${estado.hora} · ${estado.servicio.duracion_minutos} min<br><span class="text-lg font-extrabold text-brand">${dinero(estado.servicio.precio)}</span>`;
  }
  actualizarBoton();
  scrollTo({ top: 0, behavior: 'smooth' });
}

document.addEventListener('click', (e) => {
  const srv = e.target.closest('[data-srv]');
  const emp = e.target.closest('[data-emp]');
  const dia = e.target.closest('[data-dia]');
  const hora = e.target.closest('[data-hora]');
  if (srv) { estado.servicio = servicios.find((s) => s.id === srv.dataset.srv); marcar($('#listaServicios'), 'data-srv', srv.dataset.srv); actualizarBoton(); }
  if (emp) { estado.empleado = empleados.find((x) => x.id === emp.dataset.emp); marcar($('#listaEmpleados'), 'data-emp', emp.dataset.emp); cargarSlots(); }
  if (dia) { estado.fecha = dia.dataset.dia; marcar($('#listaDias'), 'data-dia', dia.dataset.dia); cargarSlots(); }
  if (hora) {
    estado.hora = hora.dataset.hora;
    $('#listaSlots').querySelectorAll('.slot').forEach((b) => b.setAttribute('aria-pressed', String(b === hora)));
    actualizarBoton();
  }
});

$('#atras').onclick = () => irA(estado.paso - 1);
$('#siguiente').onclick = async () => {
  if (estado.paso === 1) {
    if (empleados.length === 1 && !estado.empleado) { estado.empleado = empleados[0]; marcar($('#listaEmpleados'), 'data-emp', empleados[0].id); }
    irA(2);
    return cargarSlots();
  }
  if (estado.paso === 2) return irA(3);
  const form = $('#formCita');
  if (!form.reportValidity()) return;
  const f = Object.fromEntries(new FormData(form));
  Object.keys(f).forEach((k) => { f[k] = f[k].trim(); });
  $('#siguiente').disabled = true;
  const { error } = await supabase.from('citas').insert({
    ...f,
    negocio_id: negocio.id,
    empleado_id: estado.empleado.id,
    servicio_id: estado.servicio.id,
    fecha_hora: `${estado.fecha}T${estado.hora}:00`,
  });
  $('#siguiente').disabled = false;
  if (error) {
    if (error.code === '23P01') { toast('Alguien acaba de tomar ese horario. Elige otro.', 'error'); irA(2); return cargarSlots(); }
    return toast(error.message, 'error');
  }
  localStorage.setItem(CLIENTE_KEY, JSON.stringify({ nombre: f.cliente_nombre, whatsapp: f.cliente_whatsapp }));
  ['referencia_pago', 'banco_origen', 'pago_titular', 'pago_cedula', 'pago_telefono'].forEach((k) => { form[k].value = ''; });
  document.querySelectorAll('[data-paso],#pasos,#barra').forEach((s) => s.classList.add('hidden'));
  $('#exito').classList.remove('hidden');
  $('#exitoTxt').textContent = `${estado.servicio.nombre} con ${estado.empleado.nombre}, el ${estado.fecha.split('-').reverse().join('/')} a las ${estado.hora}. ${negocio.nombre} verificará tu pago y te escribirá por WhatsApp.`;
};

$('#otra').onclick = () => location.reload();

iniciar();
