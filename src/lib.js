import { createClient } from '@supabase/supabase-js';
import './style.css';

export const APP_NOMBRE = 'Agendo';
export const FIRMA = 'Plataforma desarrollada por Orangel Gonzalez';
export const COLOR_APP = '#f97316';

export const supabase = createClient(import.meta.env.VITE_SUPABASE_URL, import.meta.env.VITE_SUPABASE_ANON_KEY);

export const CATEGORIAS = ['Barbería', 'Peluquería', 'Uñas', 'Maquillaje', 'Odontología', 'Consultorio médico', 'Fisioterapia', 'Psicología', 'Spa', 'Estética', 'Veterinaria', 'Tatuajes'];
export const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
export const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
export const SLUG_RESERVADOS = ['app', 'login', 'registro', 'dashboard', 'booking', 'privacidad', 'assets', 'api', 'admin', 'index', 'sw', 'manifest', 'logo', 'icon', 'config'];
export const METODOS_BASE = ['Efectivo', 'Pago móvil', 'Transferencia', 'Binance', 'Zelle'];
export function metodosDe(negocio) {
  const propios = (negocio?.metodos_pago || []).map((m) => m.tipo).filter(Boolean);
  return propios.length ? [...new Set(['Efectivo', ...propios])] : METODOS_BASE;
}
export const esEfectivo = (m) => /efectivo|cash/i.test(m || '');
export const NEGOCIO_KEY = 'agendo_negocio_actual';

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function aplicarMarca(color) {
  document.documentElement.style.setProperty('--brand', color || COLOR_APP);
}

export function toast(msg, tipo = 'ok') {
  let box = $('#toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    box.className = 'no-print fixed top-4 inset-x-0 z-[60] flex flex-col items-center gap-2 px-4 pointer-events-none';
    document.body.append(box);
  }
  const el = document.createElement('div');
  el.className = `toast pointer-events-auto w-full max-w-sm rounded-2xl px-4 py-3 text-sm font-medium shadow-2xl ring-1 ${tipo === 'error' ? 'bg-red-600 text-white ring-red-400/40' : 'bg-zinc-900 text-white ring-white/10'}`;
  el.textContent = msg;
  box.append(el);
  setTimeout(() => el.remove(), 5000);
}

export async function requerirSesion() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    location.href = '/login?next=' + encodeURIComponent(location.pathname + location.search + location.hash);
    await new Promise(() => {});
  }
  return data.session.user;
}

export async function misNegocios(userId) {
  const { data, error } = await supabase.from('negocios').select('*').eq('owner_id', userId).order('creado_en');
  if (error) throw error;
  return data;
}

const p2 = (n) => String(n).padStart(2, '0');
export const hoyISO = (d = new Date()) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const sumarDias = (iso, n) => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() + n); return hoyISO(d); };
export const minutos = (t) => { const [h, m] = t.slice(0, 5).split(':').map(Number); return h * 60 + m; };
export const hhmm = (min) => `${p2(Math.floor(min / 60))}:${p2(min % 60)}`;
export function hora12(t) {
  const [h, m] = t.slice(0, 5).split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${p2(m)} ${h < 12 ? 'am' : 'pm'}`;
}
export const formatoHora = (ts) => hora12(ts.slice(11, 16));
export function fechaLarga(iso) {
  const d = new Date(iso.slice(0, 10) + 'T12:00:00');
  return `${DIAS[d.getDay()]} ${d.getDate()} ${MESES[d.getMonth()]}`;
}
export const dinero = (n) => '$' + Number(n || 0).toFixed(2);
export const bs = (n, tasa) => (tasa ? 'Bs ' + (Number(n) * Number(tasa)).toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '');

export function slugify(t, escribiendo = false) {
  const s = String(t).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+/, '').slice(0, 40);
  return escribiendo ? s : s.replace(/-+$/, '');
}
export const slugValido = (s) => /^[a-z0-9][a-z0-9-]{1,38}[a-z0-9]$/.test(s) && !SLUG_RESERVADOS.includes(s);
export const iniciales = (t) => String(t).trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? '').join('');

export function waLink(numero, texto = '') {
  let d = String(numero || '').replace(/\D/g, '');
  if (d.startsWith('0')) d = '58' + d.slice(1);
  else if (d.length === 10 && d.startsWith('4')) d = '58' + d;
  return `https://wa.me/${d}${texto ? '?text=' + encodeURIComponent(texto) : ''}`;
}

export function horarioDe(negocio, empleado) {
  return {
    apertura: (empleado?.hora_apertura || negocio.hora_apertura).slice(0, 5),
    cierre: (empleado?.hora_cierre || negocio.hora_cierre).slice(0, 5),
    dias: empleado?.dias_laborales?.length ? empleado.dias_laborales : negocio.dias_laborales,
  };
}

export function calcularSlots({ apertura, cierre, intervalo, duracion, buffer = 0, ocupados, desdeMin = 0 }) {
  const libres = [];
  for (let ini = minutos(apertura); ini + duracion <= minutos(cierre); ini += intervalo) {
    const fin = ini + duracion + buffer;
    if (ini < desdeMin) continue;
    if (ocupados.some((o) => ini < o.fin && fin > o.ini)) continue;
    libres.push(ini);
  }
  return libres;
}

