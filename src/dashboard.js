import {
  supabase, $, $$, esc, toast, aplicarMarca, requerirSesion, misNegocios, NEGOCIO_KEY, hoyISO, sumarDias, horarioDe, insigniaNegocio, comprimirLogo, subirLogo, formatoHora, hora12, fechaLarga,
  dinero, bs, DIAS, CATEGORIAS, slugify, slugValido, waLink, sonar, icono, piePagina, slotsLibres, minutos, hhmm,
} from './lib.js';

const VISTAS = { hoy: 'Hoy', agenda: 'Agenda', clientes: 'Clientes', servicios: 'Servicios', equipo: 'Equipo', ajustes: 'Ajustes' };
const ESTATUS = {
  pendiente_pago: ['Pendiente de verificar', 'bg-amber-500/15 text-amber-600 ring-amber-500/30'],
  confirmado: ['Pago aprobado', 'bg-emerald-500/15 text-emerald-600 ring-emerald-500/30'],
  terminado: ['Terminada', 'bg-zinc-800 text-zinc-300 ring-zinc-800'],
  cancelado: ['Cancelada', 'bg-red-500/10 text-red-500 ring-red-500/20'],
  expirado: ['Liberada sin pago', 'bg-red-500/10 text-red-500 ring-red-500/20'],
};
const SUBTITULOS = { hoy: 'Resumen del día y citas por atender', agenda: 'Citas por día y por persona', clientes: 'Historial y notas de cada cliente', servicios: 'Lo que ofreces, con duración y precio', equipo: 'Quién atiende, sus horarios y días libres', ajustes: 'Datos del negocio, horario y cobros' };
const SELECT_CITA = '*, empleados(nombre), servicios(nombre)';
const st = { user: null, negocios: [], negocio: null, empleados: [], servicios: [], citas: [], fechaAgenda: hoyISO(), verTerminadas: false, tabReservas: 'proximas', canal: null, nuevas: 0, clientes: [] };

st.user = await requerirSesion();
st.negocios = await misNegocios(st.user.id);
if (!st.negocios.length) location.href = '/registro';

// ---------- layout ----------
const vistaActual = () => (VISTAS[location.hash.slice(1)] ? location.hash.slice(1) : 'hoy');
$('#menuLateral').innerHTML = Object.entries(VISTAS).map(([k, v]) => `<a href="#${k}" data-nav="${k}" class="flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold text-zinc-400 transition hover:bg-zinc-800 hover:text-zinc-100">${icono(k)}${v}</a>`).join('');
$('#avatar').textContent = (st.user.email || '?').slice(0, 2).toUpperCase();
$('#usuario').textContent = st.user.email;
$('#menuInferior').innerHTML = Object.entries(VISTAS).map(([k, v]) => `<a href="#${k}" data-nav="${k}" class="flex flex-col items-center gap-1 py-2 text-[10px] font-medium text-zinc-500">${icono(k)}${v}</a>`).join('');
$$('[data-salir]').forEach((b) => { b.innerHTML = `${icono('salir')}<span class="md:inline hidden">Salir</span>`; b.onclick = async () => { await supabase.auth.signOut(); location.href = '/'; }; });
$('#campanaIcono').innerHTML = icono('campana', 'h-6 w-6');
$('#pdf').innerHTML = `${icono('imprimir', 'h-4 w-4')}<span class="hidden sm:inline">Exportar PDF</span>`;
$('#pdf').onclick = () => window.print();
$('main').append(piePagina('no-print md:text-left'));
$('main').append(Object.assign(document.createElement('p'), { className: 'print-only mt-6 text-center text-xs', textContent: 'Plataforma desarrollada por Orangel Gonzalez' }));
$$('[data-sel-negocio]').forEach((s) => { s.onchange = (e) => seleccionar(st.negocios.find((n) => n.id === e.target.value)); });
$('#campana').onclick = () => { $('#panelNotif').classList.toggle('hidden'); st.nuevas = 0; $('#badge').classList.add('hidden'); };
document.addEventListener('click', (e) => { if (!e.target.closest('#campana, #panelNotif')) $('#panelNotif').classList.add('hidden'); });
window.addEventListener('hashchange', render);
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});

function pintarSelector() {
  $$('[data-sel-negocio]').forEach((s) => { s.innerHTML = st.negocios.map((n) => `<option value="${n.id}">${esc(n.nombre)}</option>`).join(''); s.value = st.negocio.id; });
}

async function seleccionar(n) {
  st.negocio = n;
  localStorage.setItem(NEGOCIO_KEY, n.id);
  aplicarMarca(n.color_marca);
  pintarSelector();
  const [e, s] = await Promise.all([
    supabase.from('empleados').select('*').eq('negocio_id', n.id).order('nombre'),
    supabase.from('servicios').select('*').eq('negocio_id', n.id).order('nombre'),
  ]);
  st.empleados = e.data ?? [];
  st.servicios = s.data ?? [];
  escucharRealtime();
  render();
}

function render() {
  const v = vistaActual();
  $$('[data-nav]').forEach((a) => {
    const on = a.dataset.nav === v;
    if (a.closest('#menuLateral')) a.classList.toggle('nav-on', on);
    else a.classList.toggle('text-brand', on);
  });
  $('#tituloVista').textContent = VISTAS[v];
  $('#subVista').textContent = SUBTITULOS[v];
  $('#hdrLogo').innerHTML = insigniaNegocio(st.negocio, 'h-10 w-10 text-sm md:h-11 md:w-11');
  $('#hdrNombre').textContent = st.negocio.nombre;
  $('#hdrRubro').textContent = st.negocio.categoria;
  $('#pdf').classList.toggle('hidden', !['hoy', 'agenda'].includes(v));
  $('#printLogo').innerHTML = st.negocio.logo_url ? `<img src="${esc(st.negocio.logo_url)}" class="h-full w-full object-cover" alt="">` : esc(st.negocio.logo_texto || st.negocio.nombre[0]);
  $('#printNombre').textContent = st.negocio.nombre;
  if (v !== 'hoy') delete $('#vista').dataset.hoy;
  ({ hoy: vistaHoy, agenda: vistaAgenda, clientes: vistaClientes, servicios: vistaServicios, equipo: vistaEquipo, ajustes: vistaAjustes })[v]();
}

const chip = (estatus) => { const [t, c] = ESTATUS[estatus] ?? [estatus, '']; return `<span class="rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${c}">${t}</span>`; };
const rangoDia = (dia) => [`${dia}T00:00:00`, `${sumarDias(dia, 1)}T00:00:00`];

async function citasEntre(desde, hasta) {
  const { data, error } = await supabase.from('citas').select(SELECT_CITA).eq('negocio_id', st.negocio.id).gte('fecha_hora', desde).lt('fecha_hora', hasta).order('fecha_hora');
  if (error) { toast(error.message, 'error'); return []; }
  return data;
}

function recordatorio(c) {
  return waLink(c.cliente_whatsapp, `Hola ${c.cliente_nombre}, te recordamos tu cita en ${st.negocio.nombre}: ${c.servicios?.nombre ?? 'servicio'} con ${c.empleados?.nombre ?? ''}, ${fechaLarga(c.fecha_hora)} a las ${formatoHora(c.fecha_hora)}. ¡Te esperamos!`);
}

