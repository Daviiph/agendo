import { supabase, $, esc, toast, aplicarMarca, requerirSesion, misNegocios, NEGOCIO_KEY, hoyISO, formatoHora, dinero } from './lib.js';

const ESTATUS = {
  pendiente_pago: ['Pago por verificar', 'bg-amber-100 text-amber-800'],
  confirmado: ['Confirmada', 'bg-emerald-100 text-emerald-800'],
  terminado: ['Terminada', 'bg-slate-200 text-slate-700'],
};
const user = await requerirSesion();
let negocios = [];
let negocio = null;
let citas = [];
let canal = null;
let nuevas = 0;
$('#fecha').value = hoyISO();

negocios = await misNegocios(user.id);
if (!negocios.length) location.href = '/config.html';

$('#selNegocio').innerHTML = negocios.map((n) => `<option value="${n.id}">${esc(n.nombre)}</option>`).join('');
$('#selNegocio').onchange = (e) => seleccionar(negocios.find((n) => n.id === e.target.value));
$('#fecha').onchange = cargar;
$('#verTerminadas').onchange = pintar;
$('#pdf').onclick = () => window.print();
$('#salir').onclick = async () => { await supabase.auth.signOut(); location.href = '/'; };
$('#campana').onclick = () => {
  $('#panelNotif').classList.toggle('hidden');
  nuevas = 0;
  $('#badge').classList.add('hidden');
};
document.addEventListener('click', (e) => { if (!e.target.closest('#campana, #panelNotif')) $('#panelNotif').classList.add('hidden'); });

async function seleccionar(n) {
  negocio = n;
  localStorage.setItem(NEGOCIO_KEY, n.id);
  $('#selNegocio').value = n.id;
  aplicarMarca(n.color_marca);
  $('#linkReservas').href = `/booking.html?n=${n.id}`;
  $('#linkReservas').classList.remove('hidden');
  escucharRealtime();
  await cargar();
}

async function cargar() {
  const dia = $('#fecha').value || hoyISO();
  const siguiente = new Date(dia + 'T00:00:00');
  siguiente.setDate(siguiente.getDate() + 1);
  const { data, error } = await supabase.from('citas')
    .select('*, empleados(nombre), servicios(nombre, precio)')
    .eq('negocio_id', negocio.id)
    .neq('estatus', 'cancelado')
    .gte('fecha_hora', `${dia}T00:00:00`).lt('fecha_hora', `${hoyISO(siguiente)}T00:00:00`)
    .order('fecha_hora');
  if (error) return toast(error.message, 'error');
  citas = data;
  pintar();
}

function tarjeta(c) {
  const [txt, cls] = ESTATUS[c.estatus] ?? [c.estatus, 'bg-slate-100'];
  const wa = c.cliente_whatsapp.replace(/\D/g, '').replace(/^0/, '58');
  return `
  <article data-id="${c.id}" class="cita-card flex flex-col rounded-2xl bg-white p-4 shadow-sm ring-1 ring-slate-200 transition-all duration-300">
    <div class="flex items-start justify-between gap-2">
      <div><p class="text-2xl font-extrabold">${formatoHora(c.fecha_hora)}</p><p class="text-sm text-slate-500">${c.duracion_minutos} min · ${esc(c.empleados?.nombre ?? '')}</p></div>
      <span class="rounded-full px-2.5 py-1 text-xs font-semibold ${cls}">${txt}</span>
    </div>
    <div class="mt-3">
      <p class="font-bold">${esc(c.cliente_nombre)}</p>
      <a class="no-print text-sm text-brand" href="https://wa.me/${wa}" target="_blank">WhatsApp ${esc(c.cliente_whatsapp)}</a>
      <p class="print-only text-sm">WhatsApp: ${esc(c.cliente_whatsapp)}</p>
      <p class="mt-1 text-sm">${esc(c.servicios?.nombre ?? 'Servicio')} · <b>${c.servicios ? dinero(c.servicios.precio) : ''}</b></p>
    </div>
    <dl class="mt-3 grid grid-cols-2 gap-x-3 gap-y-1 rounded-xl bg-slate-50 p-3 text-xs">
      <dt class="text-slate-500">Referencia</dt><dd class="font-mono font-semibold">${esc(c.referencia_pago)}</dd>
      <dt class="text-slate-500">Banco</dt><dd>${esc(c.banco_origen)}</dd>
      <dt class="text-slate-500">Titular</dt><dd>${esc(c.pago_titular)}</dd>
      <dt class="text-slate-500">Cédula</dt><dd>${esc(c.pago_cedula)}</dd>
      <dt class="text-slate-500">Teléfono</dt><dd>${esc(c.pago_telefono)}</dd>
    </dl>
    ${c.estatus === 'pendiente_pago' ? `<button data-verificar class="no-print mt-4 rounded-xl bg-brand py-2.5 font-semibold text-white">Verificar pago</button>` : ''}
    ${c.estatus === 'confirmado' ? `
      <textarea data-notas rows="3" placeholder="Notas CRM: diagnóstico, preferencias, próxima visita…" class="no-print mt-4 w-full rounded-xl border border-slate-300 p-3 text-sm">${esc(c.notas_crm)}</textarea>
      <button data-terminar class="no-print mt-2 rounded-xl bg-slate-900 py-2.5 font-semibold text-white">Guardar y terminar cita</button>` : ''}
    <p class="notas-print mt-2 hidden text-sm">${c.notas_crm ? 'Notas: ' + esc(c.notas_crm) : ''}</p>
  </article>`;
}

