# Ellinikó — instrucciones para Claude Code

- Lee `docs/PRD.md` antes de cada tarea. Trabaja por IDs de requisito (DIC-1, LEC-3…).
- App estática (PWA en GitHub Pages): sin backend, sin IA, sin claves.
- No cambies el formato de `public/dict/dict.json.gz` sin actualizar el PRD («El diccionario»).
- Tests obligatorios para normalización, búsqueda de formas, backup y FSRS (`npm test`).
- Cada idea nueva entra primero en la tabla de requisitos del PRD con su ID.

## Comandos
- `npm run dev` — servidor de desarrollo
- `npm run build:dict` — regenera el diccionario (descarga fuentes fijadas en `scripts/build-dict/sources.json` a `.cache/`)
- `npm run build:catalog` — regenera el catálogo de libros por nivel (`scripts/catalog/books.json` → `public/catalog/`); `-- --survey` sólo mide
- `npm run sample:dict -- έγραψα δω` — muestra búsquedas
- `npm run coverage:text -- archivo.txt --missing` — cobertura del diccionario sobre un texto
- `npm test` (Vitest) · `npm run test:e2e` (Playwright, prueba de humo) · `npm run build`

## Estructura
- `src/lib/normalize.ts`, `lookup.ts`, `text.ts` — lógica pura, compartida con `scripts/build-dict` (Node ejecuta TS directamente, por eso los imports llevan `.ts`).
- `src/db.ts` — esquema Dexie. `src/lib/*` — EPUB, backup, FSRS, CSV, Kindle, TTS.
- `src/screens/*` — pantallas Preact. Enrutado por hash (`#/leer/<bookId>`).
