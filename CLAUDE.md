# ShareBuy — reglas para Claude

## Stack
React 19 + Vite 8 + Tailwind v4 (@tailwindcss/vite) + Supabase (supabase-js v2) + react-router-dom v7 + framer-motion.
Comandos: `npm run dev`, `npm run build`, `npm run lint`.
Código en `src/` (pages, components, hooks, lib). Migraciones en `supabase/migrations/`.

## Contexto
PWA mobile-first, proyecto de portfolio. El código y el historial de git tienen que quedar prolijos.
Objetivo actual: mejorar performance y escalabilidad SIN cambiar de stack.

## Reglas
- Un commit por cambio lógico, Conventional Commits en inglés (feat/fix/perf/refactor/chore).
- Todo cambio de DB va en `supabase/migrations/NNN_nombre.sql`, idempotente, con rollback en comentario. Numerar desde 002.
- NO tocar `.env` ni hardcodear claves.
- No cambiar el diseño visual ni el comportamiento de StoryViewer / pull-to-refresh salvo que la tarea lo pida.
- Explicar cada cambio importante en 3 líneas máximo (el dueño del proyecto está aprendiendo).
- No avanzar a la fase siguiente sin que el usuario diga "dale".

## Verificación
Después de cada fase: `npm run build` y `npm run lint` sin errores, y un resumen de 5 líneas de lo que cambió.
