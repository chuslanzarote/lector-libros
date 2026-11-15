// IMP-5 — Descarga de textos de dominio público (Wikisource griega y Project Gutenberg) a RawBook.
// Todo se cachea en .cache/catalog/ y las versiones quedan fijadas en scripts/catalog/lock.json
// (revid de Wikisource, sha256 de Gutenberg), igual que las fuentes del diccionario.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { extractParagraphs, parseEpub, type RawBook, type RawChapter } from '../../src/lib/epub.ts';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const CACHE = join(ROOT, '.cache', 'catalog');
const LOCK_FILE = join(ROOT, 'scripts', 'catalog', 'lock.json');
const UA = 'elliniko-catalog/0.1 (proyecto personal sin ánimo de lucro; lector de griego)';
const WS_API = 'https://el.wikisource.org/w/api.php';

// parseEpub/extractParagraphs usan DOMParser del navegador
const win = new JSDOM('').window;
(globalThis as Record<string, unknown>).DOMParser ??= win.DOMParser;

type Lock = Record<string, string | number>;
export const lock: Lock = existsSync(LOCK_FILE) ? JSON.parse(readFileSync(LOCK_FILE, 'utf8')) : {};
export const options = { update: false };
export function saveLock() {
  const sorted = Object.fromEntries(Object.entries(lock).sort(([a], [b]) => a.localeCompare(b)));
  writeFileSync(LOCK_FILE, JSON.stringify(sorted, null, 2) + '\n');
}

let last = 0;
async function politeFetch(url: string): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    const wait = last + 1200 - Date.now();
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    last = Date.now();
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status === 429 || res.status >= 500) {
      if (attempt > 4) throw new Error(`${res.status} en ${url}`);
      await new Promise((r) => setTimeout(r, 5000 * (attempt + 1)));
      continue;
    }
    return res;
  }
}

