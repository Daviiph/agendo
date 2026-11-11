import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import { resolve } from 'node:path';

export default defineConfig({
  plugins: [tailwindcss()],
  build: {
    target: 'es2022',
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html'),
        login: resolve(__dirname, 'login.html'),
        registro: resolve(__dirname, 'registro.html'),
        privacidad: resolve(__dirname, 'privacidad.html'),
        booking: resolve(__dirname, 'booking.html'),
        dashboard: resolve(__dirname, 'dashboard.html'),
      },
    },
  },
});
