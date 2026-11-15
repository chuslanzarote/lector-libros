// IMP-5 / IMP-6 — Genera el catálogo de libros de dominio público con nivel estimado.
//   npm run build:catalog              → public/catalog/catalog.json + public/catalog/books/<id>.json.gz
//   npm run build:catalog -- --survey  → sólo mide y muestra la tabla (no escribe nada)
//   npm run build:catalog -- --update  → vuelve a descargar las fuentes y actualiza lock.json
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { fromGutenberg, fromWikisource, NON_TEXT_CHAPTER, options, ROOT, saveLock, type WsSpec } from './fetch.ts';
import { freqFile, lemmaRanks, Leveler, levelOf, CUTS, LEVELS, type Metrics } from './level.ts';
import { loadDict } from '../build-dict/sample.ts';
import { PD_DIED_BEFORE } from './pd.ts';
import { splitChapters } from './chapters.ts';
import type { RawBook } from '../../src/lib/epub.ts';
import type { CatalogEntry, CatalogFile } from '../../src/lib/catalog.ts';


interface Spec {
  id: string;
  title: string;
  author: string;
  authorDied: number;
  translator?: string;
  translatorDied?: number;
  /** obra original si es traducción */
  original?: string;
  kind: CatalogEntry['kind'];
  year?: number;
  ws?: WsSpec;
  pg?: number[];
  /** quita capítulos cuyo título encaje (índices, notas del transcriptor…) */
  dropChapters?: string;
  /** «true»: candidato sólo para --survey */
  skip?: boolean;
}

const args = process.argv.slice(2);
const survey = args.includes('--survey');
options.update = args.includes('--update');
const only = args.find((a) => a.startsWith('--only='))?.slice(7).split(',');

const specs: Spec[] = JSON.parse(readFileSync(join(ROOT, 'scripts', 'catalog', 'books.json'), 'utf8'));
const OUT = join(ROOT, 'public', 'catalog');

function checkLicense(s: Spec) {
  const bad = [
    s.authorDied >= PD_DIED_BEFORE && `autor (${s.authorDied})`,
    s.translator && !(s.translatorDied && s.translatorDied < PD_DIED_BEFORE) && `traductor (${s.translatorDied ?? 'año desconocido'})`,
  ].filter(Boolean);
  if (bad.length) throw new Error(`«${s.title}» no es de dominio público: ${bad.join(', ')}`);
}

function sourceOf(s: Spec): CatalogEntry['source'] {
  if (s.pg) return { name: 'Project Gutenberg', url: `https://www.gutenberg.org/ebooks/${s.pg[0]}` };
  const page = s.ws?.page ?? s.ws?.pages?.[0] ?? '';
  return { name: 'Βικιθήκη (Wikisource)', url: s.ws?.page ? `https://el.wikisource.org/wiki/${encodeURIComponent(page.replace(/ /g, '_'))}` : 'https://el.wikisource.org' };
}

async function fetchBook(s: Spec): Promise<RawBook> {
  let raw: RawBook;
  if (s.pg) {
    const parts = [];
    for (const id of s.pg) parts.push(await fromGutenberg(id, s.title, s.author));
    raw = { title: s.title, author: s.author, chapters: parts.flatMap((p) => p.chapters) };
  } else if (s.ws) raw = await fromWikisource(s.ws, s.title, s.author);
  else throw new Error(`«${s.title}»: falta la fuente (ws o pg)`);
  raw.chapters = raw.chapters.filter((c) => !NON_TEXT_CHAPTER.test(c.title.trim()));
  if (s.dropChapters) {
    const re = new RegExp(s.dropChapters, 'iu');
    raw.chapters = raw.chapters.filter((c) => !re.test(c.title));
  }
  // Capítulos minúsculos (portadillas, dedicatorias) se funden con el siguiente
  const merged: RawBook['chapters'] = [];
  for (const c of raw.chapters) {
    const prev = merged[merged.length - 1];
    if (prev && prev.paragraphs.join(' ').split(/\s+/).length < 40) {
      prev.paragraphs.push(...c.paragraphs);
      prev.title = c.title;
    } else merged.push({ ...c, paragraphs: [...c.paragraphs] });
  }
  raw.chapters = splitChapters(merged);
  return raw;
}

