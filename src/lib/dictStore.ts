// SYS-1 / DIC-2 — Diccionario en IndexedDB: carga inicial y DictSource para lookup().
import type { ElliDB } from '../db.ts';
import type { DictJson, DictSource, FormRow, LemmaRecord } from './lookup.ts';

export interface DictMeta { version: string; tags: string[]; loadedAt: number; counts: Record<string, number> }

/** Descomprime si viene en gzip (GitHub Pages lo sirve tal cual; algunos servidores ya lo descomprimen). */
export async function readDictResponse(res: Response): Promise<DictJson> {
  const buf = new Uint8Array(await res.arrayBuffer());
  let text: string;
  if (buf[0] === 0x1f && buf[1] === 0x8b) {
    const stream = new Blob([buf]).stream().pipeThrough(new DecompressionStream('gzip'));
    text = await new Response(stream).text();
  } else {
    text = new TextDecoder().decode(buf);
  }
  return JSON.parse(text) as DictJson;
}

/** Vuelca el diccionario a IndexedDB por lotes, informando del progreso (0–1). */
export async function installDict(database: ElliDB, dict: DictJson, onProgress?: (p: number) => void) {
  const CHUNK = 5000;
  const forms = Object.entries(dict.forms);
  const na = Object.entries(dict.noAccent);
  const lemmas = Object.entries(dict.lemmas);
  const total = forms.length + na.length + lemmas.length;
  let done = 0;

  await database.transaction('rw', [database.dictForms, database.dictNoAccent, database.dictLemmas, database.meta], async () => {
    await database.meta.delete('dict');
    await Promise.all([database.dictForms.clear(), database.dictNoAccent.clear(), database.dictLemmas.clear()]);
  });

  for (let i = 0; i < forms.length; i += CHUNK) {
    await database.dictForms.bulkPut(forms.slice(i, i + CHUNK).map(([k, r]) => ({ k, r })));
    done += Math.min(CHUNK, forms.length - i);
    onProgress?.(done / total);
  }
  for (let i = 0; i < na.length; i += CHUNK) {
    await database.dictNoAccent.bulkPut(na.slice(i, i + CHUNK).map(([k, v]) => ({ k, v })));
    done += Math.min(CHUNK, na.length - i);
    onProgress?.(done / total);
  }
  for (let i = 0; i < lemmas.length; i += CHUNK) {
    await database.dictLemmas.bulkPut(lemmas.slice(i, i + CHUNK).map(([l, rec]) => ({ l, ...rec })));
    done += Math.min(CHUNK, lemmas.length - i);
    onProgress?.(done / total);
  }
  // meta al final: sólo existe si el volcado terminó entero
  const meta: DictMeta = {
    version: dict.version,
    tags: dict.tags,
    loadedAt: Date.now(),
    counts: { forms: forms.length, noAccent: na.length, lemmas: lemmas.length },
  };
  await database.meta.put({ key: 'dict', value: meta });
  return meta;
}

export async function getDictMeta(database: ElliDB): Promise<DictMeta | undefined> {
  return (await database.meta.get('dict'))?.value as DictMeta | undefined;
}

/** DictSource sobre IndexedDB, con una caché pequeña en memoria. */
export function idbSource(database: ElliDB, meta: DictMeta): DictSource & { prefetch(keys: string[]): Promise<Map<string, FormRow[]>> } {
  const formCache = new Map<string, FormRow[] | undefined>();
  const lemmaCache = new Map<string, LemmaRecord | undefined>();
  return {
    async form(k) {
      if (formCache.has(k)) return formCache.get(k);
      const r = (await database.dictForms.get(k))?.r;
      formCache.set(k, r);
      return r;
    },
    async noAccent(k) {
      return (await database.dictNoAccent.get(k))?.v;
    },
    async lemma(l) {
      if (lemmaCache.has(l)) return lemmaCache.get(l);
      const row = await database.dictLemmas.get(l);
      let rec: LemmaRecord | undefined;
      if (row) {
        const { l: _l, ...rest } = row;
        rec = rest;
      }
      lemmaCache.set(l, rec);
      return rec;
    },
    tag: (id) => meta.tags[id] ?? '',
    /** Carga de golpe las formas de un capítulo para colorear sin esperar */
    async prefetch(keys) {
      const missing = keys.filter((k) => !formCache.has(k));
      if (missing.length) {
        const rows = await database.dictForms.bulkGet(missing);
        missing.forEach((k, i) => formCache.set(k, rows[i]?.r));
      }
      const out = new Map<string, FormRow[]>();
      for (const k of keys) {
        const r = formCache.get(k);
        if (r) out.set(k, r);
      }
      return out;
    },
  };
}
