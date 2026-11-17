# PRD — Lector de griego con traducción al tocar

Nov 15, 2026 · @Jesús Lanzarote Rodríguez-Quiñones Galindo

## Resumen y objetivos

**Ellinikó** (nombre provisional) es un lector personal y gratuito de libros en griego moderno y, desde la v2, también en español (IDI-1). Tocas una palabra y ves su forma de diccionario, su análisis gramatical y su traducción al español, o al inglés si no hay entrada en español. Es una **PWA estática en GitHub Pages**, sin servidor, sin IA y sin claves: el diccionario se construye una vez a partir de fuentes abiertas, viaja dentro de la app y funciona offline.

**Objetivos**

- Leer cualquier libro en griego que importes, de B1 a C1, sin salir del texto.
- Reconocer cualquier forma flexionada («έγραψα» → «γράφω», aoristo, 1.ª sg.), no solo la forma de diccionario.
- Convertir cada consulta en vocabulario repasable.
- Coste cero y nada que mantener: sin servidor, con formatos abiertos (EPUB, JSON, CSV).
- Funcionar en las dos direcciones: un hispanohablante que aprende griego y un hablante de griego (o de inglés) que aprende español (ver «Idiomas»).

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
| IMP-5 | Catálogo de libros de dominio público incluidos en el repo (Wikisource y Gutenberg), descargables bajo demanda desde la app | S |
| IMP-6 | Nivel estimado (A2, B1, B2, C1) de cada libro del catálogo, calculado sin IA a partir del vocabulario; filtro por nivel | S |
| IDI-1 | Pantalla de inicio: eliges el idioma que aprendes (griego o español) y el tuyo (español, griego o inglés; nunca el mismo). Se puede cambiar desde Ajustes | S |
| IDI-2 | Interfaz completa en el idioma del usuario (español, inglés, griego), incluidas las etiquetas gramaticales del diccionario | S |
| IDI-3 | Datos separados por idioma de estudio: libros, vocabulario, repaso y ajustes de griego y de español no se mezclan; el backup lleva el idioma | S |
| IDI-4 | Audio TTS, traductor externo y enlace a Wiktionary según el par de idiomas (`es-ES`, `el-GR`; `sl`/`tl` del traductor) | S |
| DIC-7 | Diccionario español: formas conjugadas y flexionadas → lema, traducción al griego y, si no hay, al inglés (marcado «EN»). Respaldo de búsqueda para pronombres enclíticos (dámelo, diciéndole) y ortografía antigua (fué, á) | S |
| DIC-8 | Traducciones en el orden del idioma del usuario: personal → su idioma → inglés → resto | S |
| IMP-7 | Catálogo de libros en español de dominio público por niveles (A2–C1), con el mismo método que IMP-5/IMP-6 | S |

## Idiomas (IDI-1…IDI-4, v2)

Un **perfil** es la pareja *idioma que aprendes* (`el` o `es`) + *tu idioma* (`es`, `el` o `en`, distinto del primero). Se elige en la pantalla de inicio la primera vez, se guarda en `localStorage` (`elliniko.profile`) y se cambia desde Ajustes; al cambiarlo la app se recarga.

| | Aprendes griego | Aprendes español |
| --- | --- | --- |
| Interfaz | español o inglés | griego o inglés |
| Diccionario | `dict/el/dict.json.gz`: griego → español, inglés | `dict/es/dict.json.gz`: español → griego, inglés |
| Traducciones (DIC-8) | tuya → tu idioma → inglés → resto | tuya → tu idioma → inglés → resto |
| Base de datos (IDI-3) | IndexedDB `elliniko` (la de siempre: no se migra nada) | IndexedDB `elliniko-es` |
| Catálogo | `catalog/el/` | `catalog/es/` (IMP-7) |
| Texto | NFC + monotónico (IMP-3), «;» cierra pregunta | NFC; «;» no cierra frase; ¿ ¡ |
| Audio / traductor | `el-GR`; `sl=el&tl=<tu idioma>` | `es-ES`; `sl=es&tl=<tu idioma>` |

