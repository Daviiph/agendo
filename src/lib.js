import { createClient } from '@supabase/supabase-js';
import './style.css';

export const APP_NOMBRE = 'Agendo';

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
);

export const CATEGORIAS = ['Barbería', 'Peluquería', 'Salón de belleza', 'Spa', 'Odontología', 'Consultorio médico', 'Fisioterapia', 'Psicología', 'Veterinaria', 'Estética', 'Uñas', 'Tatuajes'];

export const $ = (sel, root = document) => root.querySelector(sel);

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export function aplicarMarca(color) {
  document.documentElement.style.setProperty('--brand', color || '#0ea5e9');
}

export function toast(msg, tipo = 'ok') {
  let box = $('#toasts');
  if (!box) {
    box = document.createElement('div');
    box.id = 'toasts';
    box.className = 'no-print fixed top-4 inset-x-0 z-50 flex flex-col items-center gap-2 px-4 pointer-events-none';
    document.body.append(box);
  }
  const el = document.createElement('div');
  el.className = `toast pointer-events-auto max-w-sm w-full rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${tipo === 'error' ? 'bg-red-600 text-white' : 'bg-slate-900 text-white'}`;
  el.textContent = msg;
  box.append(el);
  setTimeout(() => el.remove(), 4500);
}

export async function requerirSesion() {
  const { data } = await supabase.auth.getSession();
  if (!data.session) {
    location.href = '/?next=' + encodeURIComponent(location.pathname);
    return null;
  }
  return data.session.user;
}

export const NEGOCIO_KEY = 'agendo_negocio_actual';

export async function misNegocios(userId) {
  const { data, error } = await supabase.from('negocios').select('*').eq('owner_id', userId).order('creado_en');
  if (error) throw error;
  return data;
}

export function hoyISO(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export const minutos = (hhmm) => { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; };
export const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(min % 60).padStart(2, '0')}`;

export function formatoHora(ts) {
  const [h, m] = ts.slice(11, 16).split(':').map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${h < 12 ? 'a. m.' : 'p. m.'}`;
}

export const dinero = (n) => '$' + Number(n).toFixed(2);

export function logoHTML(size = 'h-8 w-8') {
  return `<img src="/logo.svg" alt="" class="${size}">`;
}
