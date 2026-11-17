// IMP-1 / IMP-2 / IMP-3 — De archivo o texto pegado a libro + capítulos en IndexedDB.
import type { Book, Chapter, ElliDB } from '../db.ts';
import type { DictSource } from './lookup.ts';
import { lookup } from './lookup.ts';
import { formKey, isPolytonic, toMonotonic } from './normalize.ts';
import { isTargetWord, type TargetLang } from './langs.ts';
import { textToSentences, words, type Sentence } from './text.ts';
import type { RawBook, RawChapter } from './epub.ts';

const HEADING = /^\s*(?:ΚΕΦΑΛΑΙΟ|Κεφάλαιο|ΚΕΦ\.|ΜΕΡΟΣ|Μέρος|ΒΙΒΛΙΟ|Βιβλίο|CHAPTER|Chapter|Capítulo|CAPÍTULO|PARTE|Parte|LIBRO|Libro|TRATADO|Tratado)(?=[\s.:]|$).{0,60}$|^\s*[IVXLCΙ]{1,6}\.?\s*$|^\s*\d{1,3}\s*$/u;
const WORDS_PER_CHUNK = 2500;

/** Decodifica un TXT: UTF-8 y, si no cuadra, la página de Windows del idioma (1253 griego, 1252 español). */
export function decodeText(buf: ArrayBuffer | Uint8Array, lang: TargetLang = 'el'): string {
  const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  const utf8 = new TextDecoder('utf-8').decode(bytes);
  const bad = (utf8.match(/�/g) ?? []).length;
  if (bad > 5 && bad > utf8.length / 1000) {
    try {
      return new TextDecoder(lang === 'el' ? 'windows-1253' : 'windows-1252').decode(bytes);
    } catch {
      /* sin soporte: nos quedamos con UTF-8 */
    }
  }
  return utf8.replace(/^﻿/, '');
}

/** Trocea un texto plano en capítulos: por encabezados si los hay, si no por bloques de ~2500 palabras. */
export function textToRawBook(
  text: string,
  title: string,
  labels: { start: string; part: (n: number) => string } = { start: 'Inicio', part: (n) => `Parte ${n}` },
): RawBook {
  const t = text.replace(/\r\n?/g, '\n');
  const blocks = /\n\s*\n/.test(t) ? t.split(/\n\s*\n/) : t.split('\n');
  const paragraphs = blocks.map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);

  const headingIdx = paragraphs.map((p, i) => (HEADING.test(p) ? i : -1)).filter((i) => i >= 0);
  const chapters: RawChapter[] = [];
  if (headingIdx.length >= 2) {
    if (headingIdx[0] > 0) chapters.push({ title: labels.start, paragraphs: paragraphs.slice(0, headingIdx[0]) });
    headingIdx.forEach((start, n) => {
      const end = headingIdx[n + 1] ?? paragraphs.length;
      const body = paragraphs.slice(start + 1, end);
      // Un encabezado seguido de una línea corta suele ser «ΚΕΦΑΛΑΙΟ 1 / Τίτλος»
      let ttl = paragraphs[start];
      if (body.length > 1 && body[0].length < 60 && !/[.;!]$/.test(body[0])) ttl += ' · ' + body.shift();
      if (body.length) chapters.push({ title: ttl, paragraphs: body });
    });
  } else {
    let cur: string[] = [];
    let count = 0;
    for (const p of paragraphs) {
      cur.push(p);
      count += p.split(/\s+/).length;
      if (count >= WORDS_PER_CHUNK) {
        chapters.push({ title: labels.part(chapters.length + 1), paragraphs: cur });
        cur = [];
        count = 0;
      }
    }
    if (cur.length) chapters.push({ title: chapters.length ? labels.part(chapters.length + 1) : title, paragraphs: cur });
  }
  return { title, chapters: chapters.length ? chapters : [{ title, paragraphs: ['(vacío)'] }] };
}

function uid(): string {
  return globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/** Vocabulario de un conjunto de frases: clave de forma → apariciones */
export function countForms(sentences: Sentence[], lang: TargetLang = 'el'): Map<string, number> {
  const m = new Map<string, number>();
  for (const s of sentences) {
    for (const w of words(s.text)) {
      if (!isTargetWord(w, lang)) continue;
      const k = formKey(w);
      if (k) m.set(k, (m.get(k) ?? 0) + 1);
    }
  }
  return m;
}

/** Lema principal de cada forma: elección del usuario, si no el primer candidato del diccionario. */
export async function resolveLemmas(
  keys: string[],
  src: DictSource & { prefetch?: (keys: string[]) => Promise<Map<string, unknown[]>> },
  choices: Map<string, string>,
): Promise<Map<string, string>> {
  const out = new Map<string, string>();
  if (src.prefetch) await src.prefetch(keys);
  for (const k of keys) {
    const chosen = choices.get(k);
    if (chosen) { out.set(k, chosen); continue; }
    const exact = await src.form(k);
    if (exact?.length) { out.set(k, exact[0][0]); continue; }
    const r = await lookup(k, src);
    out.set(k, r.candidates[0]?.lemma ?? '');
  }
  return out;
}

export interface ImportResult { book: Book; chapters: Chapter[] }

export async function rawBookToRecords(
  raw: RawBook,
  source: Book['source'],
  src: DictSource | null,
  choices: Map<string, string> = new Map(),
  lang: TargetLang = src?.lang ?? 'el',
): Promise<ImportResult> {
  const id = uid();
  const now = Date.now();
  // Se decide a nivel de libro: un capítulo corto puede no tener ningún espíritu
  const polytonic = lang === 'el' && isPolytonic(raw.chapters.map((c) => c.paragraphs.join('\n')).join('\n'));
  const norm = (t: string) => (lang === 'el' ? toMonotonic(t, polytonic) : t.normalize('NFC'));
  const chapters: Chapter[] = raw.chapters.map((c, index) => ({
    id: `${id}:${index}`,
    bookId: id,
    index,
    title: norm(c.title),
    sentences: textToSentences(c.paragraphs.join('\n\n'), String(index), polytonic, lang),
    updatedAt: now,
  }));
  const counts = new Map<string, number>();
  for (const c of chapters) for (const [k, n] of countForms(c.sentences, lang)) counts.set(k, (counts.get(k) ?? 0) + n);
  const lemmaOf = src ? await resolveLemmas([...counts.keys()], src, choices) : new Map<string, string>();
  const vocab: Book['vocab'] = {};
  for (const [k, n] of counts) vocab[k] = [lemmaOf.get(k) ?? '', n];
  const book: Book = {
    id,
    title: norm(raw.title),
    author: raw.author && norm(raw.author),
    importedAt: now,
    updatedAt: now,
    pos: { chapter: 0, sentence: 0 },
    chapterCount: chapters.length,
    vocab,
    source,
  };
  return { book, chapters };
}

export async function saveImport(database: ElliDB, r: ImportResult) {
  await database.transaction('rw', database.books, database.chapters, async () => {
    await database.books.put(r.book);
    await database.chapters.bulkPut(r.chapters);
  });
}
