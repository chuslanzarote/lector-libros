// DIC-1 / DIC-7 — Piezas comunes del build del diccionario: fuentes fijadas, acumulación de
// formas → lemas, frecuencias y salida en formato 2 (ver docs/PRD.md, «El diccionario»).
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formKey, noAccentKey } from '../../src/lib/normalize.ts';
import { isTargetWord, type Lang, type TargetLang } from '../../src/lib/langs.ts';
import { DICT_FORMAT, type DictJson, type FormRow, type LemmaRecord } from '../../src/lib/lookup.ts';
import { baseLabel, CASE_TAGS, describePos } from './tags.ts';

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export const CACHE = join(ROOT, '.cache');
export const SOURCES_PATH = join(ROOT, 'scripts', 'build-dict', 'sources.json');
const MAX_SENSES = 6;
const MAX_GLOSS = 140;

export interface Source {
  id: string; name: string; license: string; homepage: string; url: string; file: string;
  /** idiomas de estudio cuyo diccionario usa esta fuente */
  langs: TargetLang[];
  extract?: string; version: string; algo: string; checksum: string; fallbackUrl?: string; note?: string;
}

// ---------------------------------------------------------------- fuentes
async function download(url: string, dest: string) {
  console.log(`  ↓ ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Descarga fallida ${res.status} ${url}`);
  mkdirSync(dirname(dest), { recursive: true });
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()));
}

function hashFile(path: string, algo: string): Promise<string> {
  return new Promise((ok, fail) => {
    const h = createHash(algo);
    createReadStream(path).on('data', (d) => h.update(d)).on('end', () => ok(h.digest('hex'))).on('error', fail);
  });
}

export function readSources(): { sources: Source[] } {
  return JSON.parse(readFileSync(SOURCES_PATH, 'utf8'));
}

/** Descarga (si falta) y verifica las fuentes de un idioma. Devuelve id → ruta local. */
export async function ensureSources(lang: TargetLang, acceptNew: boolean): Promise<Record<string, string>> {
  mkdirSync(CACHE, { recursive: true });
  const cfg = readSources();
  const paths: Record<string, string> = {};
  let changed = false;
  for (const s of cfg.sources) {
    if (!s.langs.includes(lang)) continue;
    const p = join(CACHE, s.file);
    if (!existsSync(p)) await download(s.url, p);
    const sum = await hashFile(p, s.algo);
    if (sum !== s.checksum) {
      if (!acceptNew) {
        throw new Error(
          `Checksum distinto para ${s.id}.\n  esperado ${s.checksum}\n  obtenido ${sum}\n` +
            'Si la fuente se ha actualizado a propósito, ejecuta: npm run build:dict -- --accept-new',
        );
      }
      console.warn(`  ! ${s.id}: aceptado checksum nuevo`);
      s.checksum = sum;
      s.version = new Date().toISOString().slice(0, 10);
      changed = true;
    }
    if (s.extract) {
      const target = join(CACHE, s.extract);
      if (!existsSync(target)) execFileSync('tar', ['-xJf', s.file], { cwd: CACHE, stdio: 'inherit' });
      paths[s.id] = target;
    } else {
      paths[s.id] = p;
    }
  }
  if (changed) writeFileSync(SOURCES_PATH, JSON.stringify(cfg, null, 2) + '\n');
  return paths;
}

// ---------------------------------------------------------------- FreeDict (TEI)
export interface FdEntry { orth: string; pos?: string; trans: string[] }

function decodeXml(s: string) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

export function readFreeDict(path: string): FdEntry[] {
  const xml = readFileSync(path, 'utf8');
  const out: FdEntry[] = [];
  for (const m of xml.matchAll(/<entry\b[^>]*>([\s\S]*?)<\/entry>/g)) {
    const body = m[1];
    const orths = [...body.matchAll(/<orth>([\s\S]*?)<\/orth>/g)].map((x) => decodeXml(x[1].trim()));
    const pos = body.match(/<pos>([\s\S]*?)<\/pos>/)?.[1]?.trim();
    const trans = [...body.matchAll(/<cit type="trans"[^>]*>\s*<quote>([\s\S]*?)<\/quote>/g)].map((x) => decodeXml(x[1].trim()));
    for (const orth of orths) if (orth && trans.length) out.push({ orth, pos, trans });
  }
  return out;
}

