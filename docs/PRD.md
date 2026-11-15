# PRD — Lector de griego con traducción al tocar

Nov 15, 2026 · @Jesús Lanzarote Rodríguez-Quiñones Galindo

## Resumen y objetivos

**Ellinikó** (nombre provisional) es un lector personal y gratuito de libros en griego moderno. Tocas una palabra y ves su forma de diccionario, su análisis gramatical y su traducción al español, o al inglés si no hay entrada en español. Es una **PWA estática en GitHub Pages**, sin servidor, sin IA y sin claves: el diccionario se construye una vez a partir de fuentes abiertas, viaja dentro de la app y funciona offline.

**Objetivos**

- Leer cualquier libro en griego que importes, de B1 a C1, sin salir del texto.
- Reconocer cualquier forma flexionada («έγραψα» → «γράφω», aoristo, 1.ª sg.), no solo la forma de diccionario.
- Convertir cada consulta en vocabulario repasable.
- Coste cero y nada que mantener: sin servidor, con formatos abiertos (EPUB, JSON, CSV).

**No-objetivos**

- Nada de traducción en contexto ni de frases completas con IA. Para una frase hay un botón que la abre en un traductor externo.
- Ni cuentas, ni multiusuario, ni sincronización automática: se usa un backup en archivo.
- No enseña desde cero (A1–A2) ni distribuye libros.

## Casos de uso

Usuario único: hispanohablante con B1 sólido, que entiende por contexto pero necesita vocabulario y reconocer formas verbales. Lee en ratos sueltos en el móvil y en sesiones largas en tablet o Kindle.

1. **Importar.** Abre un EPUB o TXT del dispositivo, o pega texto. La app lo trocea en capítulos y frases y normaliza el politónico a monotónico.
2. **Leer.** Retoma donde lo dejó. Las palabras se colorean según su estado: nueva, aprendiendo o conocida.
3. **Tocar una palabra.** Tarjeta con forma de diccionario, análisis (p. ej. «aoristo, 1.ª sg.»), acepciones en español o inglés y audio. Si la forma es ambigua (dos lemas posibles), se muestran ambos y el usuario elige uno. La palabra pasa a «aprendiendo» y guarda la traducción elegida.
4. **Frase completa.** Con pulsación larga, la frase se abre en un traductor externo (Google Translate o DeepL) en una pestaña nueva.
5. **Repasar.** Tarjetas diarias con la frase original del libro como contexto.
6. **Kindle.** Exporta un capítulo como EPUB con glosas de las palabras nuevas y lo envía con Send-to-Kindle.
7. **Cambiar de dispositivo.** Exporta un backup JSON y lo importa en el otro dispositivo, o lo deja en iCloud o Drive.

## Requisitos

Prioridad: **M** = MVP, **S** = v1, **C** = más adelante.

| ID | Requisito | Prioridad |
| --- | --- | --- |
| DIC-1 | Script de build que genera el diccionario compacto desde FreeDict y Wiktextract (ver «El diccionario») | M |
| DIC-2 | Búsqueda forma → lema(s) + análisis + acepciones, en menos de 50 ms y offline | M |
| DIC-3 | Traducción en español si existe; si no, inglés marcado como «EN» | M |
| DIC-4 | Etiquetas gramaticales traducidas al español (aoristo, genitivo, voz pasiva…) | M |
| DIC-5 | Diccionario personal: el usuario corrige o añade traducciones y prevalecen sobre las del diccionario | S |
| IMP-1 | Importar EPUB y TXT desde archivo local; extraer título, autor y capítulos | M |
| IMP-2 | Pegar texto libre como documento | M |
| IMP-3 | Normalizar Unicode (NFC) y convertir politónico a monotónico, conservando el original | M |
| LEC-1 | Lector con scroll, tamaño de letra, modo oscuro y posición recordada | M |
| LEC-2 | Colorear palabras por estado: nueva, aprendiendo, conocida, ignorada | M |
| LEC-3 | Toque en palabra → tarjeta de diccionario; elegir lema y acepción cuando haya varias | M |
| LEC-4 | Pulsación larga en frase → abrir en traductor externo (URL configurable) | M |
| LEC-5 | Audio TTS `el-GR` con Web Speech API | S |
| LEC-6 | Seleccionar varias palabras y guardarlas como expresión con traducción propia | S |
| LEC-7 | «Marcar capítulo leído»: las palabras nuevas no consultadas pasan a conocidas | S |
| VOC-1 | Lista de vocabulario editable: lema, traducción elegida, frase de origen, estado | M |
| VOC-2 | Repaso espaciado FSRS con la frase del libro | S |
| VOC-3 | Exportar vocabulario a CSV para Anki | S |
| KIN-1 | Exportar capítulo como EPUB glosado para Send-to-Kindle | S |
| SYS-1 | PWA instalable y 100 % offline, diccionario incluido | M |
| SYS-2 | Backup completo en JSON (exportar e importar, con fusión por fecha de cambio) | M |
| PRO-1 | Panel de progreso: palabras conocidas, racha y cobertura por libro | S |
| PRO-2 | Cobertura previa: al importar, % de palabras del libro que ya conoces | C |
| DIC-6 | Variantes ortográficas de textos antiguos como respaldo de búsqueda (subjuntivo en -η, aumento, aféresis, repeticiones expresivas) | S |
| IMP-4 | Libro de ejemplo integrado (*Τα ψηλά βουνά*, cap. 1–3) para probar la app sin importar nada | S |

