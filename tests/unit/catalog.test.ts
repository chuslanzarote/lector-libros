// IMP-5 / IMP-6 — Catálogo: formato de los libros, nivel estimado y contenido publicado.
import { describe, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { gunzipSync, gzipSync } from 'node:zlib';
import { join } from 'node:path';
import { parseBookBytes, readingTime, type CatalogFile } from '../../src/lib/catalog.ts';
import { difficulty, levelOf, CUTS, LEVELS } from '../../scripts/catalog/level.ts';
import { PD_DIED_BEFORE } from '../../scripts/catalog/pd.ts';
import { isHeading, splitChapters } from '../../scripts/catalog/chapters.ts';

const raw = { title: 'Δοκιμή', chapters: [{ title: 'Α', paragraphs: ['Καλημέρα, κόσμε.'] }] };

describe('parseBookBytes', () => {
  it('lee el libro comprimido con gzip', async () => {
    const gz = new Uint8Array(gzipSync(Buffer.from(JSON.stringify(raw))));
    expect(await parseBookBytes(gz)).toEqual(raw);
  });
  it('acepta también el JSON ya descomprimido por el servidor', async () => {
    expect(await parseBookBytes(new TextEncoder().encode(JSON.stringify(raw)))).toEqual(raw);
  });
});

describe('nivel estimado', () => {
  const base = { words: 1000, top1k: 75, top3k: 85, unknown: 3, sentenceLen: 10, archaic: 0 };
  it('más vocabulario raro, frases largas o registro antiguo → más difícil', () => {
    const d = difficulty(base);
    expect(difficulty({ ...base, top3k: 75 })).toBeGreaterThan(d);
    expect(difficulty({ ...base, sentenceLen: 25 })).toBeGreaterThan(d);
    expect(difficulty({ ...base, archaic: 4 })).toBeGreaterThan(d);
  });
  it('los cortes son crecientes y cubren los cuatro niveles', () => {
    expect(CUTS.A2).toBeLessThan(CUTS.B1);
    expect(CUTS.B1).toBeLessThan(CUTS.B2);
    expect(levelOf(CUTS.A2 - 0.1)).toBe('A2');
    expect(levelOf(CUTS.A2)).toBe('B1');
    expect(levelOf(CUTS.B2)).toBe('C1');
    expect(LEVELS).toEqual(['A2', 'B1', 'B2', 'C1']);
  });
});

describe('capítulos del catálogo', () => {
  it('reconoce encabezados pero no nombres de personaje ni frases', () => {
    for (const h of ["ΚΕΦΑΛΑΙΟΝ Ζ'.", 'ΠΡΑΞΙΣ ΤΡΙΤΗ', 'XXI', "ΙΓ'", 'Ο ΑΡΧΑΙΟΛΟΓΟΣ']) expect(isHeading(h), h).toBe(true);
    for (const p of ['ΑΜΛΕΤΟΣ.', 'ΠΡΩΤΟΣ ΦΡΟΥΡΟΣ.', 'Ο Αντώνης ήταν πολύ σκάνταλος.', 'Καλημέρα,']) expect(isHeading(p), p).toBe(false);
  });
  it('parte un capítulo enorme por sus encabezados y trocea lo que siga siendo largo', () => {
    const filler = (n: number) => Array.from({ length: n }, () => 'λέξη '.repeat(100).trim());
    const ch = { title: 'Όλο', paragraphs: ['ΚΕΦΑΛΑΙΟΝ Α΄', ...filler(30), 'ΚΕΦΑΛΑΙΟΝ Β΄', 'Η ΘΑΛΑΣΣΑ', ...filler(80)] };
    const out = splitChapters([ch]);
    expect(out[0].title).toBe('Όλο');
    expect(out[1].title).toBe('ΚΕΦΑΛΑΙΟΝ Β΄ · Η ΘΑΛΑΣΣΑ (1/3)');
    expect(out.length).toBe(4);
    expect(out.flatMap((c) => c.paragraphs).length).toBe(ch.paragraphs.length - 2);
  });
  it('encabezados en español', () => {
    for (const h of ['CAPÍTULO III', 'Capítulo primero', 'JORNADA SEGUNDA', 'LA CASA DEL MOLINO']) expect(isHeading(h, 'es'), h).toBe(true);
    for (const p of ['DON PEDRO.', 'Era una noche oscura.']) expect(isHeading(p, 'es'), p).toBe(false);
    expect(isHeading('LA CASA DEL MOLINO', 'el')).toBe(false);
  });
  it('no toca capítulos de tamaño normal', () => {
    const ch = { title: 'Α', paragraphs: ['ΙΙ', 'κείμενο'] };
    expect(splitChapters([ch])).toEqual([ch]);
  });
});

describe('readingTime', () => {
  it('redondea a minutos u horas', () => {
    expect(readingTime(300)).toBe('5 min');
    expect(readingTime(3600)).toBe('30 min');
    expect(readingTime(36000)).toBe('5,0 h');
  });
});

for (const lang of ['el', 'es'] as const) {
const CATALOG = join(__dirname, '..', '..', 'public', 'catalog', lang, 'catalog.json');
describe.runIf(existsSync(CATALOG))(`catálogo publicado (${lang})`, () => {
  const cat: CatalogFile = existsSync(CATALOG) ? JSON.parse(readFileSync(CATALOG, 'utf8')) : { version: 1, levels: [], books: [] };
  it('cada libro existe, es de dominio público y su nivel cuadra con su puntuación', () => {
    for (const b of cat.books) {
      const file = join(CATALOG, '..', b.file);
      expect(existsSync(file), b.file).toBe(true);
      expect(b.authorDied).toBeLessThan(PD_DIED_BEFORE);
      // el nivel es el de la puntuación, o más alto si es una obra clásica (IMP-7)
      expect(LEVELS.indexOf(b.level)).toBeGreaterThanOrEqual(LEVELS.indexOf(levelOf(b.score, lang)));
      if (b.level !== levelOf(b.score, lang)) expect(b.archaic && b.level === 'C1').toBe(true);
    }
  });
  it('tiene un reparto razonable por nivel', () => {
    for (const l of cat.levels) {
      const n = cat.books.filter((b) => b.level === l).length;
      expect(n, l).toBeGreaterThanOrEqual(10);
      expect(n, l).toBeLessThanOrEqual(lang === 'el' ? 15 : 20);
    }
  });
  it('los ficheros se descomprimen a un libro con capítulos y texto', () => {
    const b = cat.books[0];
    const book = JSON.parse(gunzipSync(readFileSync(join(CATALOG, '..', b.file))).toString('utf8'));
    expect(book.chapters.length).toBe(b.chapters);
    expect(book.chapters[0].paragraphs.length).toBeGreaterThan(0);
  });
});
}