/** Lista de frecuencias (FrequencyWords): clave de forma → apariciones */
export function readFrequencies(path: string): Map<string, number> {
  const freq = new Map<string, number>();
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const [w, c] = line.trim().split(' ');
    if (w && c) {
      const k = formKey(w);
      freq.set(k, (freq.get(k) ?? 0) + Number(c));
    }
  }
  return freq;
}

// ---------------------------------------------------------------- acumulador
export interface LemmaInfo {
  pos: Set<string>;
  gender: Set<string>;
  gloss: Partial<Record<Lang, string[]>>;
  score: number;
}

export const SELF = '__lemma__';

/** Describe un análisis (etiquetas inglesas) en un idioma de interfaz */
export type Describer = (tags: string[], ui: Lang) => string;

export function pushUnique(arr: string[], v: string, max = MAX_SENSES) {
  v = v.trim().replace(/\s+/g, ' ');
  if (!v) return;
  if (v.length > MAX_GLOSS) v = v.slice(0, MAX_GLOSS - 1).trimEnd() + '…';
  if (arr.length < max && !arr.includes(v)) arr.push(v);
}

// Etiquetas de registro/variante: no cambian el análisis gramatical
const REGISTER = new Set(['informal', 'colloquial', 'rare', 'uncommon', 'archaic', 'dated', 'formal', 'literary',
  'dialectal', 'regional', 'vernacular', 'obsolete', 'Katharevousa', 'Demotic', 'polytonic', 'Cyprus', 'nonstandard',
  'abbreviation', 'contraction', 'weak', 'possessive', 'short-form', 'indeclinable', 'vos-form']);

/** Funde análisis de una misma forma y lema que sólo difieren en el caso. */
function mergeCases(list: string[][]): string[][] {
  const groups = new Map<string, Set<string>>();
  for (const tags of list) {
    const base = tags.filter((t) => !CASE_TAGS.has(t)).sort().join('|');
    let g = groups.get(base);
    if (!g) groups.set(base, (g = new Set()));
    for (const t of tags) if (CASE_TAGS.has(t)) g.add(t);
  }
  return [...groups].map(([base, cases]) => [...(base ? base.split('|') : []), ...cases]);
}

/**
 * Quita análisis redundantes: los que están contenidos en otro más completo
 * («aoristo» ⊂ «aoristo, 1.ª sg., voz activa») y, a igualdad gramatical, los marcados
 * con registro (se prefiere la variante neutra).
 */
function reduceAnalyses(list: string[][]): string[][] {
  const items = list.map((t) => ({ t, core: new Set(t.filter((x) => !REGISTER.has(x))), reg: t.filter((x) => REGISTER.has(x)).length }));
  const subset = (a: Set<string>, b: Set<string>) => [...a].every((x) => b.has(x));
  const keep = items.filter((a, i) =>
    !items.some((b, j) => {
      if (i === j) return false;
      const ab = subset(a.core, b.core), ba = subset(b.core, a.core);
      if (ab && !ba) return true; // a estrictamente contenido en b
      if (ab && ba) return a.reg > b.reg || (a.reg === b.reg && j < i); // iguales: menos registro, o el primero
      return false;
    }),
  );
  // Si una variante neutra quedó absorbida por otra con registro, el registro no es fiable
  return keep.map((k) => {
    const neutralInside = items.some((d) => !keep.includes(d) && d.reg < k.reg && subset(d.core, k.core));
    return neutralInside ? k.t.filter((x) => !REGISTER.has(x)) : k.t;
  });
}

export class DictBuilder {
  /** forma (clave) → lema → lista de análisis (etiquetas inglesas significativas) */
  readonly analyses = new Map<string, Map<string, string[][]>>();
  readonly lemmas = new Map<string, LemmaInfo>();

  readonly lang: TargetLang;
  readonly glosses: Lang[];
  readonly uis: Lang[];
  readonly describe: Describer;