const safe = (s: string) => s.replace(/[\\/:*?"<>|' ]/g, '_');

// ---------- Wikisource ----------

interface WsPage { revid: number; html: string }

async function wsParse(title: string): Promise<WsPage> {
  mkdirSync(join(CACHE, 'ws'), { recursive: true });
  const key = `ws:${title}`;
  const pinned = !options.update && typeof lock[key] === 'number' ? (lock[key] as number) : undefined;
  if (pinned) {
    const f = join(CACHE, 'ws', `${pinned}.html`);
    if (existsSync(f)) return { revid: pinned, html: readFileSync(f, 'utf8') };
  }
  const params = new URLSearchParams({ action: 'parse', prop: 'text|revid', format: 'json', formatversion: '2', redirects: '1', maxlag: '5' });
  if (pinned) params.set('oldid', String(pinned));
  else params.set('page', title);
  const res = await politeFetch(`${WS_API}?${params}`);
  const text = await res.text();
  let j: { parse?: { revid: number; text: string }; error?: { info: string } };
  try { j = JSON.parse(text); } catch { throw new Error(`Wikisource devolvió algo raro para «${title}»: ${text.slice(0, 100)}`); }
  if (!j.parse) throw new Error(`Wikisource: «${title}»: ${j.error?.info ?? 'sin texto'}`);
  lock[key] = j.parse.revid;
  writeFileSync(join(CACHE, 'ws', `${j.parse.revid}.html`), j.parse.text);
  return { revid: j.parse.revid, html: j.parse.text };
}

const NOISE = [
  'style', 'script', '.headertemplate', '#headertemplate', '.ws-noexport', '.noprint', '.mw-editsection',
  '.pagenum', '.ws-pagenum', 'sup', '.reference', '.references', '.mw-references-wrap', '.catlinks',
  '.licenseContainer', '.ws-header', '#ws-title', '#ws-author', '.mw-heading', 'table.wikitable', '.toc', '#toc',
];

function wsDocument(html: string): Document {
  const doc = new JSDOM(`<!doctype html><html><body>${html}</body></html>`).window.document;
  for (const sel of NOISE) doc.querySelectorAll(sel).forEach((e) => e.remove());
  return doc;
}

/** Enlaces a subpáginas «Obra/…» en el orden del índice, con su texto como título de capítulo. */
function subpageLinks(html: string, title: string): { page: string; label: string }[] {
  const doc = new JSDOM(`<!doctype html><body>${html}`).window.document;
  const seen = new Set<string>();
  const out: { page: string; label: string }[] = [];
  doc.querySelectorAll('a[title]').forEach((a) => {
    const t = a.getAttribute('title')!;
    // Sin distinguir mayúsculas: las redirecciones cambian a veces la caja («Η Τιμή και το Χρήμα»)
    if (!t.toLocaleLowerCase('el').startsWith(title.toLocaleLowerCase('el') + '/') || seen.has(t) || a.closest('.headertemplate')) return;
    seen.add(t);
    out.push({ page: t, label: (a.textContent ?? '').replace(/\s+/g, ' ').trim() || t.slice(title.length + 1) });
  });
  return out;
}

function cleanParagraphs(ps: string[]): string[] {
  return ps
    .map((p) =>
      p
        .replace(/\[\s*\d+\s*\]/g, '') // llamadas a nota
        .replace(/&&/g, '') // negritas marcadas por el transcriptor de Gutenberg
        .replace(/(^|[\s(«“])_([^_]+)_(?=$|[\s.,;:!?»”)])/g, '$1$2') // cursivas _así_
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(
      (p) =>
        p &&
        !/^(Περιεχόμενα|Επεξεργασία|←|→|Δείτε επίσης)/.test(p) &&
        !/^\[?\s*Επεξεργασία\s*\]?$/.test(p) &&
        // cuerpo de una nota al pie: «1) …», «[2] …», «* …»
        !/^(\d{1,3}\)|\*+)\s/.test(p) &&
        // números de página o de verso, separadores de estrofa («.», «* * *»)
        !/^\[?\d{1,4}\]?$/.test(p) &&
        !/^[.·…*\s]+$/.test(p),
    );
}

export interface WsSpec {
  /** página de Wikisource; si tiene subpáginas «Obra/…» cada una es un capítulo */
  page?: string;
  /** antología: varias páginas, cada una un capítulo (títulos = nombre de la página) */
  pages?: string[];
}

export async function fromWikisource(spec: WsSpec, title: string, author: string): Promise<RawBook> {
  const chapters: RawChapter[] = [];
  const addPage = async (page: string, label: string, recurse: boolean) => {
    const { html } = await wsParse(page);
    const subs = recurse ? subpageLinks(html, page) : [];
    if (subs.length) {
      for (const s of subs) await addPage(s.page, s.label, false);
      return;
    }
    const paragraphs = cleanParagraphs(extractParagraphs(wsDocument(html)).paragraphs);
    if (paragraphs.length) chapters.push({ title: label, paragraphs });
  };
  if (spec.page) await addPage(spec.page, title, true);
  for (const p of spec.pages ?? []) {
    try {
      await addPage(p, p.replace(/\s*\([^)]*\)$/, ''), true);
    } catch (e) {
      console.warn(`  ⚠ ${title}: se omite «${p}» (${(e as Error).message})`);
    }
  }
  if (!chapters.length) throw new Error(`Sin texto: ${title}`);
  return { title, author, chapters };
}

// ---------- Project Gutenberg ----------

const START = /\*\*\*\s*START OF (THE|THIS) PROJECT GUTENBERG/i;
const END = /\*\*\*\s*END OF (THE|THIS) PROJECT GUTENBERG/i;
/** Notas del transcriptor («The tonic system has been changed…», «Produced by…») */
const TRANSCRIBER = /^(Note:|Notes?:|Σημείωση:|Produced by|E-text prepared|Transcriber)|tonic system|τονικό σύστημα/i;
/** Capítulos que no son texto de lectura */
export const NON_TEXT_CHAPTER = /^(ΣΗΜΕΙΩΣΕΙΣ|Σημειώσεις|Υποσημειώσεις|ΥΠΟΣΗΜΕΙΩΣΕΙΣ|Footnotes|Endnotes|Notes|ΠΕΡΙΕΧΟΜΕΝΑ|Περιεχόμενα|ΠΙΝΑΞ|Πίναξ|Contents|Table of contents)(?=[\s.:]|$)/u;

export async function fromGutenberg(id: number, title: string, author: string): Promise<RawBook> {
  mkdirSync(join(CACHE, 'pg'), { recursive: true });
  const file = join(CACHE, 'pg', `${id}.epub`);
  const key = `pg:${id}`;
  if (!existsSync(file) || options.update) {
    const res = await politeFetch(`https://www.gutenberg.org/cache/epub/${id}/pg${id}-images-3.epub`);
    if (!res.ok) throw new Error(`Gutenberg ${id}: HTTP ${res.status}`);
    writeFileSync(file, new Uint8Array(await res.arrayBuffer()));
  }
  const data = readFileSync(file);
  const sha = createHash('sha256').update(data).digest('hex');
  if (lock[key] && lock[key] !== sha && !options.update) {
    throw new Error(`Gutenberg ${id}: el checksum no coincide con lock.json (usa --update para aceptar la versión nueva)`);
  }
  lock[key] = sha;
  const raw = await parseEpub(new Uint8Array(data));
  // Quita la cabecera y la licencia de Gutenberg
  let inside = !raw.chapters.some((c) => c.paragraphs.some((p) => START.test(p)));
  const chapters: RawChapter[] = [];
  for (const c of raw.chapters) {
    const kept: string[] = [];
    for (const p of c.paragraphs) {
      if (START.test(p)) { inside = true; continue; }
      if (END.test(p)) { inside = false; continue; }
      if (inside && !/Project Gutenberg|gutenberg\.org/i.test(p) && !TRANSCRIBER.test(p)) kept.push(p);
    }
    const ps = cleanParagraphs(kept);
    if (ps.length) chapters.push({ title: c.title, paragraphs: ps });
  }
  return { title, author, chapters };
}

export const cacheDir = CACHE;
export const sanitize = safe;
