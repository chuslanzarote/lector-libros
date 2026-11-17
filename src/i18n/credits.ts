// IDI-2 — Mensajes de la pantalla «credits».
// Marcado mínimo: **negrita** y {enlace} (los enlaces y su texto los pone Credits.tsx).
// Las claves con sufijo .el / .es dependen del idioma que se aprende (tt).
import { defineMessages } from './define.ts';

const CITE = 'Tatu Ylonen, «Wiktextract: Wiktionary as Machine-Readable Structured Data», LREC 2022.';

export default defineMessages({
  es: {
    'credits.title': 'Créditos',
    'credits.intro': 'El diccionario de eglosa se genera a partir de fuentes abiertas, todas derivadas de {wiktionary}. Gracias a sus editores.',
    'credits.src1.el': `**Wiktextract / kaikki.org** — formas flexionadas, análisis y glosas en inglés. ${CITE} {kaikkiEl}. Contenido de Wiktionary bajo {ccbysa4} y GFDL.`,
    'credits.src2.el': '**FreeDict griego→español** (2023.05.29) y **griego→inglés** (2025.11.23) — {freedict}, derivados de Wiktionary, {ccbysa3}.',
    'credits.src3.el': '**FrequencyWords** (OpenSubtitles 2018), Hermit Dave — {github}, CC BY-SA 4.0. Sólo se usa al generar el diccionario para ordenar lemas ambiguos.',
    'credits.src1.es': `**Wiktextract / kaikki.org, español** — formas conjugadas y flexionadas, análisis y glosas en inglés. ${CITE} {kaikkiEs}. Contenido de Wiktionary bajo {ccbysa4} y GFDL.`,
    'credits.src2.es': '**kaikki.org, Wiktionary griego** — definiciones en griego de los lemas españoles. {kaikkiElwikt}, {ccbysa4}.',
    'credits.src3.es': '**kaikki.org, Wiktionary español** — tablas de traducción al griego. {kaikkiEswikt}, {ccbysa4}.',
    'credits.src4.es': '**FreeDict griego→español** (2023.05.29), leído al revés — más pares español→griego. {freedict}, derivado de Wiktionary, {ccbysa3}.',
    'credits.src5.es': '**Pivote por el inglés** — entradas griegas de Wiktextract ({kaikkiEl}), sólo cuando no hay ninguna traducción directa al griego. {ccbysa4}.',
    'credits.src6.es': '**FrequencyWords, español** (OpenSubtitles 2018), Hermit Dave — {github}, CC BY-SA 4.0. Sólo se usa al generar el diccionario para ordenar lemas ambiguos y podar los raros.',
    'credits.result': 'El diccionario resultante ({file}) es una obra derivada y se distribuye bajo **CC BY-SA 4.0**. Puedes descargarlo, modificarlo y redistribuirlo con la misma licencia y esta atribución.',
    'credits.sample': 'Texto de ejemplo: {book}, Zacharias Papantoniou (1918), dominio público; transcripción de {source}.',
    'credits.catalog': 'Catálogo: obras de dominio público (autores y traductores fallecidos hace más de 80 años) transcritas por los voluntarios de {wikisource} y de {gutenberg}. Cada libro enlaza a su fuente. Los textos se han limpiado (sin cabeceras ni licencias de Gutenberg); el nivel es una estimación propia.',
    'credits.software': 'Software: Preact, Dexie, JSZip, ts-fsrs, Vite y vite-plugin-pwa (licencias MIT/Apache-2.0). eglosa no envía ningún dato a ningún servidor; la única conexión externa es abrir una frase en el traductor que elijas.',
  },
  en: {
    'credits.title': 'Credits',
    'credits.intro': 'The eglosa dictionary is built from open sources, all derived from {wiktionary}. Thanks to its editors.',
    'credits.src1.el': `**Wiktextract / kaikki.org** — inflected forms, grammatical analysis and English glosses. ${CITE} {kaikkiEl}. Wiktionary content under {ccbysa4} and GFDL.`,
    'credits.src2.el': '**FreeDict Greek→Spanish** (2023.05.29) and **Greek→English** (2025.11.23) — {freedict}, derived from Wiktionary, {ccbysa3}.',
    'credits.src3.el': '**FrequencyWords** (OpenSubtitles 2018), Hermit Dave — {github}, CC BY-SA 4.0. Only used while building the dictionary, to rank ambiguous lemmas.',
    'credits.src1.es': `**Wiktextract / kaikki.org, Spanish** — conjugated and inflected forms, grammatical analysis and English glosses. ${CITE} {kaikkiEs}. Wiktionary content under {ccbysa4} and GFDL.`,
    'credits.src2.es': '**kaikki.org, Greek Wiktionary** — Greek definitions of Spanish lemmas. {kaikkiElwikt}, {ccbysa4}.',
    'credits.src3.es': '**kaikki.org, Spanish Wiktionary** — translation tables into Greek. {kaikkiEswikt}, {ccbysa4}.',
    'credits.src4.es': '**FreeDict Greek→Spanish** (2023.05.29), read in reverse — more Spanish→Greek pairs. {freedict}, derived from Wiktionary, {ccbysa3}.',
    'credits.src5.es': '**English pivot** — Greek entries from Wiktextract ({kaikkiEl}), used only when there is no direct Greek translation. {ccbysa4}.',
    'credits.src6.es': '**FrequencyWords, Spanish** (OpenSubtitles 2018), Hermit Dave — {github}, CC BY-SA 4.0. Only used while building the dictionary, to rank ambiguous lemmas and prune rare ones.',
    'credits.result': 'The resulting dictionary ({file}) is a derivative work distributed under **CC BY-SA 4.0**. You may download, modify and redistribute it under the same licence with this attribution.',
    'credits.sample': 'Sample text: {book}, Zacharias Papantoniou (1918), public domain; transcription from {source}.',
    'credits.catalog': 'Catalogue: public-domain works (authors and translators who died more than 80 years ago) transcribed by the volunteers of {wikisource} and {gutenberg}. Each book links to its source. The texts have been cleaned up (no Gutenberg headers or licences); the level is our own estimate.',
    'credits.software': 'Software: Preact, Dexie, JSZip, ts-fsrs, Vite and vite-plugin-pwa (MIT/Apache-2.0 licences). eglosa sends no data to any server; the only external connection is opening a sentence in the translator of your choice.',
  },
  el: {
    'credits.title': 'Συντελεστές',
    'credits.intro': 'Το λεξικό του eglosa δημιουργείται από ανοιχτές πηγές, όλες προερχόμενες από το {wiktionary}. Ευχαριστούμε τους συντάκτες του.',
    'credits.src1.el': `**Wiktextract / kaikki.org** — κλιτοί τύποι, γραμματική ανάλυση και αγγλικές αποδόσεις. ${CITE} {kaikkiEl}. Περιεχόμενο του Wiktionary με άδεια {ccbysa4} και GFDL.`,
    'credits.src2.el': '**FreeDict ελληνικά→ισπανικά** (2023.05.29) και **ελληνικά→αγγλικά** (2025.11.23) — {freedict}, προερχόμενα από το Wiktionary, {ccbysa3}.',
    'credits.src3.el': '**FrequencyWords** (OpenSubtitles 2018), Hermit Dave — {github}, CC BY-SA 4.0. Χρησιμοποιείται μόνο κατά τη δημιουργία του λεξικού, για την ταξινόμηση αμφίσημων λημμάτων.',
    'credits.src1.es': `**Wiktextract / kaikki.org, ισπανικά** — κλιτοί τύποι και τύποι ρημάτων, γραμματική ανάλυση και αγγλικές αποδόσεις. ${CITE} {kaikkiEs}. Περιεχόμενο του Wiktionary με άδεια {ccbysa4} και GFDL.`,
    'credits.src2.es': '**kaikki.org, ελληνικό Βικιλεξικό** — ελληνικοί ορισμοί των ισπανικών λημμάτων. {kaikkiElwikt}, {ccbysa4}.',
    'credits.src3.es': '**kaikki.org, ισπανικό Βικιλεξικό** — πίνακες μεταφράσεων στα ελληνικά. {kaikkiEswikt}, {ccbysa4}.',
    'credits.src4.es': '**FreeDict ελληνικά→ισπανικά** (2023.05.29), αντίστροφα — περισσότερα ζεύγη ισπανικά→ελληνικά. {freedict}, προερχόμενο από το Wiktionary, {ccbysa3}.',
    'credits.src5.es': '**Μέσω αγγλικών** — ελληνικά λήμματα του Wiktextract ({kaikkiEl}), μόνο όταν δεν υπάρχει άμεση μετάφραση στα ελληνικά. {ccbysa4}.',
    'credits.src6.es': '**FrequencyWords, ισπανικά** (OpenSubtitles 2018), Hermit Dave — {github}, CC BY-SA 4.0. Χρησιμοποιείται μόνο κατά τη δημιουργία του λεξικού, για την ταξινόμηση αμφίσημων λημμάτων και την αφαίρεση των σπάνιων.',
    'credits.result': 'Το λεξικό που προκύπτει ({file}) είναι παράγωγο έργο και διανέμεται με άδεια **CC BY-SA 4.0**. Μπορείς να το κατεβάσεις, να το τροποποιήσεις και να το αναδιανείμεις με την ίδια άδεια και αυτή την αναφορά.',
    'credits.sample': 'Κείμενο δείγματος: {book}, Ζαχαρίας Παπαντωνίου (1918), κοινό κτήμα· μεταγραφή από το {source}.',
    'credits.catalog': 'Κατάλογος: έργα κοινού κτήματος (συγγραφείς και μεταφραστές που πέθαναν πριν από περισσότερα από 80 χρόνια), μεταγραμμένα από τους εθελοντές της {wikisource} και του {gutenberg}. Κάθε βιβλίο παραπέμπει στην πηγή του. Τα κείμενα έχουν καθαριστεί (χωρίς τις κεφαλίδες και τις άδειες του Gutenberg)· το επίπεδο είναι δική μας εκτίμηση.',
    'credits.software': 'Λογισμικό: Preact, Dexie, JSZip, ts-fsrs, Vite και vite-plugin-pwa (άδειες MIT/Apache-2.0). Το eglosa δεν στέλνει κανένα δεδομένο σε κανέναν διακομιστή· η μόνη εξωτερική σύνδεση είναι το άνοιγμα μιας φράσης στον μεταφραστή που επιλέγεις.',
  },
});