  // (Node ejecuta TS sólo quitando tipos: nada de «parameter properties»)
  constructor(lang: TargetLang, glosses: Lang[], uis: Lang[], describe: Describer) {
    this.lang = lang;
    this.glosses = glosses;
    this.uis = uis;
    this.describe = describe;
  }

  addAnalysis(form: string, lemma: string, tags: string[]) {
    const k = formKey(form);
    if (!k || !isTargetWord(k, this.lang)) return;
    let byLemma = this.analyses.get(k);
    if (!byLemma) this.analyses.set(k, (byLemma = new Map()));
    let list = byLemma.get(lemma);
    if (!list) byLemma.set(lemma, (list = []));
    list.push(tags);
  }

  lemmaInfo(word: string): LemmaInfo {
    let l = this.lemmas.get(word);
    if (!l) this.lemmas.set(word, (l = { pos: new Set(), gender: new Set(), gloss: {}, score: 0 }));
    return l;
  }

  gloss(info: LemmaInfo, lang: Lang): string[] {
    return (info.gloss[lang] ??= []);
  }

  /** Índice clave de forma → lemas existentes con esa clave (para enlazar diccionarios bilingües) */
  lemmaKeys(): Map<string, string[]> {
    const byKey = new Map<string, string[]>();
    for (const l of this.lemmas.keys()) {
      const k = formKey(l);
      const arr = byKey.get(k);
      if (arr) arr.push(l); else byKey.set(k, [l]);
    }
    return byKey;
  }

  /**
   * Formas cuyo «lema» es a su vez sólo una forma («fué» → fue → ser/ir): se enlazan con los
   * lemas de esa forma, conservando las etiquetas de variante.
   */
  resolveChains() {
    let n = 0;
    for (const byLemma of this.analyses.values()) {
      for (const [l, list] of [...byLemma]) {
        if (this.lemmas.has(l)) continue;
        const via = this.analyses.get(formKey(l));
        if (!via || via === byLemma) continue;
        const marks = [...new Set(list.flat().filter((t) => t !== SELF))];
        byLemma.delete(l);
        for (const [l2, list2] of via) {
          if (!this.lemmas.has(l2)) continue;
          const dest = byLemma.get(l2) ?? [];
          for (const tags of list2) dest.push([...new Set([...tags.filter((t) => t !== SELF), ...marks])].sort());
          byLemma.set(l2, dest);
        }
        n++;
      }
    }
    console.log(`  ${n} formas enlazadas a través de otra forma`);
  }

  /** Lemas con esa clave, prefiriendo la grafía exacta y, si no, la que sólo cambia en mayúsculas */
  static pick(targets: string[] | undefined, word: string): string[] {
    if (!targets) return [];
    const exact = targets.filter((l) => l === word);
    return exact.length ? exact : targets.filter((l) => l.toLowerCase() === word.toLowerCase());
  }

  /**
   * Reparte la frecuencia de cada forma entre sus lemas. Con `selfWins`, si la forma es la
   * forma de diccionario de uno de ellos se la queda entera («casa» cuenta para casa, no para casar).
   */
  scoreLemmas(freq: Map<string, number>, selfWins = false) {
    for (const [k, byLemma] of this.analyses) {
      const f = freq.get(k);
      if (!f) continue;
      const self = selfWins ? [...byLemma.keys()].filter((l) => l === k) : [];
      const owners = self.length ? self : [...byLemma.keys()];
      const share = f / owners.length;
      for (const l of owners) {
        const info = this.lemmas.get(l);
        if (info) info.score += share;
      }
    }
  }

