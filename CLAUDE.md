# eglosa (antes Ellinikó) — instrucciones para Claude Code

- Lee `docs/PRD.md` antes de cada tarea. Trabaja por IDs de requisito (DIC-1, LEC-3…).
- App estática (PWA en GitHub Pages): sin backend, sin IA, sin claves.
- No cambies el formato de `public/dict/<lang>/dict.json.gz` sin actualizar el PRD («El diccionario», formato 2).
- Dos idiomas de estudio (griego `el`, español `es`) e interfaz en es/en/el (ver PRD «Idiomas»). Todo texto visible va por `t()` de `src/i18n/` con las tres lenguas.
- Tests obligatorios para normalización, búsqueda de formas, backup y FSRS (`npm test`).
- Identidad visual (MAR-1, MAR-2): el sistema de diseño «Eglosa» es la fuente de verdad; `src/styles.css` replica sus tokens. Fosforito solo para palabras en aprendizaje; el nombre siempre en minúscula.
- Cada idea nueva entra primero en la tabla de requisitos del PRD con su ID.

## Comandos
- `npm run dev` — servidor de desarrollo
- `npm run build:dict [-- --lang=el|es]` — regenera los diccionarios (descarga fuentes fijadas en `scripts/build-dict/sources.json` a `.cache/`; el español procesa ~2,7 GB)
- `npm run build:catalog [-- --lang=es]` — regenera el catálogo por nivel (`scripts/catalog/books.json` / `books.es.json` → `public/catalog/<lang>/`); `-- --survey` sólo mide
- `npm run sample:dict -- [--lang=es] [--ui=en] έγραψα δω` — muestra búsquedas
- `npm run coverage:text -- archivo.txt [--lang=es] --missing` — cobertura del diccionario sobre un texto
- `node scripts/icons.mjs` — regenera favicon e iconos de la PWA desde el símbolo (MAR-1)
- `npm test` (Vitest) · `npm run test:e2e` (Playwright, prueba de humo) · `npm run build`

## Estructura
- `src/lib/langs.ts` (idiomas), `src/profile.ts` (perfil elegido, base de datos por idioma), `src/i18n/` (mensajes).
- `src/lib/normalize.ts`, `lookup.ts`, `text.ts` — lógica pura, compartida con `scripts/build-dict` (Node ejecuta TS directamente, por eso los imports llevan `.ts`).
- `src/db.ts` — esquema Dexie. `src/lib/*` — EPUB, backup, FSRS, CSV, Kindle, TTS.
- `src/screens/*` — pantallas Preact. Enrutado por hash (`#/leer/<bookId>`).