if (!existsSync(freqFile(ROOT))) {
  console.error('Falta .cache/el_50k.txt: ejecuta antes «npm run build:dict» (descarga la lista de frecuencias).');
  process.exit(1);
}
const dict = loadDict();
const leveler = new Leveler(dict, lemmaRanks(dict, freqFile(ROOT)));

const rows: { s: Spec; m: Metrics; raw: RawBook }[] = [];
for (const s of specs) {
  if (only && !only.includes(s.id)) continue;
  if (s.skip && !survey) continue;
  try {
    checkLicense(s);
    const raw = await fetchBook(s);
    const m = await leveler.measure(raw);
    rows.push({ s, m, raw });
    console.log(`${s.id.padEnd(28)} ${String(m.score).padStart(5)} ${levelOf(m.score)}  ${m.words} palabras, top3k ${m.top3k} %, desc. ${m.unknown} %, frase ${m.sentenceLen}, kath. ${m.katharevousa} %`);
  } catch (e) {
    console.error(`✗ ${s.id}: ${(e as Error).message}`);
    if (!survey) process.exitCode = 1;
  }
  saveLock();
}

if (survey) {
  console.log('\nOrdenados por dificultad:');
  for (const { s, m } of [...rows].sort((a, b) => a.m.score - b.m.score)) {
    console.log(`${String(m.score).padStart(5)}  ${levelOf(m.score)}  ${s.id.padEnd(28)} ${String(m.words).padStart(7)}  ${s.skip ? '(candidato)' : ''}`);
  }
  console.log('Cortes actuales:', CUTS);
} else if (process.exitCode !== 1) {
  mkdirSync(join(OUT, 'books'), { recursive: true });
  const wanted = new Set(rows.map((r) => `${r.s.id}.json.gz`));
  if (!only) for (const f of readdirSync(join(OUT, 'books'))) if (!wanted.has(f)) rmSync(join(OUT, 'books', f));
  const previous: CatalogFile | undefined = existsSync(join(OUT, 'catalog.json')) ? JSON.parse(readFileSync(join(OUT, 'catalog.json'), 'utf8')) : undefined;
  const entries = new Map((only ? previous?.books ?? [] : []).map((b) => [b.id, b]));
  for (const { s, m, raw } of rows) {
    const gz = gzipSync(Buffer.from(JSON.stringify(raw)), { level: 9 });
    writeFileSync(join(OUT, 'books', `${s.id}.json.gz`), gz);
    entries.set(s.id, {
      id: s.id,
      title: s.title,
      author: s.author,
      authorDied: s.authorDied,
      translator: s.translator,
      original: s.original,
      kind: s.kind,
      year: s.year,
      level: levelOf(m.score),
      score: m.score,
      words: m.words,
      chapters: raw.chapters.length,
      top3k: m.top3k,
      katharevousa: m.katharevousa >= 1.5,
      file: `books/${s.id}.json.gz`,
      bytes: gz.length,
      source: sourceOf(s),
    });
  }
  const books = [...entries.values()].sort((a, b) => a.score - b.score);
  const catalog: CatalogFile = { version: 1, levels: LEVELS, books };
  writeFileSync(join(OUT, 'catalog.json'), JSON.stringify(catalog, null, 1) + '\n');
  const per = Object.fromEntries(LEVELS.map((l) => [l, books.filter((b) => b.level === l).length]));
  const total = books.reduce((n, b) => n + b.bytes, 0);
  console.log(`\n${books.length} libros (${JSON.stringify(per)}), ${(total / 1e6).toFixed(1)} MB comprimidos.`);
}
