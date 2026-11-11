import { supabase, $, esc, toast, aplicarMarca, requerirSesion, misNegocios, CATEGORIAS, NEGOCIO_KEY, dinero } from './lib.js';

const DIAS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const user = await requerirSesion();
let negocios = [];
let actual = null;

$('#categoria').innerHTML = [...CATEGORIAS, 'Custom'].map((c) => `<option value="${esc(c)}">${c === 'Custom' ? 'Otra (personalizada)' : esc(c)}</option>`).join('');
$('#dias').innerHTML = DIAS.map((d, i) => `<label class="cursor-pointer"><input type="checkbox" name="dias" value="${i}" class="peer sr-only"><span class="block rounded-lg border border-slate-300 px-3 py-1.5 peer-checked:border-brand peer-checked:bg-brand peer-checked:text-white">${d}</span></label>`).join('');

$('#categoria').onchange = () => {
  const custom = $('#categoria').value === 'Custom';
  $('#wrapCustom').classList.toggle('hidden', !custom);
  $('#categoriaCustom').required = custom;
};
$('#color').oninput = (e) => { $('#colorHex').textContent = e.target.value; aplicarMarca(e.target.value); };

function llenarFormulario(n) {
  const f = $('#formNegocio');
  f.nombre.value = n?.nombre ?? '';
  const esLista = !n || CATEGORIAS.includes(n.categoria);
  $('#categoria').value = esLista ? (n?.categoria ?? CATEGORIAS[0]) : 'Custom';
  $('#categoriaCustom').value = esLista ? '' : n.categoria;
  $('#categoria').onchange();
  f.color_marca.value = n?.color_marca ?? '#0ea5e9';
  $('#colorHex').textContent = f.color_marca.value;
  f.hora_apertura.value = (n?.hora_apertura ?? '09:00').slice(0, 5);
  f.hora_cierre.value = (n?.hora_cierre ?? '18:00').slice(0, 5);
  f.intervalo_minutos.value = n?.intervalo_minutos ?? 30;
  const dias = n?.dias_laborales ?? [1, 2, 3, 4, 5, 6];
  f.querySelectorAll('[name=dias]').forEach((c) => { c.checked = dias.includes(Number(c.value)); });
  aplicarMarca(f.color_marca.value);
  $('#tituloNegocio').textContent = n ? '1. Tu negocio' : '1. Crea tu negocio';
  $('#btnNegocio').textContent = n ? 'Guardar cambios' : 'Crear negocio';
  $('#btnNuevo').classList.toggle('hidden', !n);
  $('#resto').classList.toggle('hidden', !n);
}

function pintarSelector() {
  $('#selNegocio').innerHTML = negocios.map((n) => `<option value="${n.id}">${esc(n.nombre)}</option>`).join('') || '<option>Sin negocios</option>';
  if (actual) $('#selNegocio').value = actual.id;
}

async function seleccionar(n) {
  actual = n;
  if (n) localStorage.setItem(NEGOCIO_KEY, n.id);
  llenarFormulario(n);
  pintarSelector();
  if (!n) return;
  const link = `${location.origin}/booking.html?n=${n.id}`;
  $('#link').value = link;
  $('#abrir').href = link;
  await Promise.all([cargarEmpleados(), cargarServicios()]);
}

$('#selNegocio').onchange = (e) => seleccionar(negocios.find((n) => n.id === e.target.value));
$('#btnNuevo').onclick = () => { actual = null; llenarFormulario(null); };
$('#copiar').onclick = async () => { await navigator.clipboard.writeText($('#link').value); toast('Link copiado'); };

$('#formNegocio').onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const dias = f.getAll('dias').map(Number);
  if (!dias.length) return toast('Elige al menos un día de trabajo', 'error');
  if (f.get('hora_cierre') <= f.get('hora_apertura')) return toast('La hora de cierre debe ser después de la apertura', 'error');
  const datos = {
    nombre: f.get('nombre').trim(),
    categoria: f.get('categoria') === 'Custom' ? f.get('categoria_custom').trim() : f.get('categoria'),
    color_marca: f.get('color_marca'),
    hora_apertura: f.get('hora_apertura'),
    hora_cierre: f.get('hora_cierre'),
    intervalo_minutos: Number(f.get('intervalo_minutos')),
    dias_laborales: dias,
  };
  const q = actual ? supabase.from('negocios').update(datos).eq('id', actual.id) : supabase.from('negocios').insert(datos);
  const { data, error } = await q.select().single();
  if (error) return toast(error.message, 'error');
  negocios = actual ? negocios.map((n) => (n.id === data.id ? data : n)) : [...negocios, data];
  toast(actual ? 'Cambios guardados' : 'Negocio creado. Ahora agrega tu equipo y servicios');
  await seleccionar(data);
};

async function cargarEmpleados() {
  const { data } = await supabase.from('empleados').select('*').eq('negocio_id', actual.id).order('nombre');
  $('#empleados').innerHTML = data.map((e) => `<li class="flex items-center justify-between py-2.5"><span class="flex items-center gap-3"><span class="grid h-9 w-9 place-items-center rounded-full bg-brand/15 font-bold text-brand">${esc(e.nombre[0]?.toUpperCase())}</span>${esc(e.nombre)}</span><button data-del-emp="${e.id}" class="rounded-lg px-3 py-1 text-sm text-red-600 hover:bg-red-50">Quitar</button></li>`).join('') || '<li class="py-3 text-sm text-slate-500">Agrega al menos una persona que atienda.</li>';
}

async function cargarServicios() {
  const { data } = await supabase.from('servicios').select('*').eq('negocio_id', actual.id).order('nombre');
  $('#servicios').innerHTML = data.map((s) => `<li class="flex items-center justify-between gap-3 py-2.5"><span><b>${esc(s.nombre)}</b><span class="ml-2 text-sm text-slate-500">${s.duracion_minutos} min · ${dinero(s.precio)}</span></span><button data-del-srv="${s.id}" class="rounded-lg px-3 py-1 text-sm text-red-600 hover:bg-red-50">Quitar</button></li>`).join('') || '<li class="py-3 text-sm text-slate-500">Agrega los servicios que ofreces.</li>';
}

$('#formEmpleado').onsubmit = async (e) => {
  e.preventDefault();
  const { error } = await supabase.from('empleados').insert({ negocio_id: actual.id, nombre: e.target.nombre.value.trim() });
  if (error) return toast(error.message, 'error');
  e.target.reset();
  cargarEmpleados();
};

$('#formServicio').onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const { error } = await supabase.from('servicios').insert({ negocio_id: actual.id, nombre: f.get('nombre').trim(), duracion_minutos: Number(f.get('duracion_minutos')), precio: Number(f.get('precio')) });
  if (error) return toast(error.message, 'error');
  e.target.reset();
  cargarServicios();
};

document.addEventListener('click', async (e) => {
  const emp = e.target.closest('[data-del-emp]');
  const srv = e.target.closest('[data-del-srv]');
  if (!emp && !srv) return;
  if (!confirm(emp ? '¿Quitar este empleado? Sus citas también se borrarán.' : '¿Quitar este servicio?')) return;
  const { error } = emp
    ? await supabase.from('empleados').delete().eq('id', emp.dataset.delEmp)
    : await supabase.from('servicios').delete().eq('id', srv.dataset.delSrv);
  if (error) return toast(error.message, 'error');
  emp ? cargarEmpleados() : cargarServicios();
});

negocios = await misNegocios(user.id);
const guardado = negocios.find((n) => n.id === localStorage.getItem(NEGOCIO_KEY));
await seleccionar(guardado ?? negocios[0] ?? null);