function pintar() {
  const visibles = citas.filter((c) => $('#verTerminadas').checked || c.estatus !== 'terminado');
  const pend = citas.filter((c) => c.estatus === 'pendiente_pago').length;
  const conf = citas.filter((c) => c.estatus === 'confirmado').length;
  const term = citas.filter((c) => c.estatus === 'terminado').length;
  $('#resumen').textContent = `${pend} por verificar · ${conf} confirmadas · ${term} terminadas`;
  $('#printTitulo').textContent = `${negocio.nombre} · Reporte del día`;
  $('#printSub').textContent = `${negocio.categoria} · ${$('#fecha').value.split('-').reverse().join('/')} · ${visibles.length} citas`;
  $('#citas').innerHTML = visibles.map(tarjeta).join('')
    || `<div class="col-span-full rounded-2xl border-2 border-dashed border-slate-300 p-10 text-center text-slate-500"><p class="text-4xl">✓</p><p class="mt-2 font-semibold">Bandeja en cero</p><p class="text-sm">No hay citas pendientes para este día.</p></div>`;
}

$('#citas').addEventListener('click', async (e) => {
  const card = e.target.closest('[data-id]');
  if (!card) return;
  const cita = citas.find((c) => c.id === card.dataset.id);
  if (e.target.closest('[data-verificar]')) {
    const { error } = await supabase.from('citas').update({ estatus: 'confirmado' }).eq('id', cita.id);
    if (error) return toast(error.message, 'error');
    cita.estatus = 'confirmado';
    pintar();
    $(`[data-id="${cita.id}"] [data-notas]`)?.focus();
    toast('Pago verificado');
  }
  if (e.target.closest('[data-terminar]')) {
    const notas = card.querySelector('[data-notas]').value.trim();
    const { error } = await supabase.from('citas').update({ estatus: 'terminado', notas_crm: notas || null }).eq('id', cita.id);
    if (error) return toast(error.message, 'error');
    cita.estatus = 'terminado';
    cita.notas_crm = notas;
    card.classList.add('scale-95', 'opacity-0');
    setTimeout(pintar, 300);
    toast('Cita terminada');
  }
});

function escucharRealtime() {
  if (canal) supabase.removeChannel(canal);
  canal = supabase.channel(`citas-${negocio.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'citas', filter: `negocio_id=eq.${negocio.id}` }, (p) => avisar(p.new))
    .subscribe();
}

function avisar(c) {
  nuevas++;
  $('#badge').textContent = nuevas;
  $('#badge').classList.remove('hidden');
  const icono = $('#campanaIcono');
  icono.classList.remove('bell-ring');
  void icono.getBoundingClientRect();
  icono.classList.add('bell-ring');
  const dia = c.fecha_hora.slice(0, 10).split('-').reverse().join('/');
  const txt = `${c.cliente_nombre} reservó para el ${dia} a las ${formatoHora(c.fecha_hora)}`;
  toast('Nueva reserva: ' + txt);
  const lista = $('#listaNotif');
  if (!lista.querySelector('[data-n]')) lista.innerHTML = '';
  lista.insertAdjacentHTML('afterbegin', `<li data-n class="rounded-lg px-2 py-2 text-sm hover:bg-slate-50">${esc(txt)}</li>`);
  if (c.fecha_hora.slice(0, 10) === $('#fecha').value) cargar();
}

const guardado = negocios.find((n) => n.id === localStorage.getItem(NEGOCIO_KEY));
if (negocios.length) await seleccionar(guardado ?? negocios[0]);