export async function slotsLibres({ negocio, empleado, servicio, fecha, ignorar = null }) {
  const h = horarioDe(negocio, empleado);
  if (!h.dias.includes(new Date(fecha + 'T12:00:00').getDay())) return [];
  const { data, error } = await supabase.rpc('horarios_ocupados', { p_empleado: empleado.id, p_fecha: fecha });
  if (error) throw error;
  const aMin = (ts) => (ts.slice(0, 10) < fecha ? 0 : ts.slice(0, 10) > fecha ? 1440 : minutos(ts.slice(11, 16)));
  const ocupados = data
    .filter((o) => !(ignorar && o.inicio.slice(0, 16) === ignorar.slice(0, 16)))
    .map((o) => ({ ini: aMin(o.inicio), fin: aMin(o.fin) }));
  const ahora = new Date();
  const desdeMin = fecha === hoyISO() ? ahora.getHours() * 60 + ahora.getMinutes() + 1 : fecha < hoyISO() ? 1441 : 0;
  return calcularSlots({ ...h, intervalo: negocio.intervalo_minutos, duracion: servicio.duracion_minutos, buffer: negocio.buffer_minutos || 0, ocupados, desdeMin }).map(hhmm);
}

export async function comprimirLogo(file, lado = 320) {
  if (!file?.type?.startsWith('image/')) throw new Error('Elige una imagen (PNG, JPG o WEBP)');
  const img = await createImageBitmap(file);
  const k = Math.min(1, lado / Math.max(img.width, img.height));
  const c = Object.assign(document.createElement('canvas'), { width: Math.round(img.width * k), height: Math.round(img.height * k) });
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  const blob = await new Promise((r) => c.toBlob(r, 'image/webp', 0.85));
  if (!blob) throw new Error('No se pudo procesar la imagen');
  return blob;
}

export async function subirLogo(blob, userId, negocioId) {
  const ruta = `${userId}/${negocioId}-${Date.now()}.webp`;
  const { error } = await supabase.storage.from('agendo-logos').upload(ruta, blob, { contentType: 'image/webp', upsert: true });
  if (error) throw error;
  return supabase.storage.from('agendo-logos').getPublicUrl(ruta).data.publicUrl;
}

let audio;
export function sonar() {
  try {
    audio ??= new AudioContext();
    const t = audio.currentTime;
    [880, 1320].forEach((f, i) => {
      const o = audio.createOscillator();
      const g = audio.createGain();
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t + i * 0.18);
      g.gain.exponentialRampToValueAtTime(0.3, t + i * 0.18 + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + i * 0.18 + 0.5);
      o.connect(g).connect(audio.destination);
      o.start(t + i * 0.18);
      o.stop(t + i * 0.18 + 0.55);
    });
  } catch { /* sin audio */ }
}
document.addEventListener('pointerdown', () => { try { audio ??= new AudioContext(); audio.resume(); } catch { /* */ } }, { once: true });

export function insigniaNegocio(n, cls = 'h-12 w-12 text-lg') {
  if (n?.logo_url) return `<img src="${esc(n.logo_url)}" alt="${esc(n.nombre)}" class="${cls} shrink-0 rounded-2xl bg-white object-cover shadow-lg shadow-black/10">`;
  return `<span class="grid ${cls} shrink-0 place-items-center rounded-2xl bg-brand font-display font-extrabold text-white shadow-lg shadow-brand/30">${esc(n?.logo_texto || iniciales(n?.nombre || 'A'))}</span>`;
}

const ICONOS = {
  hoy: '<path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/><circle cx="12" cy="12" r="4"/>',
  agenda: '<rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  clientes: '<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/>',
  servicios: '<path d="M12 2l3 7h7l-5.5 4.5 2 7.5-6.5-4.5L5.5 21l2-7.5L2 9h7z"/>',
  equipo: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
  ajustes: '<path d="M12.2 2h-.4a2 2 0 0 0-2 2v.2a2 2 0 0 1-1 1.7l-.4.3a2 2 0 0 1-2 0l-.2-.1a2 2 0 0 0-2.7.7l-.2.4a2 2 0 0 0 .7 2.7l.2.1a2 2 0 0 1 1 1.7v.6a2 2 0 0 1-1 1.7l-.2.1a2 2 0 0 0-.7 2.7l.2.4a2 2 0 0 0 2.7.7l.2-.1a2 2 0 0 1 2 0l.4.3a2 2 0 0 1 1 1.7v.2a2 2 0 0 0 2 2h.4a2 2 0 0 0 2-2v-.2a2 2 0 0 1 1-1.7l.4-.3a2 2 0 0 1 2 0l.2.1a2 2 0 0 0 2.7-.7l.2-.4a2 2 0 0 0-.7-2.7l-.2-.1a2 2 0 0 1-1-1.7v-.6a2 2 0 0 1 1-1.7l.2-.1a2 2 0 0 0 .7-2.7l-.2-.4a2 2 0 0 0-2.7-.7l-.2.1a2 2 0 0 1-2 0l-.4-.3a2 2 0 0 1-1-1.7V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  campana: '<path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>',
  salir: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/>',
  imprimir: '<path d="M6 9V2h12v7M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>',
  whatsapp: '<path d="M3 21l1.7-5A9 9 0 1 1 8 19.3z"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/>',
  dinero: '<path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  flecha: '<path d="M5 12h14M13 5l7 7-7 7"/>',
  instagram: '<rect x="2" y="2" width="20" height="20" rx="5"/><circle cx="12" cy="12" r="4"/><path d="M17.5 6.5h.01"/>',
  mas: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  link: '<path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.8 1.7"/><path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  izq: '<path d="m15 18-6-6 6-6"/>',
  der: '<path d="m9 18 6-6-6-6"/>',
};
export const icono = (n, cls = 'h-5 w-5') => `<svg viewBox="0 0 24 24" class="${cls}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONOS[n] || ''}</svg>`;

export function piePagina(cls = '') {
  const f = document.createElement('footer');
  f.className = `py-6 text-center text-xs text-zinc-500 ${cls}`;
  f.innerHTML = `${FIRMA} · <a href="/privacidad" class="underline decoration-zinc-700 underline-offset-2 hover:text-zinc-300">Privacidad</a>`;
  return f;
}
