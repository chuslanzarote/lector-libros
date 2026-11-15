# Ellinikó — lector de griego con traducción al tocar

PWA estática para leer libros en griego moderno. Tocas una palabra y ves su lema, su análisis gramatical («aoristo, 1.ª sg.») y su traducción al español (o al inglés, marcada «EN»). Sin servidor, sin cuentas, sin IA: el diccionario viaja dentro de la app y funciona sin conexión.

Especificación completa: [`docs/PRD.md`](docs/PRD.md).

## Uso

1. Abre la app (la primera vez descarga el diccionario de 5 MB y lo guarda para uso offline).
2. Elige un libro del **Catálogo** por nivel (A2–C1, todos de dominio público), importa un EPUB o TXT, pega un texto o prueba con *Τα ψηλά βουνά*.
3. Toca palabras: pasan a «aprendiendo» y se convierten en tarjetas de repaso. Mantén pulsada una frase para abrirla en Google Translate o DeepL.
4. Repasa a diario (FSRS), exporta a Anki (CSV) o envía un capítulo glosado a tu Kindle (EPUB).
5. Para cambiar de dispositivo: Ajustes → Exportar backup, y en el otro dispositivo Importar backup (se fusiona por fecha de cambio).

## Desarrollo

Requiere Node ≥ 24 (los scripts de `scripts/` son TypeScript ejecutado directamente por Node).

```bash
npm install
npm run dev              # http://localhost:5173
npm test                 # Vitest: normalización, búsqueda, backup, FSRS, EPUB, CSV…
npm run test:e2e         # Playwright: prueba de humo (incluye modo avión)
npm run build            # dist/ listo para GitHub Pages
```

### Catálogo

```bash
npm run build:catalog                 # descarga (Wikisource/Gutenberg), mide el nivel y escribe public/catalog/
npm run build:catalog -- --survey     # sólo mide y muestra la tabla de dificultad
npm run build:catalog -- --only=trelantonis
```

La lista curada está en `scripts/catalog/books.json`; las versiones de las fuentes, en `scripts/catalog/lock.json`. Necesita haber ejecutado antes `npm run build:dict` (usa la lista de frecuencias de `.cache/`).

### Diccionario

```bash
npm run build:dict                         # regenera public/dict/dict.json.gz (fuentes en .cache/)
npm run build:dict -- --accept-new         # si kaikki.org publicó un volcado nuevo
npm run sample:dict -- έγραψα δω σ’        # muestra búsquedas
npm run coverage:text -- libro.txt --missing
```

Las fuentes están fijadas con checksum en `scripts/build-dict/sources.json`, así que el build es reproducible. El resultado se versiona en el repo; el workflow «Regenerar diccionario» lo rehace en GitHub Actions y abre un PR.

## Despliegue en GitHub Pages

1. Crea el repositorio y sube el código a `main`.
2. En *Settings → Pages*, elige **GitHub Actions** como fuente.
3. El workflow `deploy.yml` pasa los tests, construye y publica. La app usa rutas relativas y enrutado por hash, así que funciona con cualquier nombre de repositorio.

## Licencias

Código: elige tú la licencia (añade un `LICENSE`). Diccionario (`public/dict/`): obra derivada de Wiktionary vía Wiktextract y FreeDict, **CC BY-SA 4.0** — ver la pantalla de Créditos.
