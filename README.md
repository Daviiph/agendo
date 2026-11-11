# Agendo

SaaS multi-negocio de reservas y CRM (barberías, consultorios, salones…). Vite + Vanilla JS + Tailwind v4 + Supabase.

- `index.html`: login / registro del dueño del negocio.
- `config.html`: negocio (nombre, categoría, color, horario), equipo y servicios.
- `booking.html?n=<negocio_id>`: reserva en 3 pasos para el cliente (mobile-first).
- `dashboard.html`: citas del día, verificación de pago, notas CRM, campana en tiempo real y PDF (`window.print()`).

## Desarrollo

```bash
cp .env.example .env   # URL y anon key de Supabase
npm install
npm run dev
```

## Base de datos

Ejecuta `supabase/schema.sql` en el SQL Editor de Supabase. Incluye RLS por dueño, la función `horarios_ocupados` (horarios sin datos de clientes) y la restricción `citas_sin_choque`, que impide en la base de datos dos citas cruzadas para el mismo empleado.
