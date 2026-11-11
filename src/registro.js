import { supabase, $, $$, esc, toast, aplicarMarca, misNegocios, CATEGORIAS, DIAS, NEGOCIO_KEY, slugify, slugValido, iniciales, waLink, piePagina } from './lib.js';

aplicarMarca();
const PALETA = ['#f97316', '#ef4444', '#ec4899', '#a855f7', '#6366f1', '#0ea5e9', '#14b8a6', '#22c55e', '#eab308', '#a3a3a3'];
const nuevo = new URLSearchParams(location.search).has('nuevo');
let { data: { session } } = await supabase.auth.getSession();
if (session && !nuevo && (await misNegocios(session.user.id)).length) location.href = '/dashboard';

const PASOS = [...(session ? [] : ['cuenta']), 'negocio', 'marca', 'horario', 'servicio', 'listo'];
let i = 0;
let rubro = CATEGORIAS[0];
let slugTocado = false;
let slugLibre = false;
let creado = null;

$('#dominio').textContent = location.host + '/';
$('#rubros').innerHTML = [...CATEGORIAS, 'Otra'].map((c) => `<button type="button" data-rubro="${esc(c)}" class="chip ${c === rubro ? 'chip-on' : ''}">${c === 'Otra' ? '+ Otra' : esc(c)}</button>`).join('');
$('#paleta').innerHTML = PALETA.map((c) => `<button type="button" data-color="${c}" class="h-12 w-12 rounded-2xl ring-2 ring-transparent ring-offset-2 ring-offset-zinc-950 transition" style="background:${c}" aria-label="${c}"></button>`).join('');
$('#dias').innerHTML = DIAS.map((d, n) => `<label><input type="checkbox" value="${n}" class="peer sr-only" ${n ? 'checked' : ''}><span class="chip block">${d}</span></label>`).join('');

function filaEmpleado(valor = '') {
  const div = document.createElement('div');
  div.className = 'flex gap-2';
  div.innerHTML = `<input class="inp emp" placeholder="Nombre" value="${esc(valor)}"><button type="button" class="btn-ghost btn-sm shrink-0 quitar" aria-label="Quitar">✕</button>`;
  div.querySelector('.quitar').onclick = () => { if ($$('.emp').length > 1) div.remove(); };
  $('#equipo').append(div);
}
filaEmpleado('');
$('#masEmpleado').onclick = () => filaEmpleado();

function marcarColor(c) {
  $('#color').value = c;
  aplicarMarca(c);
  $$('[data-color]').forEach((b) => b.classList.toggle('ring-white', b.dataset.color === c));
}
marcarColor(PALETA[0]);
$('#paleta').onclick = (e) => { const b = e.target.closest('[data-color]'); if (b) marcarColor(b.dataset.color); };
$('#color').oninput = (e) => marcarColor(e.target.value);

$('#rubros').onclick = (e) => {
  const b = e.target.closest('[data-rubro]');
  if (!b) return;
  rubro = b.dataset.rubro;
  $$('[data-rubro]').forEach((x) => x.classList.toggle('chip-on', x === b));
  $('#rubroCustom').classList.toggle('hidden', rubro !== 'Otra');
  if (rubro === 'Otra') $('#rubroCustom').focus();
};

let tSlug;
async function revisarSlug() {
  const s = $('#slug').value;
  slugLibre = false;
  if (!slugValido(s)) { $('#slugEstado').textContent = 'Usa de 3 a 40 letras minúsculas, números o guiones.'; $('#slugEstado').className = 'mt-1.5 block text-xs text-amber-400'; return; }
  $('#slugEstado').textContent = 'Revisando…';
  const { data } = await supabase.from('negocios').select('id').eq('slug', s).maybeSingle();
  if (s !== $('#slug').value) return;
  slugLibre = !data;
  $('#slugEstado').textContent = slugLibre ? '✓ Disponible' : 'Ese link ya está en uso, prueba otro.';
  $('#slugEstado').className = `mt-1.5 block text-xs ${slugLibre ? 'text-emerald-400' : 'text-red-400'}`;
}
const programarSlug = () => { clearTimeout(tSlug); tSlug = setTimeout(revisarSlug, 350); };
$('#nombre').oninput = () => {
  if (!slugTocado) { $('#slug').value = slugify($('#nombre').value); programarSlug(); }
  if (!$('#logoTexto').dataset.tocado) $('#logoTexto').value = iniciales($('#nombre').value);
};
$('#slug').oninput = () => { slugTocado = true; $('#slug').value = slugify($('#slug').value); programarSlug(); };
$('#logoTexto').oninput = () => { $('#logoTexto').dataset.tocado = '1'; };

const rubroFinal = () => (rubro === 'Otra' ? $('#rubroCustom').value.trim() : rubro);