## Arquitectura y stack

Hay dos momentos. En el **build**, un script descarga las fuentes abiertas y genera un diccionario compacto que se publica con la app. En el **uso**, la PWA lo guarda en IndexedDB la primera vez y desde entonces no necesita red, salvo para abrir una frase en el traductor externo.

&#91;embedded content: arquitectura · build del diccionario y PWA offline\]

Una PWA necesita HTTPS para el service worker, así que abrir el `.html` con `file://` no la hace instalable. GitHub Pages lo resuelve gratis.

| Capa | Elección |
| --- | --- |
| Base | Vite + TypeScript; Preact o JS sin framework |
| Lectura de EPUB | JSZip + DOMParser |
| Datos | IndexedDB mediante Dexie |
| Offline e instalación | `vite-plugin-pwa` (Workbox) y `manifest.webmanifest` |
| Build del diccionario | Script Node o Python en `scripts/build-dict`, ejecutado en GitHub Actions |
| Repaso | `ts-fsrs` |
| EPUB para Kindle | JSZip generando EPUB 3 |
| Audio | Web Speech API, voz `el-GR` |
| Alojamiento | GitHub Pages con despliegue por GitHub Actions |
| Tests | Vitest para la lógica, Playwright para una prueba de humo |

## El diccionario

El diccionario resulta de fundir tres fuentes abiertas, todas derivadas de Wiktionary (CC BY-SA). Wiktextract aporta el mapa de formas flexionadas → lema con su análisis; FreeDict aporta las traducciones. El resultado es un único `dict.json.gz` que la app descarga una vez. Una cuarta fuente, una lista de frecuencias, sólo se usa durante el build para ordenar los lemas ambiguos y no viaja en la app.

