import { supabase, $, toast, aplicarMarca, piePagina } from './lib.js';

aplicarMarca();
document.body.append(piePagina());
const destino = () => new URLSearchParams(location.search).get('next') || '/dashboard';
const { data } = await supabase.auth.getSession();
if (data.session) location.href = destino();

$('#form').onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  $('#btn').disabled = true;
  const { error } = await supabase.auth.signInWithPassword({ email: f.get('email').trim(), password: f.get('password') });
  $('#btn').disabled = false;
  if (error) return toast(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message, 'error');
  location.href = destino();
};