  build(minScore: number, version: string): DictJson {
    const labelIds = new Map<string, number>();
    const labels: Partial<Record<Lang, string[]>> = Object.fromEntries(this.uis.map((u) => [u, []]));
    // Una etiqueta es la tupla de sus traducciones: dos análisis que se describen igual comparten id
    const labelId = (texts: string[]) => {
      const key = texts.join('\u0001');
      let id = labelIds.get(key);
      if (id === undefined) {
        id = labelIds.size;
        labelIds.set(key, id);
        this.uis.forEach((u, i) => labels[u]!.push(texts[i]));
      }
      return id;
    };
    labelId(this.uis.map((u) => baseLabel('lemma', u))); // id 0 reservado al propio lema

    const keepLemma = (l: string) => {
      const info = this.lemmas.get(l);
      // Los lemas sin entrada propia (sólo destino de form-of) se conservan; los raros se podan,
      // salvo si tienen traducción a un idioma distinto del inglés (escasa y valiosa)
      return !info || info.score >= minScore || this.glosses.some((g) => g !== 'en' && info.gloss[g]?.length);
    };

    const forms: DictJson['forms'] = {};
    const usedLemmas = new Set<string>();
    for (const [k, byLemma] of this.analyses) {
      const cands = [...byLemma.entries()]
        .filter(([l, list]) => keepLemma(l) || list.some((t) => t[0] === SELF))
        .sort((a, b) => (this.lemmas.get(b[0])?.score ?? 0) - (this.lemmas.get(a[0])?.score ?? 0));
      const row: FormRow[] = [];
      for (const [l, list] of cands) {
        const real = list.filter((t) => t[0] !== SELF);
        if (!real.length) { row.push([l, 0]); usedLemmas.add(l); continue; }
        const ids = new Set<number>();
        for (const tags of reduceAnalyses(mergeCases(real))) {
          const texts = this.uis.map((u) => this.describe(tags, u));
          if (texts.every((t) => t)) ids.add(labelId(texts));
        }
        if (!ids.size) ids.add(formKey(l) === k ? 0 : labelId(this.uis.map((u) => baseLabel('inflected', u))));
        row.push([l, ...ids]);
        usedLemmas.add(l);
      }
      if (row.length) forms[k] = row;
    }

    const outLemmas: DictJson['lemmas'] = {};
    for (const [l, info] of this.lemmas) {
      if (!usedLemmas.has(l)) continue;
      const rec: LemmaRecord = {};
      if (info.pos.size) rec.p = labelId(this.uis.map((u) => describePos([...info.pos], [...info.gender], u)));
      for (const g of this.glosses) if (info.gloss[g]?.length) rec[g] = info.gloss[g];
      outLemmas[l] = rec;
    }

    const noAccent: DictJson['noAccent'] = {};
    for (const k of Object.keys(forms)) {
      const na = noAccentKey(k);
      if (na === k) continue;
      (noAccent[na] ??= []).push(k);
    }

    return { format: DICT_FORMAT, lang: this.lang, glosses: this.glosses, version, labels, lemmas: outLemmas, forms, noAccent };
  }

  /** Construye podando lemas raros hasta caber en maxBytes; escribe dict.json.gz y manifest.json */
  write(version: string, maxBytes: number, sources: Source[]) {
    let minScore = 0;
    let json: string, gz: Buffer, dict: DictJson;
    for (;;) {
      dict = this.build(minScore, version);
      json = JSON.stringify(dict);
      gz = gzipSync(json, { level: 9 });
      console.log(`  minScore=${minScore}: ${Object.keys(dict.forms).length} formas, ${Object.keys(dict.lemmas).length} lemas, ${(gz.length / 1048576).toFixed(1)} MB gz`);
      if (gz.length <= maxBytes) break;
      minScore = minScore ? minScore * 4 : 1;
    }
    const outDir = join(ROOT, 'public', 'dict', this.lang);
    mkdirSync(outDir, { recursive: true });
    writeFileSync(join(outDir, 'dict.json.gz'), gz);
    const lemmas = Object.values(dict.lemmas);
    const manifest = {
      version,
      format: DICT_FORMAT,
      lang: this.lang,
      builtFrom: sources.map(({ id, name, version, license, homepage }) => ({ id, name, version, license, homepage })),
      bytes: gz.length,
      rawBytes: Buffer.byteLength(json),
      sha256: createHash('sha256').update(gz).digest('hex'),
      counts: {
        lemmas: lemmas.length,
        forms: Object.keys(dict.forms).length,
        noAccent: Object.keys(dict.noAccent).length,
        labels: dict.labels[this.uis[0]]!.length,
        ...Object.fromEntries(this.glosses.map((g) => [`with_${g}`, lemmas.filter((l) => l[g]).length])),
      },
    };
    writeFileSync(join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
    return manifest;
  }
}
