// Acceso global al diccionario instalado y a la búsqueda con el diccionario personal (DIC-5).
import { db } from './db.ts';
import { getDictMeta, idbSource, type DictMeta } from './lib/dictStore.ts';
import { lookup, type LookupResult } from './lib/lookup.ts';

type Source = ReturnType<typeof idbSource>;
let current: { meta: DictMeta; src: Source } | null = null;

export async function loadSource(): Promise<{ meta: DictMeta; src: Source } | null> {
  const meta = await getDictMeta(db);
  if (!meta) return null;
  if (!current || current.meta.version !== meta.version || current.meta.loadedAt !== meta.loadedAt) {
    current = { meta, src: idbSource(db, meta) };
  }
  return current;
}

export function source(): Source {
  if (!current) throw new Error('Diccionario no cargado');
  return current.src;
}

export function dictMeta(): DictMeta | undefined {
  return current?.meta;
}

/** Búsqueda completa: diccionario + traducciones propias + lema elegido antes para esta forma. */
export async function lookupWithUser(token: string): Promise<LookupResult & { chosen?: string }> {
  const src = source();
  const r = await lookup(token, src);
  const keys = r.candidates.map((c) => c.lemma);
  const [user, choice] = await Promise.all([db.userDict.bulkGet(keys), db.formChoices.get(r.key)]);
  r.candidates.forEach((c, i) => (c.user = user[i]?.translation));
  // Forma sin entrada en el diccionario pero con traducción propia
  if (!r.candidates.length) {
    const own = await db.userDict.get(r.key);
    if (own) r.candidates.push({ lemma: r.key, analyses: [], es: [], en: [], user: own.translation, via: 'lemma' });
  }
  if (choice) {
    const i = r.candidates.findIndex((c) => c.lemma === choice.lemma);
    if (i > 0) r.candidates.unshift(...r.candidates.splice(i, 1));
  }
  return { ...r, chosen: choice?.lemma };
}

export function dictUrl(file: string): string {
  return new URL(`dict/${file}`, document.baseURI).href;
}

export interface DictManifest { version: string; bytes: number; sha256: string; counts: Record<string, number> }

export async function fetchManifest(): Promise<DictManifest | null> {
  try {
    const r = await fetch(dictUrl('manifest.json'), { cache: 'no-cache' });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

/** Instala (o reinstala) el diccionario en un worker. */
export function installInWorker(onProgress: (phase: string, p: number) => void): Promise<string> {
  return new Promise((resolve, reject) => {
    const w = new Worker(new URL('./workers/dictLoader.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = (e) => {
      const m = e.data;
      if (m.type === 'progress') onProgress(m.phase, m.p);
      else if (m.type === 'done') { w.terminate(); current = null; resolve(m.version); }
      else if (m.type === 'error') { w.terminate(); reject(new Error(m.message)); }
    };
    w.onerror = (e) => { w.terminate(); reject(new Error(e.message || 'Error en el worker')); };
    onProgress('download', 0);
    w.postMessage({ url: dictUrl('dict.json.gz') });
  });
}