function tarjeta(c) {
  const activa = ['pendiente_pago', 'confirmado'].includes(c.estatus);
  return `
  <article data-id="${c.id}" class="cita-card card flex flex-col p-5 transition-all duration-300">
    <div class="flex items-start justify-between gap-2">
      <div><p class="font-display text-2xl font-extrabold">${formatoHora(c.fecha_hora)}</p><p class="text-sm text-zinc-400">${c.duracion_minutos} min · ${esc(c.empleados?.nombre ?? '')}</p></div>
      ${chip(c.estatus)}
    </div>
    <div class="mt-4">
      <p class="text-lg font-bold">${esc(c.cliente_nombre)}</p>
      <p class="text-sm text-zinc-400">${esc(c.servicios?.nombre ?? 'Servicio')} · <b class="text-zinc-200">${dinero(c.precio)}</b> <span class="text-xs">${bs(c.precio, st.negocio.tasa_bs)}</span></p>
      <p class="print-only text-sm">WhatsApp: ${esc(c.cliente_whatsapp)}</p>
    </div>
    <dl class="mt-4 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-2xl bg-zinc-800 p-3 text-xs">
      <dt class="text-zinc-500">Referencia</dt><dd class="font-mono font-semibold">${esc(c.referencia_pago)}</dd>
      <dt class="text-zinc-500">Banco</dt><dd>${esc(c.banco_origen)}</dd>
      <dt class="text-zinc-500">Titular</dt><dd>${esc(c.pago_titular)} · ${esc(c.pago_cedula)}</dd>
      ${c.pago_telefono ? `<dt class="text-zinc-500">Celular</dt><dd>${esc(c.pago_telefono)}</dd>` : ''}
    </dl>
    ${c.estatus === 'pendiente_pago' ? `<button data-accion="aprobar" class="no-print btn-brand mt-4">${icono('check', 'h-4 w-4')}Aprobar pago</button>` : ''}
    ${c.estatus === 'confirmado' ? `
      <textarea data-notas rows="3" placeholder="Notas: diagnóstico, detalles del servicio, preferencias…" class="no-print inp mt-4 text-sm">${esc(c.notas_crm)}</textarea>
      <button data-accion="terminar" class="no-print btn mt-2 bg-zinc-100 text-white hover:bg-zinc-200">Guardar y terminar cita</button>` : ''}
    ${c.estatus === 'terminado' && c.notas_crm ? `<p class="no-print mt-3 whitespace-pre-wrap rounded-2xl bg-zinc-800 p-3 text-sm italic text-zinc-300">${esc(c.notas_crm)}</p>` : ''}
    <p class="notas-print hidden text-sm">${c.notas_crm ? 'Notas: ' + esc(c.notas_crm) : ''}</p>
    <div class="no-print mt-3 flex flex-wrap gap-2">
      <a href="${recordatorio(c)}" target="_blank" class="btn-ghost btn-sm">${icono('whatsapp', 'h-4 w-4')}${activa ? 'Recordar' : 'WhatsApp'}</a>
      ${activa ? '<button data-accion="reprogramar" class="btn-ghost btn-sm">Reprogramar</button><button data-accion="cancelar" class="btn-ghost btn-sm text-red-500">Cancelar</button>' : ''}
    </div>
  </article>`;
}

// ---------- HOY ----------
const ACTIVAS = ['pendiente_pago', 'confirmado'];
const VIGENTE = (c) => !['cancelado', 'expirado'].includes(c.estatus);
const finCita = (c) => hora12(hhmm(minutos(c.fecha_hora.slice(11, 16)) + c.duracion_minutos));

function tarjetaStat({ titulo, valor, icon, color, nota }) {
  return `<div class="card flex flex-col justify-between gap-5 p-4 sm:p-5" style="--c:${color}">
    <div class="flex items-center gap-3"><span class="suave grid h-10 w-10 shrink-0 place-items-center rounded-full">${icono(icon, 'h-5 w-5')}</span><p class="text-sm font-semibold leading-tight">${titulo}</p></div>
    <div class="flex items-end justify-between gap-2"><div class="min-w-0"><p class="truncate text-[11px] text-zinc-500">${nota}</p><p class="font-display text-xl font-extrabold sm:text-2xl">${valor}</p></div>
    <span class="grid h-7 w-7 shrink-0 place-items-center rounded-full text-white" style="background:${color}">${icono('check', 'h-4 w-4')}</span></div>
  </div>`;
}

function filaReserva(c) {
  return `<tr data-id="${c.id}" class="${VIGENTE(c) ? '' : 'opacity-60'}">
    <td><b>${fechaLarga(c.fecha_hora)}</b></td><td>${formatoHora(c.fecha_hora)}</td><td class="text-zinc-500">${finCita(c)}</td>
    <td>${esc(c.servicios?.nombre ?? '')}</td><td class="font-semibold">${esc(c.cliente_nombre)}</td><td>${esc(c.empleados?.nombre ?? '')}</td>
    <td><a href="${recordatorio(c)}" target="_blank" class="text-emerald-600 hover:underline">${esc(c.cliente_whatsapp)}</a></td>
    <td>${chip(c.estatus)}</td>
    <td>${ACTIVAS.includes(c.estatus) ? `<div class="flex gap-1.5">${c.estatus === 'pendiente_pago' ? '<button data-accion="aprobar" class="btn-brand btn-sm py-1.5">Aprobar</button>' : ''}<button data-accion="reprogramar" class="btn-ghost btn-sm py-1.5">Mover</button><button data-accion="cancelar" class="btn-ghost btn-sm py-1.5 text-red-500">✕</button></div>` : ''}</td>
  </tr>`;
}

function ocupacion(citasHoy) {
  const dow = new Date().getDay();
  const libre = st.empleados.reduce((t, e) => {
    const h = horarioDe(st.negocio, e);
    return t + (h.dias.includes(dow) ? Math.max(0, minutos(h.cierre) - minutos(h.apertura)) : 0);
  }, 0);
  const usado = citasHoy.filter(VIGENTE).reduce((t, c) => t + c.duracion_minutos, 0);
  const pct = libre ? Math.min(100, Math.round((usado / libre) * 100)) : 0;
  $('#ocupacionTxt').textContent = libre ? `${pct}% · ${Math.round(usado / 6) / 10} h` : 'Hoy cerrado';
  $('#ocupacionBarra').style.width = pct + '%';
}

