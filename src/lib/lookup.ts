// DIC-2 / DIC-3 / DIC-7 / DIC-8 — Búsqueda forma → lema(s) + análisis + acepciones.
import { formKey, noAccentKey } from './normalize.ts';
import type { Lang, TargetLang } from './langs.ts';

/** Entrada de un lema: categoría (id de etiqueta) y acepciones por idioma. */
export interface LemmaRecord {
  p?: number;
  es?: string[];
  en?: string[];
  el?: string[];
}

/** Fila del índice `forms`: [lema, idEtiqueta, idEtiqueta...] */
export type FormRow = [string, ...number[]];

export const DICT_FORMAT = 2;

/** Formato de public/dict/<lang>/dict.json.gz (ver docs/PRD.md, «El diccionario»). */
export interface DictJson {
  format: number;
  /** idioma de las entradas */
  lang: TargetLang;
  /** idiomas de las acepciones */
  glosses: Lang[];
  version: string;
  /** etiquetas (análisis y categorías) traducidas a cada idioma de interfaz; id 0 = forma de diccionario */
  labels: Partial<Record<Lang, string[]>>;
  lemmas: Record<string, LemmaRecord>;
  forms: Record<string, FormRow[]>;
  noAccent: Record<string, string[]>;
}

/** Acceso al diccionario; síncrono en tests y en build, asíncrono (IndexedDB) en la app. */
export interface DictSource {
  lang: TargetLang;
  form(key: string): Promise<FormRow[] | undefined> | FormRow[] | undefined;
  noAccent(key: string): Promise<string[] | undefined> | string[] | undefined;
  lemma(lemma: string): Promise<LemmaRecord | undefined> | LemmaRecord | undefined;
  /** etiqueta en el idioma de la interfaz */
  tag(id: number): string;
}

export type Gloss = Partial<Record<Lang, string[]>>;

export interface Candidate {
  lemma: string;
  analyses: string[];
  pos?: string;
  /** acepciones por idioma */
  gloss: Gloss;
  /** traducción propia del usuario (DIC-5), si la hay */
  user?: string;
  /** cómo se encontró */
  via: 'exact' | 'noAccent' | 'elision' | 'variant' | 'clitic' | 'lemma';
  /** pronombres enclíticos separados (DIC-7: «dámelo» → me, lo) */
  clitics?: string[];
}

export interface LookupResult {
  key: string;
  candidates: Candidate[];
}

/** Idioma de interfaz con etiquetas en el diccionario: el pedido o, si no está, el primero. */
export function labelsFor(d: Pick<DictJson, 'labels'>, ui: Lang): string[] {
  return d.labels[ui] ?? Object.values(d.labels)[0] ?? [];
}

export function sourceFromJson(d: DictJson, ui: Lang = d.lang === 'el' ? 'es' : 'el'): DictSource {
  const labels = labelsFor(d, ui);
  return {
    lang: d.lang,
    form: (k) => d.forms[k],
    noAccent: (k) => d.noAccent[k],
    lemma: (l) => d.lemmas[l],
    tag: (id) => labels[id] ?? '',
  };
}

// ---------------------------------------------------------------- griego
// Elisiones frecuentes cuando el diccionario no trae la forma con apóstrofo
const ELISIONS: Record<string, string[]> = {
  'σ’': ['σε'], 'μ’': ['με'], 'τ’': ['το', 'τα'], 'θ’': ['θα'], 'ν’': ['να'],
  'απ’': ['από'], 'γι’': ['για'], 'κι’': ['και'], 'π’': ['που'], 'ο’': ['ο'],
};

/**
 * Variantes ortográficas de textos anteriores a la reforma (y del habla) para cuando
 * la forma no está: subjuntivo en -η (να πη → πει), -ήτε (βρήτε → βρείτε), aumento
 * silábico (εφόρτωσαν → φόρτωσαν), aféresis (κείνο → εκείνο), -εί por -άει (μιλεί).
 */
export function orthographicVariants(key: string): string[] {
  const out: string[] = [];
  const rules: [RegExp, string][] = [
    [/η$/, 'ει'],
    [/ήσ$/, 'είσ'],
    [/ή$/, 'εί'],
    [/ήτε$/, 'είτε'],
    [/ητε$/, 'ειτε'],
    [/ηθή$/, 'ηθεί'],
    [/εί$/, 'άει'],
    [/ούν$/, 'άνε'],
  ];
  for (const [re, rep] of rules) if (re.test(key)) out.push(key.replace(re, rep));
  if (/^ε[^αειουηω]/.test(key) && key.length > 4) out.push(key.slice(1)); // aumento
  if (/^ή/.test(key) && key.length > 4) out.push('ε' + key.slice(1)); // ήφερα → έφερα
  if (/^[κτπδ]/.test(key)) out.push('ε' + key); // κείνο → εκείνο
  // repeticiones expresivas: γανώωω → γανώ, ακόοο → ακό
  const chars = [...key];
  const base = (c: string) => c.normalize('NFD')[0];
  while (chars.length > 2 && base(chars[chars.length - 1]) === base(chars[chars.length - 2])) chars.pop();
  const squeezed = chars.join('');
  if (squeezed !== key) out.push(squeezed);
  return [...new Set(out)].filter((v) => v !== key);
}

// ---------------------------------------------------------------- español
const CLITICS = ['nos', 'os', 'me', 'te', 'se', 'lo', 'la', 'le', 'los', 'las', 'les'];
const CLITIC_RE = new RegExp(`(${CLITICS.join('|')})$`);

/**
 * DIC-7: separa hasta dos pronombres enclíticos de verbos españoles.
 * «dámelo» → dáme + lo → dá + me → (sin tilde) da; «vámonos» → vamos; «sentaos» → sentad.
 * Devuelve las bases candidatas (sin y con tilde) con los pronombres separados.
 */
