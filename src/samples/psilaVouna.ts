// Libro de ejemplo: los tres primeros capítulos de «Τα ψηλά βουνά» (Z. Papantoniou, 1918,
// dominio público), transcritos en el.wikisource.org. Se importa con un botón desde la biblioteca.
import c1 from '../../tests/fixtures/psila-vouna-1.txt?raw';
import c2 from '../../tests/fixtures/psila-vouna-2.txt?raw';
import c3 from '../../tests/fixtures/psila-vouna-3.txt?raw';
import type { RawBook, RawChapter } from '../lib/epub.ts';

function clean(raw: string): RawChapter {
  const paras = raw.replace(/\r/g, '').split(/\n\s*\n/).map((p) => p.replace(/\s*\n\s*/g, ' ').trim());
  // El capítulo empieza en «1. Οἱ τρεῖς φωτιές.»; lo anterior es navegación de Wikisource
  const start = paras.findIndex((p) => /^\d+\.\s/.test(p));
  const title = paras[start].replace(/^\d+\.\s*/, '').replace(/\.$/, '');
  const body = paras.slice(start + 1).filter((p) => p && !/^&#\d+;$/.test(p));
  return { title, paragraphs: body };
}

export function sampleBook(): RawBook {
  return { title: 'Τα ψηλά βουνά (cap. 1–3)', author: 'Ζαχαρίας Παπαντωνίου', chapters: [c1, c2, c3].map(clean) };
}