async function vistaHoy() {
  const dia = hoyISO();
  const desde = sumarDias(dia, -6);
  $('#printSub').textContent = `Reporte del día · ${fechaLarga(dia)} ${dia.split('-')[0]}`;
  if (!$('#vista').dataset.hoy) $('#vista').innerHTML = '<p class="text-zinc-500">Cargando…</p>';
  await supabase.rpc('liberar_vencidas', { p_negocio: st.negocio.id });
  const mes = dia.slice(0, 8) + '01';
  const [ventana, delMes, clientes] = await Promise.all([
    citasEntre(`${desde}T00:00:00`, `${sumarDias(dia, 31)}T00:00:00`),
    supabase.from('citas').select('precio').eq('negocio_id', st.negocio.id).in('estatus', ['confirmado', 'terminado']).gte('fecha_hora', `${mes}T00:00:00`).lt('fecha_hora', `${sumarDias(mes, 32).slice(0, 8)}01T00:00:00`),
    supabase.from('citas').select('cliente_whatsapp').eq('negocio_id', st.negocio.id).limit(5000),
  ]);
  if (vistaActual() !== 'hoy') return;
  st.citas = ventana;
  const citas = ventana.filter((c) => c.fecha_hora.slice(0, 10) === dia);
  ocupacion(citas);
  const suma = (l) => l.reduce((a, c) => a + Number(c.precio || 0), 0);
  const ingresosHoy = suma(citas.filter((c) => ['confirmado', 'terminado'].includes(c.estatus)));
  const nClientes = new Set((clientes.data ?? []).map((c) => c.cliente_whatsapp.replace(/\D/g, '').slice(-10))).size;
  const fechaCorta = `${fechaLarga(dia)} ${dia.slice(0, 4)}`;
  const stats = [
    { titulo: 'Citas de hoy', valor: citas.filter(VIGENTE).length, icon: 'agenda', color: 'var(--brand)', nota: fechaCorta },
    { titulo: 'Por verificar', valor: citas.filter((c) => c.estatus === 'pendiente_pago').length, icon: 'campana', color: '#f59e0b', nota: 'Pagos pendientes hoy' },
    { titulo: 'Clientes', valor: nClientes, icon: 'clientes', color: '#a855f7', nota: 'Total registrados' },
    { titulo: 'Ingresos de hoy', valor: dinero(ingresosHoy), icon: 'dinero', color: '#06b6d4', nota: bs(ingresosHoy, st.negocio.tasa_bs) || 'Pagos aprobados' },
  ];
  const lunes = sumarDias(dia, -((new Date(dia + 'T12:00:00').getDay() + 6) % 7));
  const dias = Array.from({ length: 7 }, (_, k) => sumarDias(lunes, k));
  const conteo = dias.map((d) => ventana.filter((c) => VIGENTE(c) && c.fecha_hora.slice(0, 10) === d).length);
  const max = Math.max(1, ...conteo);
  const ahora = `${dia}T${hhmm(new Date().getHours() * 60 + new Date().getMinutes())}`;
  const tabs = {
    proximas: ['Próximas', ventana.filter((c) => ACTIVAS.includes(c.estatus) && c.fecha_hora.slice(0, 16) >= ahora)],
    todas: ['Todas', ventana.filter((c) => c.fecha_hora.slice(0, 10) >= dia)],
    canceladas: ['Canceladas', ventana.filter((c) => !VIGENTE(c))],
  };
  const filas = tabs[st.tabReservas][1];
  const visibles = citas.filter((c) => ACTIVAS.includes(c.estatus) || (st.verTerminadas && c.estatus === 'terminado'));
  const n = st.negocio;
  const mapa = n.direccion ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(n.direccion)}` : '';
  $('#vista').dataset.hoy = '1';
  $('#vista').innerHTML = `
  <div class="no-print grid gap-5 xl:grid-cols-[minmax(0,1fr)_20rem]">
    <div class="min-w-0 space-y-5">
      <div class="grid grid-cols-2 gap-3 sm:gap-5">${stats.map(tarjetaStat).join('')}</div>
      <section class="card p-5">
        <div class="flex flex-wrap items-start justify-between gap-3">
          <div><h2 class="font-display text-lg font-bold">Citas de la semana</h2><p class="text-xs text-zinc-500">${fechaLarga(lunes)} – ${fechaLarga(sumarDias(lunes, 6))}</p></div>
          <div class="text-right"><p class="text-xs text-zinc-500">Ingresos del mes</p><p class="font-display text-lg font-extrabold text-brand">${dinero(suma(delMes.data ?? []))}</p></div>
        </div>
        <div class="mt-6 grid grid-cols-7 items-end gap-2 sm:gap-4">${dias.map((d, k) => `
          <div class="flex flex-col items-center gap-2">
            <span class="text-xs font-semibold ${d === dia ? 'text-zinc-100' : 'text-zinc-500'}">${conteo[k]}</span>
            <div class="flex h-36 w-full items-end"><div class="barra ${d === dia ? 'hoy' : ''} w-full rounded-2xl transition-all duration-700" style="height:${Math.max(8, (conteo[k] / max) * 100)}%"></div></div>
            <span class="w-full rounded-full py-1.5 text-center text-[11px] font-semibold ${d === dia ? 'bg-brand text-white' : 'barra text-zinc-500'}">${DIAS[new Date(d + 'T12:00:00').getDay()]}</span>
          </div>`).join('')}</div>
      </section>
    </div>
    <div class="grid gap-5 sm:grid-cols-2 xl:grid-cols-1">
      <section class="card p-4">
        <h2 class="px-1 pb-3 font-display text-lg font-bold">Tu página</h2>
        <div class="relative overflow-hidden rounded-3xl" style="background:linear-gradient(135deg, color-mix(in srgb, var(--brand) 85%, #000), var(--brand))">
          <div class="grid h-36 place-items-center">${insigniaNegocio(n, 'h-20 w-20 text-3xl ring-4 ring-white/30')}</div>
          <div class="flex items-center gap-3 bg-black/15 px-4 py-3 text-white backdrop-blur">
            <p class="min-w-0 flex-1 text-sm font-medium leading-tight">Comparte tu link y recibe reservas<span class="block truncate text-xs opacity-80">${esc(location.host)}/${esc(n.slug)}</span></p>
            <button data-copiar-link aria-label="Copiar link" class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-zinc-950 shadow">${icono('flecha', 'h-5 w-5 text-[#111]')}</button>
          </div>
        </div>
      </section>
      <section class="card p-5">
        <h2 class="font-display text-lg font-bold">Ubicación y contacto</h2>
        <div class="mt-3 flex items-start gap-3 rounded-2xl bg-zinc-950 p-4"><span class="suave grid h-10 w-10 shrink-0 place-items-center rounded-full" style="--c:var(--brand)">${icono('pin')}</span>
          <p class="text-sm">${n.direccion ? esc(n.direccion) : '<span class="text-zinc-500">Agrega tu dirección en Ajustes</span>'}</p></div>
        <div class="mt-3 flex flex-wrap gap-2">
          ${mapa ? `<a href="${mapa}" target="_blank" class="btn-ghost btn-sm">${icono('pin', 'h-4 w-4')}Mapa</a>` : ''}
          ${n.whatsapp ? `<a href="${waLink(n.whatsapp)}" target="_blank" class="btn-ghost btn-sm">${icono('whatsapp', 'h-4 w-4')}WhatsApp</a>` : ''}
          ${n.instagram ? `<a href="https://instagram.com/${esc(n.instagram)}" target="_blank" class="btn-ghost btn-sm">${icono('instagram', 'h-4 w-4')}@${esc(n.instagram)}</a>` : ''}
        </div>
      </section>
    </div>
  </div>

  <div class="no-print mt-8 flex flex-wrap items-center gap-3">
    <h2 class="font-display text-xl font-bold">Por atender hoy</h2>
    <label class="ml-auto flex items-center gap-2 text-sm text-zinc-400"><input id="verTerminadas" type="checkbox" class="h-4 w-4 accent-[var(--brand)]" ${st.verTerminadas ? 'checked' : ''}>Ver terminadas</label>
  </div>
  <div class="print-list mt-4 grid gap-4 sm:grid-cols-2 2xl:grid-cols-3">${visibles.map(tarjeta).join('') || `
    <div class="card col-span-full p-10 text-center"><span class="suave mx-auto grid h-14 w-14 place-items-center rounded-full" style="--c:#22c55e">${icono('check', 'h-7 w-7')}</span><p class="mt-3 font-display text-xl font-bold">Bandeja en cero</p><p class="mt-1 text-sm text-zinc-400">No tienes citas pendientes hoy.</p>
    <button data-copiar-link class="btn-ghost btn-sm mt-5">${icono('link', 'h-4 w-4')}Copiar mi link de reservas</button></div>`}</div>

  <section class="no-print card mt-8 overflow-hidden">
    <div class="flex flex-wrap items-center justify-between gap-3 p-5">
      <h2 class="font-display text-lg font-bold">Estado de reservas</h2>
      <div class="flex gap-1 rounded-full bg-zinc-950 p-1">${Object.entries(tabs).map(([k, [t, l]]) => `<button data-tab="${k}" class="rounded-full px-3 py-1.5 text-xs font-semibold sm:px-4 sm:text-sm ${k === st.tabReservas ? 'bg-brand text-white shadow' : 'text-zinc-400'}">${t} <span class="opacity-70">${l.length}</span></button>`).join('')}</div>
    </div>
    <div class="overflow-x-auto"><table class="tabla w-full min-w-[56rem]">
      <thead><tr><th>Fecha</th><th>Inicio</th><th>Fin</th><th>Servicio</th><th>Cliente</th><th>Atiende</th><th>WhatsApp</th><th>Estado</th><th></th></tr></thead>
      <tbody>${filas.map(filaReserva).join('') || '<tr><td colspan="9" class="py-10 text-center text-zinc-500">No hay reservas aquí.</td></tr>'}</tbody>
    </table></div>
  </section>`;
  $('#verTerminadas').onchange = (e) => { st.verTerminadas = e.target.checked; vistaHoy(); };
  $$('[data-tab]').forEach((b) => { b.onclick = () => { st.tabReservas = b.dataset.tab; vistaHoy(); }; });
}

// ---------- AGENDA ----------
async function vistaAgenda() {
  const dia = st.fechaAgenda;
  $('#printSub').textContent = `Agenda · ${fechaLarga(dia)} ${dia.split('-')[0]}`;
  const citas = await citasEntre(...rangoDia(dia));
  if (vistaActual() !== 'agenda') return;
  st.citas = citas;
  const porEmpleado = st.empleados.map((e) => ({ e, citas: citas.filter((c) => c.empleado_id === e.id) }));
  $('#vista').innerHTML = `
    <div class="no-print flex flex-wrap items-center gap-2">
      <button data-dia="-1" class="btn-ghost btn-sm" aria-label="Día anterior">${icono('izq', 'h-4 w-4')}</button>
      <input id="fechaAgenda" type="date" value="${dia}" class="inp w-auto py-2">
      <button data-dia="1" class="btn-ghost btn-sm" aria-label="Día siguiente">${icono('der', 'h-4 w-4')}</button>
      <button data-dia="0" class="btn-ghost btn-sm">Hoy</button>
      <p class="ml-auto text-sm text-zinc-400">${citas.filter((c) => !['cancelado', 'expirado'].includes(c.estatus)).length} citas</p>
    </div>
    <div class="print-list mt-6 grid gap-5 lg:grid-cols-2">${porEmpleado.map(({ e, citas: cs }) => `
      <section class="card p-5">
        <h3 class="flex items-center gap-3 font-display font-bold"><span class="grid h-9 w-9 place-items-center rounded-full bg-brand/15 text-brand">${esc(e.nombre[0]?.toUpperCase())}</span>${esc(e.nombre)}</h3>
        <ul class="mt-4 space-y-2">${cs.map((c) => `
          <li data-id="${c.id}" class="cita-card rounded-2xl bg-zinc-800 p-3 ${['cancelado', 'expirado'].includes(c.estatus) ? 'opacity-50' : ''}">
            <div class="flex items-center justify-between gap-2"><p class="font-semibold">${formatoHora(c.fecha_hora)} – ${hora12(hhmm(minutos(c.fecha_hora.slice(11, 16)) + c.duracion_minutos))}</p>${chip(c.estatus)}</div>
            <p class="mt-1 text-sm">${esc(c.cliente_nombre)} · <span class="text-zinc-400">${esc(c.servicios?.nombre ?? '')} · ${dinero(c.precio)}</span></p>
            <p class="notas-print hidden text-sm">${c.notas_crm ? 'Notas: ' + esc(c.notas_crm) : ''}</p>
            ${['pendiente_pago', 'confirmado'].includes(c.estatus) ? `<div class="no-print mt-2 flex flex-wrap gap-2"><a href="${recordatorio(c)}" target="_blank" class="btn-ghost btn-sm">${icono('whatsapp', 'h-4 w-4')}Recordar</a><button data-accion="reprogramar" class="btn-ghost btn-sm">Reprogramar</button><button data-accion="cancelar" class="btn-ghost btn-sm text-red-500">Cancelar</button></div>` : ''}
          </li>`).join('') || '<li class="text-sm text-zinc-500">Sin citas.</li>'}</ul>
      </section>`).join('')}</div>`;
  $('#fechaAgenda').onchange = (e) => { st.fechaAgenda = e.target.value || hoyISO(); vistaAgenda(); };
  $$('[data-dia]').forEach((b) => { b.onclick = () => { st.fechaAgenda = b.dataset.dia === '0' ? hoyISO() : sumarDias(st.fechaAgenda, Number(b.dataset.dia)); vistaAgenda(); }; });
}

// ---------- acciones sobre citas ----------
$('#vista').addEventListener('click', async (e) => {
  if (e.target.closest('[data-copiar-link]')) { await navigator.clipboard.writeText(`${location.origin}/${st.negocio.slug}`); return toast('Link copiado'); }
  const btn = e.target.closest('[data-accion]');
  const card = e.target.closest('[data-id]');
  if (!btn || !card || !st.citas.length) return;
  const cita = st.citas.find((c) => c.id === card.dataset.id);
  if (!cita) return;
  const accion = btn.dataset.accion;
  if (accion === 'aprobar') {
    const { error } = await supabase.from('citas').update({ estatus: 'confirmado' }).eq('id', cita.id);
    if (error) return toast(error.message, 'error');
    toast('Pago aprobado');
    await vistaHoy();
    $(`[data-id="${cita.id}"] [data-notas]`)?.focus();
  }
  if (accion === 'terminar') {
    const notas = card.querySelector('[data-notas]').value.trim();
    const { error } = await supabase.from('citas').update({ estatus: 'terminado', notas_crm: notas || null }).eq('id', cita.id);
    if (error) return toast(error.message, 'error');
    card.classList.add('scale-95', 'opacity-0');
    toast('Cita terminada');
    setTimeout(vistaHoy, 300);
  }
  if (accion === 'cancelar') {
    if (!confirm(`¿Cancelar la cita de ${cita.cliente_nombre}? El horario quedará libre.`)) return;
    const { error } = await supabase.from('citas').update({ estatus: 'cancelado' }).eq('id', cita.id);
    if (error) return toast(error.message, 'error');
    toast('Cita cancelada');
    window.open(waLink(cita.cliente_whatsapp, `Hola ${cita.cliente_nombre}, tu cita en ${st.negocio.nombre} del ${fechaLarga(cita.fecha_hora)} a las ${formatoHora(cita.fecha_hora)} fue cancelada. Escríbenos para reprogramarla.`), '_blank');
    render();
  }
  if (accion === 'reprogramar') abrirReprogramar(cita);
});

function abrirModal(html) {
  const m = $('#modal');
  m.innerHTML = `<div class="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] bg-zinc-900 p-6 ring-1 ring-zinc-800 sm:rounded-[2rem]">${html}</div>`;
  m.classList.remove('hidden');
  m.classList.add('flex');
  m.onclick = (e) => { if (e.target === m || e.target.closest('[data-cerrar]')) cerrarModal(); };
}
function cerrarModal() { $('#modal').classList.add('hidden'); $('#modal').classList.remove('flex'); }

function abrirReprogramar(cita) {
  const servicio = st.servicios.find((s) => s.id === cita.servicio_id) ?? { duracion_minutos: cita.duracion_minutos };
  let fecha = cita.fecha_hora.slice(0, 10) < hoyISO() ? hoyISO() : cita.fecha_hora.slice(0, 10);
  let empleadoId = cita.empleado_id;
  let hora = null;
  abrirModal(`
    <div class="flex items-center justify-between"><h2 class="font-display text-xl font-bold">Reprogramar</h2><button data-cerrar class="grid h-9 w-9 place-items-center rounded-full hover:bg-zinc-800">${icono('x')}</button></div>
    <p class="mt-1 text-sm text-zinc-400">${esc(cita.cliente_nombre)} · ${esc(cita.servicios?.nombre ?? '')}</p>
    <label class="mt-5 block"><span class="lbl">Con</span><select id="rEmp" class="inp">${st.empleados.map((e) => `<option value="${e.id}" ${e.id === empleadoId ? 'selected' : ''}>${esc(e.nombre)}</option>`).join('')}</select></label>
    <label class="mt-3 block"><span class="lbl">Día</span><input id="rFecha" type="date" min="${hoyISO()}" value="${fecha}" class="inp"></label>
    <div id="rSlots" class="mt-4 grid grid-cols-3 gap-2"></div>
    <button id="rGuardar" disabled class="btn-brand mt-5 w-full">Guardar nuevo horario</button>`);
  const cargar = async () => {
    hora = null;
    $('#rGuardar').disabled = true;
    const empleado = st.empleados.find((e) => e.id === empleadoId);
    const libres = await slotsLibres({ negocio: st.negocio, empleado, servicio, fecha, ignorar: empleadoId === cita.empleado_id ? cita.fecha_hora : null }).catch((e) => { toast(e.message, 'error'); return []; });
    $('#rSlots').innerHTML = libres.map((h) => `<button data-h="${h}" aria-pressed="false" class="slot rounded-2xl border border-zinc-700 bg-zinc-950 py-2.5 text-sm font-semibold">${hora12(h)}</button>`).join('') || '<p class="col-span-3 text-sm text-zinc-500">Sin horarios libres ese día.</p>';
  };
  $('#rEmp').onchange = (e) => { empleadoId = e.target.value; cargar(); };
  $('#rFecha').onchange = (e) => { fecha = e.target.value; cargar(); };
  $('#rSlots').onclick = (e) => {
    const b = e.target.closest('[data-h]');
    if (!b) return;
    hora = b.dataset.h;
    $$('#rSlots .slot').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    $('#rGuardar').disabled = false;
  };
  $('#rGuardar').onclick = async () => {
    const { error } = await supabase.from('citas').update({ fecha_hora: `${fecha}T${hora}:00`, empleado_id: empleadoId }).eq('id', cita.id);
    if (error) return toast(error.code === '23P01' ? 'Ese horario se acaba de ocupar' : error.message, 'error');
    cerrarModal();
    toast('Cita reprogramada');
    const emp = st.empleados.find((e) => e.id === empleadoId);
    window.open(waLink(cita.cliente_whatsapp, `Hola ${cita.cliente_nombre}, tu cita en ${st.negocio.nombre} quedó para el ${fechaLarga(fecha)} a las ${hora12(hora)} con ${emp?.nombre ?? ''}. ¡Te esperamos!`), '_blank');
    render();
  };
  cargar();
}

// ---------- CLIENTES ----------
async function vistaClientes() {
  $('#vista').innerHTML = '<p class="text-zinc-500">Cargando…</p>';
  const { data, error } = await supabase.from('citas').select(SELECT_CITA).eq('negocio_id', st.negocio.id).order('fecha_hora', { ascending: false }).limit(3000);
  if (error) return toast(error.message, 'error');
  const mapa = new Map();
  for (const c of data) {
    const k = c.cliente_whatsapp.replace(/\D/g, '').replace(/^58/, '0');
    if (!mapa.has(k)) mapa.set(k, { clave: k, nombre: c.cliente_nombre, whatsapp: c.cliente_whatsapp, citas: [] });
    mapa.get(k).citas.push(c);
  }
  st.clientes = [...mapa.values()].map((x) => {
    const hechas = x.citas.filter((c) => c.estatus === 'terminado');
    return { ...x, visitas: hechas.length, ultima: hechas[0]?.fecha_hora ?? null, gastado: x.citas.filter((c) => ['confirmado', 'terminado'].includes(c.estatus)).reduce((a, c) => a + Number(c.precio || 0), 0) };
  });
  if (vistaActual() !== 'clientes') return;
  $('#vista').innerHTML = `
    <input id="buscar" class="inp max-w-md" placeholder="Buscar por nombre o WhatsApp">
    <div class="card mt-5 overflow-hidden"><table class="w-full text-left text-sm">
      <thead class="bg-zinc-800 text-xs uppercase tracking-wider text-zinc-500"><tr><th class="p-4">Cliente</th><th class="hidden p-4 sm:table-cell">Visitas</th><th class="hidden p-4 md:table-cell">Última visita</th><th class="p-4 text-right">Total</th></tr></thead>
      <tbody id="tablaClientes" class="divide-y divide-white/5"></tbody></table></div>`;
  const pintar = (q = '') => {
    const lista = st.clientes.filter((c) => (c.nombre + c.whatsapp).toLowerCase().includes(q.toLowerCase()));
    $('#tablaClientes').innerHTML = lista.map((c) => `<tr data-cliente="${esc(c.clave)}" class="cursor-pointer hover:bg-zinc-800"><td class="p-4"><p class="font-semibold">${esc(c.nombre)}</p><p class="text-xs text-zinc-500">${esc(c.whatsapp)}</p></td><td class="hidden p-4 sm:table-cell">${c.visitas}</td><td class="hidden p-4 md:table-cell">${c.ultima ? fechaLarga(c.ultima) : '—'}</td><td class="p-4 text-right font-semibold">${dinero(c.gastado)}</td></tr>`).join('')
      || '<tr><td colspan="4" class="p-8 text-center text-zinc-500">Aún no tienes clientes. Comparte tu link de reservas.</td></tr>';
  };
  pintar();
  $('#buscar').oninput = (e) => pintar(e.target.value);
  $('#tablaClientes').onclick = (e) => {
    const fila = e.target.closest('[data-cliente]');
    const c = fila && st.clientes.find((x) => x.clave === fila.dataset.cliente);
    if (!c) return;
    abrirModal(`
      <div class="flex items-start justify-between gap-3"><div><h2 class="font-display text-xl font-bold">${esc(c.nombre)}</h2><p class="text-sm text-zinc-400">${esc(c.whatsapp)} · ${c.visitas} visitas · ${dinero(c.gastado)}</p></div><button data-cerrar class="grid h-9 w-9 place-items-center rounded-full hover:bg-zinc-800">${icono('x')}</button></div>
      <a href="${waLink(c.whatsapp)}" target="_blank" class="btn-ghost btn-sm mt-4">${icono('whatsapp', 'h-4 w-4')}Escribir por WhatsApp</a>
      <ul class="mt-5 space-y-3">${c.citas.map((x) => `<li class="rounded-2xl bg-zinc-800 p-4"><div class="flex items-center justify-between gap-2"><p class="font-semibold">${fechaLarga(x.fecha_hora)} ${x.fecha_hora.slice(0, 4)} · ${formatoHora(x.fecha_hora)}</p>${chip(x.estatus)}</div><p class="mt-1 text-sm text-zinc-400">${esc(x.servicios?.nombre ?? '')} con ${esc(x.empleados?.nombre ?? '')} · ${dinero(x.precio)}</p>${x.notas_crm ? `<p class="mt-2 whitespace-pre-wrap text-sm italic text-zinc-200">${esc(x.notas_crm)}</p>` : ''}</li>`).join('')}</ul>`);
  };
}

// ---------- SERVICIOS ----------
function vistaServicios() {
  $('#vista').innerHTML = `
    <form id="nuevoServicio" class="card grid gap-3 p-5 sm:grid-cols-[1fr_9rem_9rem_auto]">
      <input name="nombre" required class="inp" placeholder="Nuevo servicio (ej. Limpieza dental)">
      <input name="duracion_minutos" required type="number" min="5" step="5" class="inp" placeholder="Minutos">
      <input name="precio" required type="number" min="0" step="0.01" class="inp" placeholder="Precio $">
      <button class="btn-brand">${icono('mas', 'h-4 w-4')}Agregar</button>
    </form>
    <div class="mt-5 space-y-3">${st.servicios.map((s) => `
      <form data-srv="${s.id}" class="card grid items-center gap-3 p-4 sm:grid-cols-[1fr_9rem_9rem_auto_auto]">
        <input name="nombre" required value="${esc(s.nombre)}" class="inp">
        <label class="relative"><input name="duracion_minutos" required type="number" min="5" step="5" value="${s.duracion_minutos}" class="inp pr-12"><span class="absolute right-4 top-3 text-sm text-zinc-500">min</span></label>
        <label class="relative"><span class="absolute left-4 top-3 text-sm text-zinc-500">$</span><input name="precio" required type="number" min="0" step="0.01" value="${s.precio}" class="inp pl-8"></label>
        <button class="btn-ghost btn-sm">Guardar</button>
        <button type="button" data-borrar class="btn-ghost btn-sm text-red-500">Quitar</button>
      </form>`).join('') || '<p class="text-zinc-500">Agrega tu primer servicio.</p>'}</div>`;
  const datos = (f) => ({ nombre: f.nombre.value.trim(), duracion_minutos: Number(f.duracion_minutos.value), precio: Number(f.precio.value) });
  $('#nuevoServicio').onsubmit = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase.from('servicios').insert({ negocio_id: st.negocio.id, ...datos(e.target) }).select().single();
    if (error) return toast(error.message, 'error');
    st.servicios.push(data);
    toast('Servicio agregado');
    vistaServicios();
  };
  $$('[data-srv]').forEach((f) => {
    f.onsubmit = async (e) => {
      e.preventDefault();
      const { data, error } = await supabase.from('servicios').update(datos(f)).eq('id', f.dataset.srv).select().single();
      if (error) return toast(error.message, 'error');
      st.servicios = st.servicios.map((s) => (s.id === data.id ? data : s));
      toast('Guardado');
    };
    f.querySelector('[data-borrar]').onclick = async () => {
      if (!confirm('¿Quitar este servicio?')) return;
      const { error } = await supabase.from('servicios').delete().eq('id', f.dataset.srv);
      if (error) return toast(error.message, 'error');
      st.servicios = st.servicios.filter((s) => s.id !== f.dataset.srv);
      vistaServicios();
    };
  });
}

// ---------- EQUIPO ----------
const chipsDias = (sel, nombre) => DIAS.map((d, n) => `<label><input type="checkbox" name="${nombre}" value="${n}" class="peer sr-only" ${sel.includes(n) ? 'checked' : ''}><span class="chip block">${d}</span></label>`).join('');

async function vistaEquipo() {
  const ids = st.empleados.map((e) => e.id);
  const { data: aus } = ids.length ? await supabase.from('ausencias').select('*').in('empleado_id', ids).gte('hasta', hoyISO()).order('desde') : { data: [] };
  if (vistaActual() !== 'equipo') return;
  const n = st.negocio;
  $('#vista').innerHTML = `
    <form id="nuevoEmpleado" class="card flex gap-3 p-5"><input name="nombre" required class="inp" placeholder="Nombre de la nueva persona"><button class="btn-brand shrink-0">${icono('mas', 'h-4 w-4')}Agregar</button></form>
    <div class="mt-5 grid gap-5 lg:grid-cols-2">${st.empleados.map((e) => {
      const propio = !!(e.hora_apertura || e.dias_laborales?.length);
      return `
      <section data-emp="${e.id}" class="card p-5">
        <form data-form-emp class="space-y-4">
          <div class="flex gap-3"><input name="nombre" required value="${esc(e.nombre)}" class="inp font-semibold"><button type="button" data-borrar-emp class="btn-ghost btn-sm shrink-0 text-red-500">Quitar</button></div>
          <label class="flex items-center gap-3 text-sm"><input type="checkbox" name="propio" class="h-5 w-5 accent-[var(--brand)]" ${propio ? 'checked' : ''}>Horario propio <span class="text-zinc-500">(si no, usa el del negocio)</span></label>
          <div data-horario class="${propio ? '' : 'hidden'} space-y-3">
            <div class="flex flex-wrap gap-2">${chipsDias(e.dias_laborales ?? n.dias_laborales, 'dias')}</div>
            <div class="grid grid-cols-2 gap-3"><input name="apertura" type="time" value="${(e.hora_apertura ?? n.hora_apertura).slice(0, 5)}" class="inp"><input name="cierre" type="time" value="${(e.hora_cierre ?? n.hora_cierre).slice(0, 5)}" class="inp"></div>
          </div>
          <button class="btn-ghost btn-sm">Guardar</button>
        </form>
        <div class="mt-5 border-t border-zinc-800 pt-4">
          <p class="text-sm font-semibold">Días libres / vacaciones</p>
          <ul class="mt-2 space-y-2">${(aus ?? []).filter((a) => a.empleado_id === e.id).map((a) => `<li class="flex items-center justify-between rounded-xl bg-zinc-800 px-3 py-2 text-sm"><span>${fechaLarga(a.desde)}${a.hasta !== a.desde ? ' → ' + fechaLarga(a.hasta) : ''}${a.motivo ? ` · <span class="text-zinc-400">${esc(a.motivo)}</span>` : ''}</span><button data-borrar-aus="${a.id}" class="text-red-500">✕</button></li>`).join('') || '<li class="text-sm text-zinc-500">Ninguno próximo.</li>'}</ul>
          <form data-form-aus class="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
            <input name="desde" type="date" required min="${hoyISO()}" class="inp py-2 text-sm"><input name="hasta" type="date" required min="${hoyISO()}" class="inp py-2 text-sm">
            <input name="motivo" placeholder="Motivo" class="inp py-2 text-sm"><button class="btn-ghost btn-sm">Agregar</button>
          </form>
        </div>
      </section>`;
    }).join('')}</div>`;
  $('#nuevoEmpleado').onsubmit = async (e) => {
    e.preventDefault();
    const { data, error } = await supabase.from('empleados').insert({ negocio_id: n.id, nombre: e.target.nombre.value.trim() }).select().single();
    if (error) return toast(error.message, 'error');
    st.empleados.push(data);
    vistaEquipo();
  };
  $$('[data-emp]').forEach((sec) => {
    const id = sec.dataset.emp;
    const f = sec.querySelector('[data-form-emp]');
    f.propio.onchange = () => sec.querySelector('[data-horario]').classList.toggle('hidden', !f.propio.checked);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const dias = $$('[name=dias]:checked', f).map((x) => Number(x.value));
      if (f.propio.checked && (!dias.length || f.cierre.value <= f.apertura.value)) return toast('Revisa los días y el horario', 'error');
      const cambios = f.propio.checked
        ? { nombre: f.nombre.value.trim(), dias_laborales: dias, hora_apertura: f.apertura.value, hora_cierre: f.cierre.value }
        : { nombre: f.nombre.value.trim(), dias_laborales: null, hora_apertura: null, hora_cierre: null };
      const { data, error } = await supabase.from('empleados').update(cambios).eq('id', id).select().single();
      if (error) return toast(error.message, 'error');
      st.empleados = st.empleados.map((x) => (x.id === id ? data : x));
      toast('Guardado');
    };
    sec.querySelector('[data-borrar-emp]').onclick = async () => {
      if (!confirm('¿Quitar a esta persona? Sus citas también se borrarán.')) return;
      const { error } = await supabase.from('empleados').delete().eq('id', id);
      if (error) return toast(error.message, 'error');
      st.empleados = st.empleados.filter((x) => x.id !== id);
      vistaEquipo();
    };
    sec.querySelector('[data-form-aus]').onsubmit = async (e) => {
      e.preventDefault();
      const fa = e.target;
      if (fa.hasta.value < fa.desde.value) return toast('La fecha final debe ser después de la inicial', 'error');
      const { error } = await supabase.from('ausencias').insert({ empleado_id: id, desde: fa.desde.value, hasta: fa.hasta.value, motivo: fa.motivo.value.trim() || null });
      if (error) return toast(error.message, 'error');
      vistaEquipo();
    };
    sec.onclick = async (e) => {
      const b = e.target.closest('[data-borrar-aus]');
      if (!b) return;
      await supabase.from('ausencias').delete().eq('id', b.dataset.borrarAus);
      vistaEquipo();
    };
  });
}

// ---------- AJUSTES ----------
function vistaAjustes() {
  const n = st.negocio;
  const esLista = CATEGORIAS.includes(n.categoria);
  const link = `${location.origin}/${n.slug}`;
  const filaMetodo = (m = { tipo: '', datos: '' }) => `<div class="metodo grid grid-cols-[8rem_1fr_auto] gap-2"><input class="inp py-2 text-sm" data-m="tipo" value="${esc(m.tipo)}" placeholder="Pago móvil" list="tiposPago"><input class="inp py-2 text-sm" data-m="datos" value="${esc(m.datos)}" placeholder="Banco · teléfono · cédula"><button type="button" class="btn-ghost btn-sm quitar-metodo">✕</button></div>`;
  $('#vista').innerHTML = `
    <section class="card flex flex-wrap items-center gap-3 p-5">
      <div class="min-w-0 flex-1"><p class="text-xs font-semibold uppercase tracking-wider text-zinc-500">Tu link de reservas</p><p class="truncate font-mono text-brand">${esc(link)}</p></div>
      <button data-copiar-link class="btn-brand btn-sm">Copiar</button><a href="${esc(link)}" target="_blank" class="btn-ghost btn-sm">Abrir</a>
    </section>
    <form id="formAjustes" class="mt-5 grid gap-5 lg:grid-cols-2">
      <section class="card space-y-4 p-5">
        <h2 class="font-display text-lg font-bold">Negocio</h2>
        <label class="block"><span class="lbl">Nombre</span><input name="nombre" required value="${esc(n.nombre)}" class="inp"></label>
        <div class="grid grid-cols-2 gap-3">
          <label class="block"><span class="lbl">Rubro</span><select name="categoria" class="inp">${[...CATEGORIAS, 'Otra'].map((c) => `<option ${c === (esLista ? n.categoria : 'Otra') ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
          <label class="block ${esLista ? 'hidden' : ''}" data-custom><span class="lbl">¿Cuál?</span><input name="categoria_custom" value="${esLista ? '' : esc(n.categoria)}" class="inp"></label>
        </div>
        <label class="block"><span class="lbl">Link</span><div class="flex items-center rounded-2xl border border-zinc-700 bg-zinc-900 pl-4"><span class="shrink-0 text-sm text-zinc-500">${location.host}/</span><input name="slug" required value="${esc(n.slug)}" class="w-full bg-transparent py-3 pr-4 font-mono text-sm outline-none"></div></label>
        <div class="grid grid-cols-[6rem_1fr_auto] items-end gap-3">
          <label class="block"><span class="lbl">Iniciales</span><input name="logo_texto" maxlength="3" value="${esc(n.logo_texto ?? '')}" class="inp text-center font-display font-extrabold uppercase"></label>
          <label class="block"><span class="lbl">Color</span><input name="color_marca" type="color" value="${n.color_marca}" class="h-12 w-full cursor-pointer rounded-2xl border border-zinc-700 bg-transparent"></label>
        </div>
        <div><span class="lbl">Logo</span><div class="flex flex-wrap items-center gap-3">${insigniaNegocio(n, 'h-16 w-16 text-xl')}
          <label class="btn-ghost btn-sm cursor-pointer">${n.logo_url ? 'Cambiar imagen' : 'Subir imagen'}<input id="logoArchivo" type="file" accept="image/png,image/jpeg,image/webp" class="sr-only"></label>
          ${n.logo_url ? '<button type="button" id="logoQuitar" class="btn-ghost btn-sm text-red-500">Quitar imagen</button>' : ''}
          <span class="w-full text-xs text-zinc-500">PNG, JPG o WEBP. Se reduce automáticamente para que cargue rápido.</span></div></div>
        <label class="block"><span class="lbl">WhatsApp</span><input name="whatsapp" required value="${esc(n.whatsapp ?? '')}" class="inp"></label>
        <label class="block"><span class="lbl">Instagram</span><input name="instagram" value="${esc(n.instagram ?? '')}" class="inp" placeholder="tunegocio"></label>
        <label class="block"><span class="lbl">Dirección</span><input name="direccion" value="${esc(n.direccion ?? '')}" class="inp"></label>
      </section>
      <div class="space-y-5">
        <section class="card space-y-4 p-5">
          <h2 class="font-display text-lg font-bold">Horario</h2>
          <div class="flex flex-wrap gap-2">${chipsDias(n.dias_laborales, 'dias')}</div>
          <div class="grid grid-cols-2 gap-3"><label class="block"><span class="lbl">Abre</span><input name="hora_apertura" type="time" value="${n.hora_apertura.slice(0, 5)}" class="inp"></label><label class="block"><span class="lbl">Cierra</span><input name="hora_cierre" type="time" value="${n.hora_cierre.slice(0, 5)}" class="inp"></label></div>
          <div class="grid grid-cols-2 gap-3">
            <label class="block"><span class="lbl">Turnos cada (min)</span><input name="intervalo_minutos" type="number" min="5" max="240" step="5" value="${n.intervalo_minutos}" class="inp"></label>
            <label class="block"><span class="lbl">Tiempo muerto (min)</span><input name="buffer_minutos" type="number" min="0" max="240" step="5" value="${n.buffer_minutos}" class="inp"></label>
          </div>
          <label class="block"><span class="lbl">Liberar citas sin pago aprobado después de</span><select name="liberar_horas" class="inp">${[[0, 'Nunca'], [1, '1 hora'], [2, '2 horas'], [6, '6 horas'], [12, '12 horas'], [24, '24 horas']].map(([v, t]) => `<option value="${v}" ${v === n.liberar_horas ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
        </section>
        <section class="card space-y-4 p-5">
          <h2 class="font-display text-lg font-bold">Cobros</h2>
          <label class="block"><span class="lbl">Tasa (Bs por $) · déjala vacía para no mostrar Bs</span><input name="tasa_bs" type="number" min="0" step="0.01" value="${n.tasa_bs ?? ''}" class="inp"></label>
          <div><span class="lbl">Métodos de pago que verá el cliente</span><div id="metodos" class="space-y-2">${(n.metodos_pago || []).map(filaMetodo).join('')}</div>
            <button type="button" id="masMetodo" class="btn-ghost btn-sm mt-2">+ Agregar método</button>
            <datalist id="tiposPago"><option>Pago móvil</option><option>Transferencia</option><option>Zelle</option><option>Binance</option><option>Efectivo</option></datalist></div>
        </section>
      </div>
      <div class="lg:col-span-2"><button class="btn-brand w-full sm:w-auto">Guardar ajustes</button></div>
    </form>
    <section class="card mt-5 p-5 text-sm text-zinc-400"><p class="font-semibold text-zinc-200">Instala el panel en tu celular</p><p class="mt-1">En Chrome toca ⋮ → «Instalar app» o «Agregar a pantalla principal». En iPhone: Compartir → «Agregar a inicio».</p></section>`;
  const f = $('#formAjustes');
  f.categoria.onchange = () => $('[data-custom]').classList.toggle('hidden', f.categoria.value !== 'Otra');
  f.color_marca.oninput = () => aplicarMarca(f.color_marca.value);
  f.slug.oninput = () => { f.slug.value = slugify(f.slug.value, true); };
  f.slug.onblur = () => { f.slug.value = slugify(f.slug.value); };
  const guardarLogo = async (logo_url) => {
    const { data, error } = await supabase.from('negocios').update({ logo_url }).eq('id', n.id).select().single();
    if (error) return toast(error.message, 'error');
    st.negocio = data;
    st.negocios = st.negocios.map((x) => (x.id === data.id ? data : x));
    toast(logo_url ? 'Logo actualizado' : 'Logo quitado');
    render();
  };
  $('#logoArchivo').onchange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try { await guardarLogo(await subirLogo(await comprimirLogo(file), st.user.id, n.id)); } catch (err) { toast(err.message, 'error'); }
  };
  if ($('#logoQuitar')) $('#logoQuitar').onclick = () => guardarLogo(null);
  $('#masMetodo').onclick = () => $('#metodos').insertAdjacentHTML('beforeend', filaMetodo());
  $('#metodos').onclick = (e) => e.target.closest('.quitar-metodo')?.parentElement.remove();
  f.onsubmit = async (e) => {
    e.preventDefault();
    const dias = $$('[name=dias]:checked', f).map((x) => Number(x.value));
    if (!dias.length) return toast('Elige al menos un día', 'error');
    if (f.hora_cierre.value <= f.hora_apertura.value) return toast('La hora de cierre debe ser después de la apertura', 'error');
    f.slug.value = slugify(f.slug.value);
    if (!slugValido(f.slug.value)) return toast('El link debe tener de 3 a 40 letras, números o guiones', 'error');
    const cambios = {
      nombre: f.nombre.value.trim(),
      categoria: f.categoria.value === 'Otra' ? f.categoria_custom.value.trim() || 'Otro' : f.categoria.value,
      slug: f.slug.value,
      logo_texto: f.logo_texto.value.trim().toUpperCase() || null,
      color_marca: f.color_marca.value,
      whatsapp: f.whatsapp.value.trim(),
      instagram: f.instagram.value.trim().replace(/^@/, '') || null,
      direccion: f.direccion.value.trim() || null,
      dias_laborales: dias,
      hora_apertura: f.hora_apertura.value,
      hora_cierre: f.hora_cierre.value,
      intervalo_minutos: Number(f.intervalo_minutos.value),
      buffer_minutos: Number(f.buffer_minutos.value),
      liberar_horas: Number(f.liberar_horas.value),
      tasa_bs: f.tasa_bs.value === '' ? null : Number(f.tasa_bs.value),
      metodos_pago: $$('.metodo').map((m) => ({ tipo: $('[data-m=tipo]', m).value.trim(), datos: $('[data-m=datos]', m).value.trim() })).filter((m) => m.tipo && m.datos),
    };
    const { data, error } = await supabase.from('negocios').update(cambios).eq('id', n.id).select().single();
    if (error) return toast(error.code === '23505' ? 'Ese link ya está en uso' : error.message, 'error');
    st.negocio = data;
    st.negocios = st.negocios.map((x) => (x.id === data.id ? data : x));
    pintarSelector();
    toast('Ajustes guardados');
    vistaAjustes();
  };
}

// ---------- realtime ----------
function escucharRealtime() {
  if (st.canal) supabase.removeChannel(st.canal);
  st.canal = supabase.channel(`citas-${st.negocio.id}`)
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'citas', filter: `negocio_id=eq.${st.negocio.id}` }, (p) => avisar(p.new))
    .subscribe();
}

function avisar(c) {
  st.nuevas++;
  $('#badge').textContent = st.nuevas;
  $('#badge').classList.remove('hidden');
  const i = $('#campanaIcono');
  i.classList.remove('bell-ring');
  void i.getBoundingClientRect();
  i.classList.add('bell-ring');
  sonar();
  navigator.vibrate?.([120, 60, 120]);
  const txt = `${c.cliente_nombre} reservó ${fechaLarga(c.fecha_hora)} a las ${formatoHora(c.fecha_hora)}`;
  toast('🔔 Nueva reserva: ' + txt);
  const lista = $('#listaNotif');
  if (!lista.querySelector('[data-n]')) lista.innerHTML = '';
  lista.insertAdjacentHTML('afterbegin', `<li data-n class="rounded-2xl px-3 py-2.5 text-sm hover:bg-zinc-800">${esc(txt)}</li>`);
  const v = vistaActual();
  if ((v === 'hoy' && c.fecha_hora.slice(0, 10) === hoyISO()) || (v === 'agenda' && c.fecha_hora.slice(0, 10) === st.fechaAgenda)) render();
}

const guardado = st.negocios.find((n) => n.id === localStorage.getItem(NEGOCIO_KEY));
await seleccionar(guardado ?? st.negocios[0]);