export function encliticSplits(key: string): { base: string; clitics: string[] }[] {
  const out: { base: string; clitics: string[] }[] = [];
  const walk = (stem: string, clitics: string[]) => {
    if (clitics.length >= 2) return;
    const m = stem.match(CLITIC_RE);
    if (!m) return;
    const base = stem.slice(0, -m[1].length);
    if (base.length < 2 || !/[aeiouáéíóúr]$/.test(base)) return; // sólo tras vocal o -r (infinitivo)
    const cl = [m[1], ...clitics];
    const bases = [base];
    if (m[1] === 'nos' && /[aeiouáéíóú]$/.test(base)) bases.push(base + 's'); // vámonos → vamos
    if (m[1] === 'os' && /[aei]$/.test(base)) bases.push(base + 'd'); // sentaos → sentad
    for (const b of bases) out.push({ base: b, clitics: cl });
    walk(base, cl);
  };
  walk(key, []);
  return out;
}

// ---------------------------------------------------------------- búsqueda
interface Rows { rows: FormRow[]; via: Candidate['via']; clitics?: string[] }

async function exactOrNoAccent(key: string, src: DictSource): Promise<Rows | null> {
  const exact = await src.form(key);
  if (exact?.length) return { rows: exact, via: 'exact' };
  const na = noAccentKey(key);
  const alt = (await src.noAccent(na)) ?? [];
  const rows: FormRow[] = [];
  // la propia clave sin acentos también puede ser una forma
  for (const k of [...new Set([na, ...alt])]) {
    if (k === key) continue;
    const r = await src.form(k);
    if (r) rows.push(...r);
  }
  return rows.length ? { rows, via: 'noAccent' } : null;
}

async function rowsFor(key: string, src: DictSource): Promise<Rows> {
  const direct = await exactOrNoAccent(key, src);
  if (direct) return direct;

  if (src.lang === 'es') {
    for (const { base, clitics } of encliticSplits(key)) {
      const r = await exactOrNoAccent(base, src);
      // sólo cuentan las bases que son formas de un verbo (lema en -ar/-er/-ir, o -se)
      const verbs = r?.rows.filter(([l]) => /(?:ar|er|ir|ír)(?:se)?$/.test(l));
      if (verbs?.length) return { rows: verbs, via: 'clitic', clitics };
    }
    return { rows: [], via: 'exact' };
  }

  const rows: FormRow[] = [];
  if (key.endsWith('’')) {
    const opts = ELISIONS[key] ?? [key.slice(0, -1), key.slice(0, -1) + 'ο', key.slice(0, -1) + 'α', key.slice(0, -1) + 'ε'];
    for (const o of opts) {
      const r = await src.form(o);
      if (r) rows.push(...r);
    }
    if (rows.length) return { rows, via: 'elision' };
  }

  for (const v of orthographicVariants(key)) {
    const r = (await src.form(v)) ?? [];
    if (!r.length) {
      for (const k of (await src.noAccent(noAccentKey(v))) ?? []) r.push(...((await src.form(k)) ?? []));
    }
    if (r.length) return { rows: r, via: 'variant' };
  }
  return { rows: [], via: 'exact' };
}

function glossOf(rec: LemmaRecord): Gloss {
  const g: Gloss = {};
  for (const l of ['es', 'en', 'el'] as Lang[]) if (rec[l]?.length) g[l] = rec[l];
  return g;
}

/** Busca un token del texto. Devuelve los lemas posibles ordenados por probabilidad. */
export async function lookup(token: string, src: DictSource): Promise<LookupResult> {
  const key = formKey(token);
  const { rows, via, clitics } = await rowsFor(key, src);

  // Fusionar filas del mismo lema (pueden venir de varias claves sin acentos)
  const merged = new Map<string, Set<number>>();
  for (const [lemma, ...tags] of rows) {
    let s = merged.get(lemma);
    if (!s) merged.set(lemma, (s = new Set()));
    for (const t of tags) s.add(t);
  }

  // Lema directo, si no hay forma (p. ej. lemas creados sólo por el usuario)
  if (!merged.size) {
    const direct = await src.lemma(token.normalize('NFC'));
    if (direct) merged.set(token.normalize('NFC'), new Set([0]));
  }

  // Una palabra en minúscula no es un nombre propio: fuera «Casas» para «casas» si hay lemas comunes
  const lower = (s: string) => s === s.toLowerCase();
  if (lower(token) && [...merged.keys()].some(lower)) for (const l of [...merged.keys()]) if (!lower(l)) merged.delete(l);

  const candidates: Candidate[] = [];
  for (const [lemma, tags] of merged) {
    const rec = (await src.lemma(lemma)) ?? {};
    candidates.push({
      lemma,
      analyses: [...tags].filter((t) => !(clitics && t === 0)).map((t) => src.tag(t)).filter(Boolean),
      pos: rec.p !== undefined ? src.tag(rec.p) || undefined : undefined,
      gloss: glossOf(rec),
      via: merged.size && rows.length ? via : 'lemma',
      ...(clitics ? { clitics } : {}),
    });
  }
  return { key, candidates };
}

/** DIC-3 / DIC-5 / DIC-8: personal → idiomas en el orden pedido (el primero, el del usuario). */
export function bestTranslation(c: Pick<Candidate, 'user' | 'gloss'>, order: Lang[]): { text: string; lang: Lang | 'user' } | undefined {
  if (c.user) return { text: c.user, lang: 'user' };
  for (const l of order) {
    const g = c.gloss[l];
    if (g?.length) return { text: g[0], lang: l };
  }
  return undefined;
}