- Cada idioma de estudio tiene su propia base de datos, así que libros, vocabulario, tarjetas, ajustes y backup no se mezclan. El backup indica el idioma (`lang`) y no se puede importar en el otro; los backups antiguos sin `lang` son de griego.
- La interfaz usa un catálogo de mensajes por idioma (`src/i18n/`). El español es la referencia; un test comprueba que inglés y griego tienen las mismas claves.
- Las etiquetas gramaticales y la categoría gramatical vienen ya traducidas en el diccionario (`labels`, una lista por idioma de interfaz), así que la app no conoce la gramática de cada idioma.
- Los diccionarios no se precachean en el service worker (se descargaría el de los dos idiomas); al primer arranque de cada idioma se descargan y se guardan en IndexedDB, que es lo que funciona sin conexión.

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

**Formato de salida (resumido, formato 2).** Hay un archivo por idioma de estudio: `public/dict/<lang>/dict.json.gz` con su `manifest.json`. `lang` es el idioma de las entradas y `glosses` los idiomas de las traducciones. `labels` traduce cada id de etiqueta a cada idioma de interfaz posible (para griego, `es` y `en`; para español, `el` y `en`). El id `0` está reservado a «forma de diccionario». Cada fila de `forms` es `[lema, idEtiqueta, idEtiqueta…]`: una forma puede tener varios análisis para el mismo lema (p. ej. «το»: neutro sg. nom./ac. y masc. sg. ac.). Las filas de una forma van ordenadas por probabilidad del lema (frecuencia). `p` es el id de etiqueta de la categoría gramatical, que puede llevar el género («sustantivo neutro»). Cada lema lleva una lista de acepciones por idioma de `glosses`. Las claves de `forms` y `noAccent` se calculan con `src/lib/normalize.ts`, que comparten app y script (`noAccent` quita tildes, diéresis y acentos griegos, pero conserva la ñ).

```json
{
  "format": 2,
  "lang": "el",
  "glosses": ["es", "en"],
  "version": "2026.11.15",
  "labels": {
    "es": ["forma de diccionario", "verbo", "aoristo, 1.ª sg., voz activa", "neutro sg., nom./ac.", "masc. sg., ac."],
    "en": ["dictionary form", "verb", "aorist, 1st sg., active", "neuter sg., nom./acc.", "masc. sg., acc."]
  },
  "lemmas": {
    "γράφω": {"p": 1, "es": ["escribir"], "en": ["to write"]}
  },
  "forms": {
    "έγραψα": [["γράφω", 2]],
    "το": [["ο", 3, 4], ["το", 0]]
  },
  "noAccent": {
    "εγραψα": ["έγραψα"]
  }
}
```

### Diccionario español (DIC-7)

`npm run build:dict -- --lang=es` usa fuentes fijadas en el mismo `sources.json`:

| Fuente | Qué aporta |
| --- | --- |
| [Wiktextract / kaikki.org, español (Wiktionary inglés)](https://kaikki.org/dictionary/Spanish/) | Formas conjugadas y flexionadas con etiquetas, categoría y glosas en inglés |
| [kaikki.org, Wiktionary griego, entradas en español](https://kaikki.org/elwiktionary/Spanish/) | Definiciones en griego de los lemas españoles |
| [kaikki.org, Wiktionary español, entradas en español](https://kaikki.org/eswiktionary/Espa%C3%B1ol/) | Tablas de traducción al griego (`translations`, `lang_code: el`) |
| FreeDict griego→español (ya usado), invertido | Más pares español → griego |
| Wiktextract griego (ya usado), como pivote | Sólo si no hay nada directo: lema griego frecuente, de la misma categoría, cuyo primer significado en inglés coincide exactamente («dar: to give» ↔ «δίνω: to give»); como mucho dos |
| [FrequencyWords, español 50k](https://github.com/hermitdave/FrequencyWords) | Ordenar lemas ambiguos y podar los raros (sólo en build) |

Las formas con pronombres pegados que trae Wiktextract (unas 940.000: dámelo, hablándole…) no se guardan; las resuelve la búsqueda (ver abajo). Las formas cuyo «lema» es otra forma («fué» → fue) se enlazan con los lemas de esta (ser, ir). Los afijos (-ar, -año) no entran. (Build de 2026-11-17: 7,2 MB, 90.700 lemas, 674.039 formas; 16.720 lemas con griego.)

Limitación asumida: no existe un diccionario abierto español→griego grande, así que el griego se reúne de fuentes pequeñas y muchas palabras saldrán en inglés, como pasa con el español en el diccionario griego.

**Búsqueda en español.** Igual que en griego, con estos respaldos propios: pronombres enclíticos (dámelo → da + me + lo; vámonos → vamos + nos; sentaos → sentad + os) y ortografía antigua por la vía sin tildes (fué → fue, á → a).

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
| (todas) | Hay una base de datos por idioma de estudio (IDI-3): `elliniko` para griego y `elliniko-es` para español, con los mismos almacenes |
| `books` | id, título, autor, fecha de importación, posición de lectura, vocabulario del libro (forma → lema, apariciones) para la cobertura |
| `chapters` | id, bookId, índice, título, frases `[{id, text, original, para}]` (`para`: abre párrafo) |
| `lexemes` | lema, estado (`new`, `learning`, `known`, `ignored`), traducción elegida, notas, `updatedAt` |
| `formChoices` | forma → lema elegido cuando había ambigüedad |
| `userDict` | tus traducciones propias por lema o expresión |
| `cards` | lema, id de la frase de origen, estado FSRS, fecha de repaso |
| `settings` | URL del traductor externo, tema, tamaño de letra |
| `activity` | un registro por día con consultas y repasos (racha, PRO-1) |

**Backup.** «Exportar» genera `elliniko-backup-AAAA-MM-DD.json` (`elliniko-es-backup-…` para español) con todo menos el diccionario base y, opcionalmente, sin los libros. Lleva `lang`; importarlo en el otro idioma da error (IDI-3). «Importar» fusiona registro a registro y gana el `updatedAt` más reciente. Para pasar del móvil a la tablet basta con dejar el archivo en iCloud o Drive.

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

### Catálogo incluido (IMP-5, IMP-6)

`npm run build:catalog [-- --lang=es]` genera `public/catalog/<lang>/catalog.json` y un `books/<id>.json.gz` por libro (un `RawBook` como el de `epub.ts`: título, autor y capítulos con párrafos, en la ortografía original; la app lo pasa a monotónico al importarlo).

- **Selección:** la lista curada está en `scripts/catalog/books.json` (griego) y `scripts/catalog/books.es.json` (español, IMP-7; Gutenberg y es.wikisource). Sólo entran obras con autor **y** traductor fallecidos hace más de 80 años, lo más estricto entre la UE (vida + 70) y España (vida + 80 para autores fallecidos antes de 1987). El script lo comprueba y falla si no se cumple.
- **Fuentes fijadas:** el revid de cada página de Wikisource y el sha256 de cada EPUB de Gutenberg quedan en `scripts/catalog/lock.json`. `--update` acepta versiones nuevas. De los EPUB de Gutenberg se quitan la cabecera y la licencia.
- **Nivel:** sin IA, con tres medidas:
  - el porcentaje de palabras del texto fuera de los 3000 lemas más frecuentes (FrequencyWords agrupado por lema; los nombres propios no cuentan);
  - la longitud media de frase;
  - el peso de marcadores del registro antiguo: katharévousa en griego (εις, ήτο, ουχί…), español clásico en español (agora, vuesa, dixo, -ades/-edes…).

  Con ellas se calcula una puntuación, y unos cortes fijos por idioma en `scripts/catalog/level.ts` la convierten en A2, B1, B2 o C1. Los cortes no son cuantiles, para que el nivel de un libro no cambie al añadir otros. Es una estimación orientativa.
- **Español (IMP-7):** 60 libros (A2 13, B1 14, B2 14, C1 19; 7,9 MB). Como marcador del registro antiguo cuenta, además de arcaísmos (agora, vuesa, dél, desta…), el pronombre pegado a un verbo conjugado («díjole», «hízolo»), propio del español clásico. Aun así, la frecuencia del vocabulario no capta la lengua del Siglo de Oro, así que las obras anteriores a 1700 llevan `"classic": true` en `books.es.json` y quedan como C1 y «español clásico». Los cortes del español son otros (13,5 / 15,6 / 18), porque su escala sale más compacta. Si gutenberg.org está en mantenimiento, el script usa su mirror oficial `gutenberg.pglaf.org`.
- **App:** la pantalla «Catálogo» (`#/catalogo`) filtra por nivel. «Añadir» descarga el libro y lo importa como cualquier otro, guardando `book.catalogId`. Los libros no se precachean, así que la instalación sigue ligera, pero una vez añadidos funcionan offline.
- **Limitación conocida:** en dominio público casi no hay lecturas graduadas modernas (tampoco en español: el A2 lo forman cuentos infantiles y novelas de prosa sencilla como *Niebla* o *Marianela*). El nivel A2 se apoya en literatura infantil y cuentos, y lo traducido de clásicos extranjeros suele estar en katharévousa o en verso.

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
