// DIC-2 / DIC-3 — Búsqueda forma → lema(s) + análisis + acepciones.
import { formKey, noAccentKey } from './normalize.ts';

export interface LemmaRecord {
  pos?: string;
  es?: string[];
  en?: string[];
}

/** Fila del índice `forms`: [lema, idEtiqueta, idEtiqueta...] */
export type FormRow = [string, ...number[]];

/** Formato de public/dict/dict.json.gz (ver docs/PRD.md, «El diccionario»). */
export interface DictJson {
  version: string;
  tags: string[];
  lemmas: Record<string, LemmaRecord>;
  forms: Record<string, FormRow[]>;
  noAccent: Record<string, string[]>;
}

/** Acceso al diccionario; síncrono en tests y en build, asíncrono (IndexedDB) en la app. */
export interface DictSource {
  form(key: string): Promise<FormRow[] | undefined> | FormRow[] | undefined;
  noAccent(key: string): Promise<string[] | undefined> | string[] | undefined;
  lemma(lemma: string): Promise<LemmaRecord | undefined> | LemmaRecord | undefined;
  tag(id: number): string;
}

export interface Candidate {
  lemma: string;
  analyses: string[];
  pos?: string;
  es: string[];
  en: string[];
  /** traducción propia del usuario (DIC-5), si la hay */
  user?: string;
  /** cómo se encontró: forma exacta, sin acentos o elisión */
  via: 'exact' | 'noAccent' | 'elision' | 'variant' | 'lemma';
}

export interface LookupResult {
  key: string;
  candidates: Candidate[];
}

export function sourceFromJson(d: DictJson): DictSource {
  return {
    form: (k) => d.forms[k],
    noAccent: (k) => d.noAccent[k],
    lemma: (l) => d.lemmas[l],
    tag: (id) => d.tags[id] ?? '',
  };
}

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

async function rowsFor(key: string, src: DictSource): Promise<{ rows: FormRow[]; via: Candidate['via'] }> {
  const exact = await src.form(key);
  if (exact?.length) return { rows: exact, via: 'exact' };

  const na = noAccentKey(key);
  const alt = (await src.noAccent(na)) ?? [];
  const rows: FormRow[] = [];
  // la propia clave sin acentos también puede ser una forma
  for (const k of [na, ...alt]) {
    const r = await src.form(k);
    if (r) rows.push(...r);
  }
  if (rows.length) return { rows, via: 'noAccent' };

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

/** Busca un token del texto. Devuelve los lemas posibles ordenados por probabilidad. */
export async function lookup(token: string, src: DictSource, userDict?: (lemma: string) => string | undefined): Promise<LookupResult> {
  const key = formKey(token);
  const { rows, via } = await rowsFor(key, src);

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

  const candidates: Candidate[] = [];
  for (const [lemma, tags] of merged) {
    const rec = (await src.lemma(lemma)) ?? {};
    candidates.push({
      lemma,
      analyses: [...tags].map((t) => src.tag(t)).filter(Boolean),
      pos: rec.pos,
      es: rec.es ?? [],
      en: rec.en ?? [],
      user: userDict?.(lemma),
      via: merged.size && rows.length ? via : 'lemma',
    });
  }
  return { key, candidates };
}

/** Prioridad de traducciones (DIC-3, DIC-5): personal → español → inglés (marcado EN). */
export function bestTranslation(c: Pick<Candidate, 'user' | 'es' | 'en'>): { text: string; lang: 'user' | 'es' | 'en' } | undefined {
  if (c.user) return { text: c.user, lang: 'user' };
  if (c.es.length) return { text: c.es[0], lang: 'es' };
  if (c.en.length) return { text: c.en[0], lang: 'en' };
  return undefined;
}
