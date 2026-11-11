import { supabase, $, piePagina, aplicarMarca } from './lib.js';

aplicarMarca();
const RUBROS = ['Barberías', 'Odontología', 'Uñas', 'Maquillaje', 'Peluquerías', 'Fisioterapia', 'Spa', 'Psicología', 'Estética', 'Veterinaria', 'Tatuajes', '¡y el tuyo!'];
$('#rubros').innerHTML = RUBROS.map((r) => `<span class="shrink-0 rounded-full bg-white/5 px-4 py-2 ring-1 ring-white/10">${r}</span>`).join('');

const FUNCIONES = [
  ['Reservas 24/7', 'Tu página de reservas trabaja mientras duermes, en 3 pasos y desde el celular.'],
  ['Cero choques', 'Cada empleado tiene su agenda. Si dos personas eligen la misma hora, solo una la obtiene.'],
  ['Tiempo muerto', 'Suma minutos entre citas para limpiar o esterilizar. La agenda se bloquea sola.'],
  ['Pagos por referencia', 'Pago móvil, Zelle o Binance: el cliente escribe la referencia y tú la apruebas. Sin capturas.'],
  ['Campana en vivo', 'Suena y vibra en tu panel apenas alguien reserva. Sin recargar.'],
  ['Ficha de clientes', 'Historial, visitas, gasto total y tus notas de cada atención.'],
  ['Reportes PDF', 'Imprime o guarda el reporte del día en blanco y negro con tu membrete.'],
  ['$ y Bs', 'Muestra tus precios en dólares y bolívares con tu propia tasa.'],
];
$('#funciones').innerHTML = FUNCIONES.map(([t, d]) => `<div class="card p-6"><span class="grid h-10 w-10 place-items-center rounded-2xl bg-brand/15 text-brand">✦</span><h3 class="mt-4 font-bold">${t}</h3><p class="mt-2 text-sm text-zinc-400">${d}</p></div>`).join('');

document.body.append(piePagina('border-t border-white/5'));
const { data } = await supabase.auth.getSession();
if (data.session) $('#navAcciones').innerHTML = '<a href="/dashboard" class="btn-brand btn-sm">Ir a mi panel</a>';
