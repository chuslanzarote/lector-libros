// IMP-5 / IMP-6 / IMP-7 — Catálogo de libros de dominio público incluidos en el repo
// (public/catalog/<lang>/, uno por idioma de estudio).
// Los libros no se precachean: se descargan al elegirlos y a partir de ahí viven en IndexedDB.
import type { RawBook } from './epub.ts';
import type { TargetLang } from './langs.ts';

export type CatalogLevel = 'A2' | 'B1' | 'B2' | 'C1';

export interface CatalogEntry {
  id: string;
  title: string;
  author: string;
  authorDied: number;
  translator?: string;
  original?: string;
  kind: 'novela' | 'cuentos' | 'infantil' | 'poesía' | 'teatro' | 'épica';
  year?: number;
  level: CatalogLevel;
  /** dificultad continua (mayor = más difícil), para ordenar dentro del nivel */
  score: number;
  words: number;
  chapters: number;
  /** % de palabras entre los 3000 lemas más frecuentes */
  top3k: number;
  /** narrado en buena parte en un registro antiguo: katharévousa en griego, español clásico en español */
  archaic: boolean;
  file: string;
  bytes: number;
  source: { name: string; url: string };
}

export interface CatalogFile {
  version: number;
  levels: CatalogLevel[];
  books: CatalogEntry[];
}

const base = (lang: TargetLang) => new URL(`catalog/${lang}/`, document.baseURI);

export async function fetchCatalog(lang: TargetLang): Promise<CatalogFile> {
  const res = await fetch(new URL('catalog.json', base(lang)), { cache: 'no-cache' });
  if (!res.ok) throw new Error(`No se pudo cargar el catálogo (HTTP ${res.status})`);
  return res.json();
}

/** Descarga y descomprime un libro del catálogo (los .gz se sirven tal cual, sin Content-Encoding). */
export async function fetchCatalogBook(entry: CatalogEntry, lang: TargetLang): Promise<RawBook> {
  const res = await fetch(new URL(entry.file, base(lang)));
  if (!res.ok) throw new Error(`No se pudo descargar «${entry.title}» (HTTP ${res.status})`);
  return parseBookBytes(new Uint8Array(await res.arrayBuffer()));
}

export async function parseBookBytes(bytes: Uint8Array): Promise<RawBook> {
  let text: string;
  if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
    const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('gzip'));
    text = await new Response(stream).text();
  } else text = new TextDecoder().decode(bytes); // el servidor ya lo descomprimió
  return JSON.parse(text) as RawBook;
}

/** Tiempo de lectura atenta en L2, con consultas (~120 palabras/min): «25 min», «3,5 h» */
export function readingTime(words: number, locale = 'es'): string {
  const min = Math.round(words / 120);
  if (min < 60) return `${Math.max(5, Math.round(min / 5) * 5)} min`;
  const h = min / 60;
  return h < 10 ? `${h.toLocaleString(locale, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} h` : `${Math.round(h)} h`;
}