| Fuente | Qué aporta | Tamaño |
| --- | --- | --- |
| [FreeDict griego→español](https://freedict.org/downloads/) | Traducciones al español por lema | 10.702 entradas (v. 2023.05.29) |
| [FreeDict griego→inglés](https://freedict.org/downloads/) | Traducciones al inglés, como respaldo | 41.714 entradas (v. 2025.11.23) |
| [Wiktextract / kaikki.org, griego](https://kaikki.org/dictionary/rawdata.html) | Formas flexionadas con etiquetas, categoría gramatical y glosas en inglés | El mayor de los tres |
| [FrequencyWords, griego 50k](https://github.com/hermitdave/FrequencyWords) (CC BY-SA 4.0) | Frecuencia de formas, para ordenar lemas candidatos y podar los raros | Sólo en build |

**Pasos del script `scripts/build-dict`:**

1. Descargar las tres fuentes en versiones fijadas (URL y checksum en `scripts/sources.json`), para que el build sea reproducible.
2. Leer Wiktextract (JSONL, una entrada por línea): por cada lema guardar categoría, glosas en inglés y lista `forms[]` con sus etiquetas (`aorist`, `first-person`, `singular`…). Las entradas «form-of» también aportan forma → lema.
3. Leer FreeDict (StarDict o TEI) y asignar las traducciones al lema correspondiente.
4. Construir dos índices de búsqueda: forma exacta (minúsculas, NFC, ς→σ) y forma sin acentos, porque los textos antiguos y los errores de acentuación son frecuentes.
5. Traducir las etiquetas al español con una tabla fija (`aorist` → aoristo, `genitive` → genitivo, `passive` → voz pasiva, `subjunctive` → subjuntivo…) y comprimir las combinaciones repetidas en una tabla de IDs.
6. Escribir `public/dict/dict.json.gz` y un `manifest` con versión y fecha. Objetivo de tamaño: menos de 20 MB comprimido; si se supera, se descartan las formas de lemas raros. (Build de 2026-11-15: 4,8 MB, 49.678 lemas, 281.657 formas; mismo SHA-256 en dos ejecuciones.)
7. Incluir en la app una pantalla de **Créditos** con la atribución que exige CC BY-SA.

**Formato de salida (resumido).** Cada fila de `forms` es `[lema, idEtiqueta, idEtiqueta…]`: una forma puede tener varios análisis para el mismo lema (p. ej. «το»: neutro sg. nom./ac. y masc. sg. ac.). El id `0` está reservado a «forma de diccionario». Las filas de una forma van ordenadas por probabilidad del lema (frecuencia). `pos` puede llevar el género del sustantivo («sustantivo neutro»). Las claves de `forms` y `noAccent` se calculan con `src/lib/normalize.ts`, que comparten app y script.

```json
{
  "version": "2026.11.15",
  "tags": ["forma de diccionario", "aoristo, 1.ª sg., voz activa", "neutro sg., nom./ac.", "masc. sg., ac."],
  "lemmas": {
    "γράφω": {"pos": "verbo", "es": ["escribir"], "en": ["to write"]}
  },
  "forms": {
    "έγραψα": [["γράφω", 1]],
    "το": [["ο", 2, 3], ["το", 0]]
  },
  "noAccent": {
    "εγραψα": ["έγραψα"]
  }
}
```

**Búsqueda al tocar una palabra:**

1. Normalizar el token (sin puntuación, minúsculas, NFC, ς final → σ para la clave).
2. Buscar en `forms`; si no aparece, en `noAccent`; si no, elisiones (σ’ → σε) y variantes ortográficas antiguas (DIC-6: «πη» → πει, «εφόρτωσαν» → φόρτωσαν); si no, como lema directo.
3. Si hay varios lemas posibles (p. ej. «πιο»), mostrarlos todos; el que elija el usuario queda guardado para esa forma.
4. Si no hay nada: «No está en el diccionario» con un botón para añadir tu propia traducción (DIC-5) y otro para abrir la palabra en Wiktionary.
5. Prioridad de traducciones: tu diccionario personal → español → inglés (marcado «EN»).

Limitación asumida: el diccionario en español es pequeño, así que muchas palabras saldrán en inglés. Con el uso, tu diccionario personal irá llenando ese hueco.

## Datos del usuario y backup

Todo se guarda en IndexedDB (Dexie). El diccionario base es de solo lectura y se reemplaza entero cuando sale una versión nueva; lo que es tuyo va en almacenes aparte y nunca se pisa.

| Almacén | Campos principales |
| --- | --- |
| `dictForms`, `dictNoAccent`, `dictLemmas`, `meta` | diccionario base cargado desde `dict.json.gz` (uno por índice), y su versión en `meta` |
| `books` | id, título, autor, fecha de importación, posición de lectura, vocabulario del libro (forma → lema, apariciones) para la cobertura |
| `chapters` | id, bookId, índice, título, frases `[{id, text, original, para}]` (`para`: abre párrafo) |
| `lexemes` | lema, estado (`new`, `learning`, `known`, `ignored`), traducción elegida, notas, `updatedAt` |
| `formChoices` | forma → lema elegido cuando había ambigüedad |
| `userDict` | tus traducciones propias por lema o expresión |
| `cards` | lema, id de la frase de origen, estado FSRS, fecha de repaso |
| `settings` | URL del traductor externo, tema, tamaño de letra |
| `activity` | un registro por día con consultas y repasos (racha, PRO-1) |

**Backup.** «Exportar» genera `elliniko-backup-AAAA-MM-DD.json` con todo menos el diccionario base y, opcionalmente, sin los libros. «Importar» fusiona registro a registro y gana el `updatedAt` más reciente. Para pasar del móvil a la tablet basta con dejar el archivo en iCloud o Drive.

## Fuentes de textos

Se usan textos libres de derechos en la UE (autor fallecido hace más de 70 años) o ebooks gratuitos descargados a mano para uso personal. Conviene el **demoticó** en ediciones monotónicas modernas: mucho de lo antiguo está en katharevousa, y además el diccionario lo cubre peor.

| Fuente | Qué aporta | Cómo entra en la app |
| --- | --- | --- |
| [ebooks4greeks.gr](https://www.ebooks4greeks.gr) | Ebooks gratuitos en griego moderno, incluidos clásicos escolares | Descargar el EPUB e importarlo |
| [openbook.gr](https://www.openbook.gr) | Ebooks gratuitos y legales en griego | Descargar el EPUB e importarlo |
| [Project Gutenberg, griego](https://www.gutenberg.org/browse/languages/el) | Obras de dominio público, muchas politónicas | Descargar el EPUB e importarlo |
| [el.wikisource.org](https://el.wikisource.org) | Textos de dominio público | Copiar el texto y pegarlo |

**Biblioteca inicial sugerida, de menor a mayor dificultad:**

1. *Τα ψηλά βουνά*, Zacharias Papantoniou (1918): vacaciones de niños en la montaña, frase corta, vocabulario cotidiano. Punto de partida ideal.
2. *Ο Τρελαντώνης*, Penelope Delta (1932): travesuras infantiles en Atenas, mucho diálogo.
3. *Τα μυστικά του Βάλτου*, Penelope Delta (1937): novela histórica más larga, un salto a B2.
4. Poemas de Cavafis (fallecido en 1933): breves, ideales para trabajar frase a frase; mezclan registros.
5. Cuentos de Papadiamantis o Vizyinos: solo como reto C1, porque narran en katharevousa.

La app debe mostrar en la biblioteca la **cobertura** de cada libro: un libro es cómodo a partir de \~95 % de palabras conocidas y aprovechable desde \~85 % con ayuda de la app.

## Fases y trabajo con Claude Code

Se hace en tres fases cortas y cada una deja algo usable. La primera es el diccionario, porque todo lo demás depende de él.

**Fase 1: Diccionario y lector mínimo (todos los requisitos M).**

- [x] `npm run build:dict` genera `dict.json.gz` de forma reproducible, por debajo de 20 MB (4,8 MB)
- [x] Test: «έγραψα» → γράφω (aoristo, 1.ª sg.); «γράφτηκε» → γράφω (pasiva); «σκονισμένα» → participio; «δω» → βλέπω
- [x] Sobre el primer capítulo de *Τα ψηλά βουνά*, al menos el 90 % de las palabras encuentran lema (95,8 %)
- [ ] Desplegado en GitHub Pages; se instala en el móvil y funciona en modo avión — modo avión verificado con Playwright; falta crear el repo, activar Pages y probar en un móvil real
- [x] Importar un EPUB, tocar palabras, guardarlas y exportar e importar el backup sin perder nada (tests unitarios + prueba de humo)

**Fase 2: Aprender (requisitos S).**

- [x] Repaso FSRS diario con la frase original
- [x] Diccionario personal, expresiones, audio y «marcar leído»
- [ ] CSV para Anki y EPUB glosado que se abre bien en un Kindle real — generados y probados en tests; falta probar en un Kindle real

**Fase 3: Extras (requisitos C).** Cobertura previa del libro (hecha: se calcula al importar y se muestra en el aviso y en Progreso) e investigar si la edición española de Wiktionary añade traducciones griego→español para ampliar el diccionario.

**Cómo usar este PRD con Claude Code:**

1. Exporta este documento a Markdown y guárdalo en un repo nuevo como `docs/PRD.md`.
2. Crea un `CLAUDE.md` breve: «Lee docs/PRD.md antes de cada tarea. App estática, sin backend ni IA. Trabaja por IDs de requisito. No cambies el formato de `dict.json.gz` sin actualizar el PRD. Tests obligatorios para normalización, búsqueda de formas, backup y FSRS.»
3. Primera instrucción: «Implementa DIC-1 según docs/PRD.md y enséñame una muestra de 20 búsquedas antes de seguir».
4. Cada idea nueva entra primero en la tabla de requisitos con su ID y luego se implementa. Así el PRD se mantiene al día y te sirve siempre.
