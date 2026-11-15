// IMP-5 — Capítulos de tamaño manejable: los EPUB de Gutenberg suelen traer una obra entera
// en uno o dos ficheros. Se parten por los encabezados internos y, si aún son largos, en bloques.
import type { RawChapter } from '../../src/lib/epub.ts';

const wc = (p: string) => p.split(/\s+/).filter(Boolean).length;

const HEADING_WORD = /^(ΚΕΦΑΛΑΙΟΝ?|Κεφάλαιον?|ΠΡΑΞΙΣ|ΠΡΑΞΗ|Πράξις|Πράξη|ΣΚΗΝΗ|Σκηνή|ΡΑΨΩΔΙΑ|Ραψωδία|ΜΕΡΟΣ|Μέρος|ΒΙΒΛΙΟΝ?|Βιβλίον?|ΤΟΜΟΣ|ΑΣΜΑ|Άσμα)(?=[\s.:,]|$)/u;
// Romanos, numerales griegos (ΙΓ') o una mayúscula sola (las rapsodias de Homero: «Α», «Β»…).
// Los números arábigos sueltos no: suelen ser números de página o de verso.
const NUMERAL = /^([IVXLC]{1,7}|[Α-Ω]{1,3}[ʹ΄'’]|[Α-Ω])\.?$/u;

/** ¿Es un encabezado («ΚΕΦΑΛΑΙΟΝ Ζ'.», «ΙΙΙ», «Ο ΑΡΧΑΙΟΛΟΓΟΣ»)? Los nombres de personaje del teatro llevan punto y no cuentan. */
export function isHeading(p: string): boolean {
  const t = p.trim();
  if (!t || t.length > 70 || /[,;·]$/.test(t)) return false;
  if (HEADING_WORD.test(t) || NUMERAL.test(t)) return true;
  const letters = t.replace(/[^\p{L}]/gu, '');
  const words = t.split(/\s+/).length;
  return letters.length >= 6 && words >= 2 && words <= 8 && letters === letters.toUpperCase() && !/[.!;:]$/.test(t) && /\p{Script=Greek}/u.test(t);
}

export function splitChapters(chapters: RawChapter[], maxWords = 5000, chunk = 3000): RawChapter[] {
  const out: RawChapter[] = [];
  for (const c of chapters) {
    const total = c.paragraphs.reduce((n, p) => n + wc(p), 0);
    let pieces: RawChapter[] = [c];
    if (total > maxWords) {
      pieces = [];
      let cur: RawChapter = { title: c.title, paragraphs: [] };
      let curWords = 0;
      for (let i = 0; i < c.paragraphs.length; i++) {
        const p = c.paragraphs[i];
        if (isHeading(p) && curWords >= 400) {
          pieces.push(cur);
          // «ΚΕΦΑΛΑΙΟΝ Ζ'.» + «ΠΡΟΕΤΟΙΜΑΣΙΑΙ» → un solo título
          let title = p.trim();
          while (i + 1 < c.paragraphs.length && isHeading(c.paragraphs[i + 1]) && title.length < 60) title += ' · ' + c.paragraphs[++i].trim();
          cur = { title: title.replace(/\.$/, ''), paragraphs: [] };
          curWords = 0;
          continue;
        }
        cur.paragraphs.push(p);
        curWords += wc(p);
      }
      if (cur.paragraphs.length) pieces.push(cur);
    }
    for (const piece of pieces) {
      const words = piece.paragraphs.reduce((n, p) => n + wc(p), 0);
      if (words <= maxWords * 1.2) {
        out.push(piece);
        continue;
      }
      const parts = Math.ceil(words / chunk);
      const target = words / parts;
      // Un título largo suele ser la portadilla: mejor «Parte 2» que repetirla
      const label = (k: number) => (piece.title.length > 40 ? `Parte ${k}` : `${piece.title} (${k}/${parts})`);
      let cur: string[] = [];
      let n = 0;
      let k = 1;
      for (const p of piece.paragraphs) {
        cur.push(p);
        n += wc(p);
        if (n >= target && k < parts) {
          out.push({ title: label(k), paragraphs: cur });
          cur = [];
          n = 0;
          k++;
        }
      }
      if (cur.length) out.push({ title: parts > 1 ? label(k) : piece.title, paragraphs: cur });
    }
  }
  return out;
}