async function validar(paso) {
  if (paso === 'cuenta') {
    const email = $('#email').value.trim();
    const password = $('#password').value;
    if (!/^\S+@\S+\.\S+$/.test(email)) return toast('Escribe un correo válido', 'error');
    if (password.length < 6) return toast('La contraseña debe tener al menos 6 caracteres', 'error');
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return toast(error.message.includes('already') ? 'Ese correo ya tiene cuenta. Entra con tu contraseña.' : error.message, 'error');
    if (!data.session) return toast('Revisa tu correo para confirmar la cuenta', 'error');
    session = data.session;
    return true;
  }
  if (paso === 'negocio') {
    if (!$('#nombre').value.trim()) return toast('Escribe el nombre del negocio', 'error');
    if (!rubroFinal()) return toast('Escribe tu rubro', 'error');
    await revisarSlug();
    if (!slugLibre) return toast('Elige un link disponible', 'error');
    if ($('#whatsapp').value.replace(/\D/g, '').length < 10) return toast('Escribe el WhatsApp del negocio', 'error');
    $('#prevLogo').textContent = ($('#logoTexto').value || iniciales($('#nombre').value)).toUpperCase();
    $('#prevNombre').textContent = $('#nombre').value.trim();
    $('#prevRubro').textContent = rubroFinal();
    return true;
  }
  if (paso === 'horario') {
    if (!$$('#dias input:checked').length) return toast('Elige al menos un día', 'error');
    if ($('#cierre').value <= $('#apertura').value) return toast('La hora de cierre debe ser después de la apertura', 'error');
    return true;
  }
  if (paso === 'servicio') {
    const empleados = $$('.emp').map((x) => x.value.trim()).filter(Boolean);
    if (!$('#srvNombre').value.trim()) return toast('Escribe el nombre del servicio', 'error');
    if ($('#srvPrecio').value === '' || Number($('#srvPrecio').value) < 0) return toast('Escribe el precio', 'error');
    if (!empleados.length) return toast('Escribe quién atiende', 'error');
    return crear(empleados);
  }
  return true;
}

async function crear(empleados) {
  const { data: n, error } = await supabase.from('negocios').insert({
    nombre: $('#nombre').value.trim(),
    categoria: rubroFinal(),
    slug: $('#slug').value,
    logo_texto: ($('#logoTexto').value || iniciales($('#nombre').value)).toUpperCase(),
    whatsapp: $('#whatsapp').value.trim(),
    instagram: $('#instagram').value.trim().replace(/^@/, '') || null,
    direccion: $('#direccion').value.trim() || null,
    color_marca: $('#color').value,
    dias_laborales: $$('#dias input:checked').map((x) => Number(x.value)),
    hora_apertura: $('#apertura').value,
    hora_cierre: $('#cierre').value,
    intervalo_minutos: Number($('#intervalo').value),
    buffer_minutos: Number($('#buffer').value),
  }).select().single();
  if (error) return toast(error.code === '23505' ? 'Ese link ya está en uso, cámbialo.' : error.message, 'error');
  const r = await Promise.all([
    supabase.from('empleados').insert(empleados.map((nombre) => ({ negocio_id: n.id, nombre }))),
    supabase.from('servicios').insert({ negocio_id: n.id, nombre: $('#srvNombre').value.trim(), duracion_minutos: Number($('#srvDuracion').value), precio: Number($('#srvPrecio').value) }),
  ]);
  const err = r.find((x) => x.error);
  if (err) return toast(err.error.message, 'error');
  localStorage.setItem(NEGOCIO_KEY, n.id);
  creado = n;
  const link = `${location.origin}/${n.slug}`;
  $('#linkFinal').textContent = link;
  $('#verPagina').href = link;
  $('#compartir').href = waLink(n.whatsapp, `¡Ya puedes reservar tu cita en ${n.nombre} desde aquí! ${link}`);
  $('#copiar').onclick = async () => { await navigator.clipboard.writeText(link); toast('Link copiado'); };
  return true;
}

function mostrar() {
  const paso = PASOS[i];
  $$('[data-paso]').forEach((s) => s.classList.toggle('hidden', s.dataset.paso !== paso));
  $('#progreso').style.width = `${((i + 1) / PASOS.length) * 100}%`;
  $('#contador').textContent = paso === 'listo' ? '' : `Paso ${i + 1} de ${PASOS.length - 1}`;
  $('#atras').classList.toggle('hidden', i === 0 || paso === 'listo');
  $('#barra').classList.toggle('hidden', paso === 'listo');
  $('#siguiente').textContent = paso === 'servicio' ? 'Crear mi negocio' : 'Continuar';
  scrollTo({ top: 0, behavior: 'smooth' });
  $(`[data-paso="${paso}"] input`)?.focus({ preventScroll: true });
}

$('#atras').onclick = () => { i--; mostrar(); };
$('#siguiente').onclick = async () => {
  $('#siguiente').disabled = true;
  const ok = await validar(PASOS[i]).catch((e) => toast(e.message, 'error'));
  $('#siguiente').disabled = false;
  if (ok === true) { i++; mostrar(); }
};
document.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('input') && PASOS[i] !== 'listo') $('#siguiente').click(); });

document.body.append(piePagina());
mostrar();
