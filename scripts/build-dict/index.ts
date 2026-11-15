// DIC-1 — Genera public/dict/dict.json.gz a partir de Wiktextract + FreeDict.
// Uso: npm run build:dict [-- --accept-new]
import { createHash } from 'node:crypto';
import { createReadStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import { gzipSync } from 'node:zlib';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { formKey, noAccentKey, isGreek } from '../../src/lib/normalize.ts';
import { describeTags, significantTags, POS_ES, CASE_TAGS } from './tags.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const CACHE = join(ROOT, '.cache');
const OUT_DIR = join(ROOT, 'public', 'dict');
const SOURCES_PATH = join(ROOT, 'scripts', 'build-dict', 'sources.json');
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_SENSES = 6;
const MAX_GLOSS = 140;
const ACCEPT_NEW = process.argv.includes('--accept-new');

interface Source {
  id: string; name: string; license: string; homepage: string; url: string; file: string;
  extract?: string; version: string; algo: string; checksum: string;
}

// ---------------------------------------------------------------- 1. fuentes
async function download(url: string, dest: string) {
  console.log(`  ↓ ${url}`);
  const res = await fetch(url);
  if (!res.ok || !res.body) throw new Error(`Descarga fallida ${res.status} ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  writeFileSync(dest, buf);
}

function hashFile(path: string, algo: string): Promise<string> {
  return new Promise((ok, fail) => {
    const h = createHash(algo);
    createReadStream(path).on('data', (d) => h.update(d)).on('end', () => ok(h.digest('hex'))).on('error', fail);
  });
}

async function ensureSources(): Promise<Record<string, string>> {
  mkdirSync(CACHE, { recursive: true });
  const cfg = JSON.parse(readFileSync(SOURCES_PATH, 'utf8')) as { sources: Source[] };
  const paths: Record<string, string> = {};
  let changed = false;
  for (const s of cfg.sources) {
    const p = join(CACHE, s.file);
    if (!existsSync(p)) await download(s.url, p);
    const sum = await hashFile(p, s.algo);
    if (sum !== s.checksum) {
      if (!ACCEPT_NEW) {
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

// ---------------------------------------------------------------- tipos internos
interface LemmaInfo {
  pos: Set<string>;
  gender: Set<string>;
  en: string[];
  es: string[];
  score: number;
}

/** forma (clave) → lema → lista de análisis (etiquetas inglesas significativas) */
const analyses = new Map<string, Map<string, string[][]>>();
const lemmas = new Map<string, LemmaInfo>();
const SELF = '__lemma__';

function addAnalysis(form: string, lemma: string, tags: string[]) {
  const k = formKey(form);
  if (!k || !isGreek(k)) return;
  let byLemma = analyses.get(k);
  if (!byLemma) analyses.set(k, (byLemma = new Map()));
  let list = byLemma.get(lemma);
  if (!list) byLemma.set(lemma, (list = []));
  list.push(tags);
}

function lemmaInfo(word: string): LemmaInfo {
  let l = lemmas.get(word);
  if (!l) lemmas.set(word, (l = { pos: new Set(), gender: new Set(), en: [], es: [], score: 0 }));
  return l;
}

function pushUnique(arr: string[], v: string, max = MAX_SENSES) {
  v = v.trim().replace(/\s+/g, ' ');
  if (!v) return;
  if (v.length > MAX_GLOSS) v = v.slice(0, MAX_GLOSS - 1).trimEnd() + '…';
  if (arr.length < max && !arr.includes(v)) arr.push(v);
}

// Declinación de participios en -μένος (no vienen en las tablas de Wiktextract)
const MENOS_ENDINGS: [string, string[]][] = [
  ['ος', ['masculine', 'singular', 'nominative']],
  ['ου', ['masculine', 'neuter', 'singular', 'genitive']],
  ['ο', ['masculine', 'singular', 'accusative']],
  ['ο', ['neuter', 'singular', 'nominative', 'accusative', 'vocative']],
  ['ε', ['masculine', 'singular', 'vocative']],
  ['οι', ['masculine', 'plural', 'nominative', 'vocative']],
  ['ων', ['plural', 'genitive']],
  ['ους', ['masculine', 'plural', 'accusative']],
  ['η', ['feminine', 'singular', 'nominative', 'accusative', 'vocative']],
  ['ης', ['feminine', 'singular', 'genitive']],
  ['ες', ['feminine', 'plural', 'nominative', 'accusative', 'vocative']],
  ['α', ['neuter', 'plural', 'nominative', 'accusative', 'vocative']],
];

function expandParticiple(form: string, lemma: string, baseTags: string[]) {
  if (!form.endsWith('μένος')) return;
  const stem = form.slice(0, -2);
  for (const [end, tags] of MENOS_ENDINGS) {
    addAnalysis(stem + end, lemma, significantTags([...baseTags.filter((t) => !CASE_TAGS.has(t)), ...tags]));
  }
}

const pronLemmaKeys = new Set<string>();
const pronTableForms = new Map<string, Set<string>>();
const SKIP_FORM_TAGS = new Set(['romanization', 'table-tags', 'inflection-template']);
const GENDER_TAGS = ['masculine', 'feminine', 'neuter'];

// ---------------------------------------------------------------- 2. Wiktextract
async function readWiktextract(path: string) {
  const rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  let n = 0;
  for await (const line of rl) {
    if (!line) continue;
    const o = JSON.parse(line);
    n++;
    const word: string = o.word;
    if (!word) continue;
    // Letras-numeral (Σ΄ = 200) chocan con las elisiones (σ’); no interesan para leer
    if (/[΄ʹ͵]/.test(word) && ['num', 'character', 'symbol'].includes(o.pos)) continue;
    const senses: any[] = o.senses ?? [];
    const lemmaSenses = senses.filter((s) => !s.form_of && !s.alt_of && s.glosses?.length);
    const formSenses = senses.filter((s) => s.form_of || s.alt_of);

    if (lemmaSenses.length && !word.includes(' ')) {
      const info = lemmaInfo(word);
      if (POS_ES[o.pos]) info.pos.add(POS_ES[o.pos]);
      for (const s of lemmaSenses) {
        for (const g of GENDER_TAGS) if (s.tags?.includes(g) && (o.pos === 'noun' || o.pos === 'name')) info.gender.add(g);
        const gl: string[] = s.glosses;
        pushUnique(info.en, gl[gl.length - 1]);
      }
      addAnalysis(word, word, [SELF]);
      if (o.pos === 'pron') pronLemmaKeys.add(formKey(word));
      for (const f of o.forms ?? []) {
        const tags: string[] = f.tags ?? [];
        if (!f.form || tags.some((t) => SKIP_FORM_TAGS.has(t))) continue;
        if (f.form.includes(' ') || f.form === '-' || f.form === '—') continue;
        const sig = significantTags(tags);
        addAnalysis(f.form, word, sig);
        if (o.pos === 'pron') {
          let set = pronTableForms.get(word);
          if (!set) pronTableForms.set(word, (set = new Set()));
          set.add(formKey(f.form));
        }
        if (tags.includes('participle')) expandParticiple(f.form, word, sig);
      }
    }

    if (!word.includes(' ')) {
      for (const s of formSenses) {
        const targets: any[] = s.form_of ?? s.alt_of ?? [];
        const extra = s.alt_of && !s.form_of ? ['alternative'] : [];
        for (const t of targets) {
          const target: string = t.word;
          if (!target || target.includes(' ') || target === word) continue;
          addAnalysis(word, target, significantTags([...(s.tags ?? []), ...extra]));
        }
      }
    }
  }
  // Algunas tablas de pronombres de Wiktionary listan todo el sistema de pronombres átonos
  // (p. ej. «τα» incluye το, της, μας). Si la forma es a su vez un pronombre con entrada
  // propia, la tabla ajena no se usa.
  let dropped = 0;
  for (const [lemma, keys] of pronTableForms) {
    for (const k of keys) {
      if (k !== formKey(lemma) && pronLemmaKeys.has(k) && analyses.get(k)?.delete(lemma)) dropped++;
    }
  }
  console.log(`  Wiktextract: ${dropped} formas de tablas de pronombres ajenas descartadas`);
  console.log(`  Wiktextract: ${n} entradas, ${lemmas.size} lemas, ${analyses.size} formas`);
}

// ---------------------------------------------------------------- 3. FreeDict (TEI)
interface FdEntry { orth: string; pos?: string; trans: string[] }

function decodeXml(s: string) {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, '&');
}

function readFreeDict(path: string): FdEntry[] {
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

const FD_POS: Record<string, string> = {
  n: 'sustantivo', noun: 'sustantivo', v: 'verbo', verb: 'verbo', adj: 'adjetivo', adv: 'adverbio',
  pron: 'pronombre', prep: 'preposición', conj: 'conjunción', int: 'interjección', intj: 'interjección',
  num: 'numeral', art: 'artículo', pn: 'nombre propio', propn: 'nombre propio', phraseologicalUnit: 'locución',
  suffix: 'sufijo', prefix: 'prefijo', ptcl: 'partícula',
};

function attachFreeDict(entries: FdEntry[], lang: 'es' | 'en') {
  const byKey = new Map<string, string[]>();
  for (const l of lemmas.keys()) {
    const k = formKey(l);
    const arr = byKey.get(k);
    if (arr) arr.push(l); else byKey.set(k, [l]);
  }
  let matched = 0, created = 0;
  for (const e of entries) {
    if (e.orth.includes(' ')) continue;
    const k = formKey(e.orth);
    if (!k || !isGreek(k)) continue;
    let targets = byKey.get(k);
    if (!targets) {
      // Lema que no está en Wiktextract: lo creamos
      const info = lemmaInfo(e.orth);
      const p = e.pos && FD_POS[e.pos];
      if (p) info.pos.add(p);
      addAnalysis(e.orth, e.orth, [SELF]);
      targets = [e.orth];
      byKey.set(k, targets);
      created++;
    } else matched++;
    for (const t of targets) {
      const info = lemmas.get(t)!;
      const arr = lang === 'es' ? info.es : info.en;
      // En inglés, Wiktextract es mejor; FreeDict sólo rellena lemas vacíos
      if (lang === 'en' && arr.length) continue;
      for (const tr of e.trans) pushUnique(arr, tr);
    }
  }
  console.log(`  FreeDict ${lang}: ${entries.length} entradas, ${matched} enlazadas, ${created} lemas nuevos`);
}

// ---------------------------------------------------------------- 4. frecuencias
function readFrequencies(path: string) {
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

function scoreLemmas(freq: Map<string, number>) {
  for (const [k, byLemma] of analyses) {
    const f = freq.get(k);
    if (!f) continue;
    const share = f / byLemma.size;
    for (const l of byLemma.keys()) {
      const info = lemmas.get(l);
      if (info) info.score += share;
    }
  }
}

// ---------------------------------------------------------------- 5. salida
interface DictJson {
  version: string;
  tags: string[];
  lemmas: Record<string, { pos?: string; es?: string[]; en?: string[] }>;
  forms: Record<string, (string | number)[][]>;
  noAccent: Record<string, string[]>;
}

const GENDER_ES: Record<string, string> = { masculine: 'masc.', feminine: 'fem.', neuter: 'neutro' };

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

// Etiquetas de registro/variante: no cambian el análisis gramatical
const REGISTER = new Set(['informal', 'colloquial', 'rare', 'uncommon', 'archaic', 'dated', 'formal', 'literary',
  'dialectal', 'regional', 'vernacular', 'obsolete', 'Katharevousa', 'Demotic', 'polytonic', 'Cyprus', 'nonstandard',
  'abbreviation', 'contraction', 'weak', 'possessive', 'short-form', 'indeclinable']);

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

function build(minScore: number, version: string): DictJson {
  const tagIds = new Map<string, number>();
  const tags: string[] = [];
  const tagId = (s: string) => {
    let id = tagIds.get(s);
    if (id === undefined) { id = tags.length; tags.push(s); tagIds.set(s, id); }
    return id;
  };
  tagId('forma de diccionario'); // id 0 reservado al propio lema

  const keepLemma = (l: string) => {
    const info = lemmas.get(l);
    // Los lemas sin entrada propia (sólo destino de form-of) se conservan; los raros se podan
    return !info || info.score >= minScore || info.es.length > 0;
  };

  const forms: DictJson['forms'] = {};
  const usedLemmas = new Set<string>();
  for (const [k, byLemma] of analyses) {
    const cands = [...byLemma.entries()]
      .filter(([l, list]) => keepLemma(l) || list.some((t) => t[0] === SELF))
      .sort((a, b) => (lemmas.get(b[0])?.score ?? 0) - (lemmas.get(a[0])?.score ?? 0));
    const row: (string | number)[][] = [];
    for (const [l, list] of cands) {
      let real = list.filter((t) => t[0] !== SELF);
      if (!real.length) { row.push([l, 0]); usedLemmas.add(l); continue; }
      const descr = new Set(reduceAnalyses(mergeCases(real)).map((t) => describeTags(t)).filter(Boolean));
      if (!descr.size) descr.add(formKey(l) === k ? 'forma de diccionario' : 'forma flexionada');
      row.push([l, ...[...descr].map(tagId)]);
      usedLemmas.add(l);
    }
    if (row.length) forms[k] = row;
  }

  const outLemmas: DictJson['lemmas'] = {};
  for (const [l, info] of lemmas) {
    if (!usedLemmas.has(l)) continue;
    const rec: { pos?: string; es?: string[]; en?: string[] } = {};
    if (info.pos.size) {
      let p = [...info.pos].join(' / ');
      if (info.gender.size) p += ' ' + [...info.gender].map((g) => GENDER_ES[g]).join('/');
      rec.pos = p;
    }
    if (info.es.length) rec.es = info.es;
    if (info.en.length) rec.en = info.en;
    outLemmas[l] = rec;
  }

  const noAccent: DictJson['noAccent'] = {};
  for (const k of Object.keys(forms)) {
    const na = noAccentKey(k);
    if (na === k) continue;
    (noAccent[na] ??= []).push(k);
  }

  return { version, tags, lemmas: outLemmas, forms, noAccent };
}

// ---------------------------------------------------------------- main
async function main() {
  const t0 = Date.now();
  console.log('1. Fuentes');
  const paths = await ensureSources();
  console.log('2. Wiktextract');
  await readWiktextract(paths['wiktextract-el']);
  console.log('3. FreeDict');
  attachFreeDict(readFreeDict(paths['freedict-ell-spa']), 'es');
  attachFreeDict(readFreeDict(paths['freedict-ell-eng']), 'en');
  console.log('4. Frecuencias');
  scoreLemmas(readFrequencies(paths['freq-el']));

  const cfg = JSON.parse(readFileSync(SOURCES_PATH, 'utf8')) as { sources: Source[] };
  // La versión depende sólo de las fuentes, para que el build sea reproducible
  const version = cfg.sources.find((s) => s.id === 'wiktextract-el')!.version.replaceAll('-', '.');

  console.log('5. Salida');
  let minScore = 0;
  let json: string, gz: Buffer, dict: DictJson;
  for (;;) {
    dict = build(minScore, version);
    json = JSON.stringify(dict);
    gz = gzipSync(json, { level: 9 });
    console.log(`  minScore=${minScore}: ${Object.keys(dict.forms).length} formas, ${Object.keys(dict.lemmas).length} lemas, ${(gz.length / 1048576).toFixed(1)} MB gz`);
    if (gz.length <= MAX_BYTES) break;
    minScore = minScore ? minScore * 4 : 1;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(join(OUT_DIR, 'dict.json.gz'), gz);
  const manifest = {
    version,
    builtFrom: cfg.sources.map(({ id, name, version, license, homepage }) => ({ id, name, version, license, homepage })),
    bytes: gz.length,
    rawBytes: Buffer.byteLength(json),
    sha256: createHash('sha256').update(gz).digest('hex'),
    counts: {
      lemmas: Object.keys(dict.lemmas).length,
      forms: Object.keys(dict.forms).length,
      noAccent: Object.keys(dict.noAccent).length,
      tags: dict.tags.length,
      withSpanish: Object.values(dict.lemmas).filter((l) => l.es).length,
    },
  };
  writeFileSync(join(OUT_DIR, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  console.log(`Hecho en ${((Date.now() - t0) / 1000).toFixed(0)} s →`, manifest.counts, `${(statSync(join(OUT_DIR, 'dict.json.gz')).size / 1048576).toFixed(1)} MB`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
