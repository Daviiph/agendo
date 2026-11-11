import { supabase, $, toast, aplicarMarca } from './lib.js';

aplicarMarca();
let registro = false;
const destino = () => new URLSearchParams(location.search).get('next') || '/dashboard.html';

const { data } = await supabase.auth.getSession();
if (data.session) location.href = destino();

$('#cambiar').onclick = () => {
  registro = !registro;
  $('#titulo').textContent = registro ? 'Crea tu cuenta' : 'Entrar al panel';
  $('#btn').textContent = registro ? 'Crear cuenta' : 'Entrar';
  $('#pregunta').textContent = registro ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?';
  $('#cambiar').textContent = registro ? 'Entrar' : 'Crear cuenta';
};

$('#form').onsubmit = async (e) => {
  e.preventDefault();
  const f = new FormData(e.target);
  const cred = { email: f.get('email'), password: f.get('password') };
  $('#btn').disabled = true;
  const { data, error } = registro ? await supabase.auth.signUp(cred) : await supabase.auth.signInWithPassword(cred);
  $('#btn').disabled = false;
  if (error) return toast(error.message === 'Invalid login credentials' ? 'Correo o contraseña incorrectos' : error.message, 'error');
  if (!data.session) return toast('Revisa tu correo para confirmar la cuenta');
  location.href = registro ? '/config.html' : destino();
};
