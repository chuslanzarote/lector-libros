// DIC-7 — Diccionario español: formas y glosas en inglés de Wiktextract (Wiktionary inglés) y
// traducciones al griego reunidas de tres fuentes pequeñas, con un pivote por el inglés de respaldo.
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { formKey, isGreek } from '../../src/lib/normalize.ts';
import { DictBuilder, readFreeDict, readFrequencies, pushUnique, SELF, type LemmaInfo } from './builder.ts';
import { describeSpanish, isKnownPos, significantTags } from './tags.ts';

const SKIP_FORM_TAGS = new Set(['romanization', 'table-tags', 'inflection-template', 'combined-form', 'canonical']);
const GENDER_TAGS = ['masculine', 'feminine'];
const MAX_EL = 5;

async function* jsonl(path: string): AsyncGenerator<any> {
  const rl = createInterface({ input: createReadStream(path, { encoding: 'utf8' }), crlfDelay: Infinity });
  for await (const line of rl) if (line) yield JSON.parse(line);
}

/** En español «informal» marca el tuteo, que no aporta al análisis */
const sig = (tags: string[]) => significantTags(tags.filter((t) => t !== 'informal'));

/** Formas con pronombres pegados (dámelo, hablándole): las resuelve la app (DIC-7), no se guardan */
const isCombined = (s: any) =>
  (s.tags ?? []).some((t: string) => t === 'combined-form' || t.startsWith('object-')) ||
  (s.glosses ?? []).some((g: string) => / combined with /.test(g));

async function readWiktextract(b: DictBuilder, path: string) {
  let n = 0, combined = 0;
  for await (const o of jsonl(path)) {
    n++;
    const word: string = o.word;
    // Los afijos (-ar, -año) no son palabras del texto
    if (!word || word.includes(' ') || word.startsWith('-') || word.endsWith('-')) continue;
    const senses: any[] = o.senses ?? [];
    const lemmaSenses = senses.filter((s) => !s.form_of && !s.alt_of && s.glosses?.length && !(s.tags ?? []).includes('form-of'));
    const formSenses = senses.filter((s) => s.form_of || s.alt_of);

    if (lemmaSenses.length) {
      const info = b.lemmaInfo(word);
      if (isKnownPos(o.pos)) info.pos.add(o.pos);
      for (const s of lemmaSenses) {
        if (o.pos === 'noun') for (const g of GENDER_TAGS) if (s.tags?.includes(g) && !s.tags?.includes('by-personal-gender')) info.gender.add(g);
        const gl: string[] = s.glosses;
        pushUnique(b.gloss(info, 'en'), gl[gl.length - 1]);
      }
      b.addAnalysis(word, word, [SELF]);
      for (const f of o.forms ?? []) {
        const tags: string[] = f.tags ?? [];
        if (!f.form || tags.some((t) => SKIP_FORM_TAGS.has(t))) { if (tags.includes('combined-form')) combined++; continue; }
        if (f.form.includes(' ') || f.form === '-' || f.form === '—') continue;
        b.addAnalysis(f.form, word, sig(tags));
      }
    }

    for (const s of formSenses) {
      if (isCombined(s)) { combined++; continue; }
      const targets: any[] = s.form_of ?? s.alt_of ?? [];
      const extra = s.alt_of && !s.form_of ? ['alternative'] : [];
      for (const t of targets) {
        const target: string = t.word;
        if (!target || target.includes(' ') || target === word) continue;
        b.addAnalysis(word, target, sig([...(s.tags ?? []), ...extra]));
      }
    }
  }
  console.log(`  Wiktextract: ${n} entradas, ${b.lemmas.size} lemas, ${b.analyses.size} formas (${combined} formas con enclíticos descartadas)`);
}

const stripNotes = (s: string) => s.replace(/\([^)]*\)|\[[^\]]*\]/g, '').replace(/\s+/g, ' ').trim().replace(/[.;,]+$/, '');

/** Wiktionary griego: definiciones en griego de lemas españoles («casa» → «το σπίτι») */
async function readGreekWiktionary(b: DictBuilder, path: string, byKey: Map<string, string[]>) {
  let added = 0;
  for await (const o of jsonl(path)) {
    if (o.pos === 'name' || !o.word || (o.tags ?? []).includes('form-of') || (o.tags ?? []).includes('participle')) continue;
    const targets = DictBuilder.pick(byKey.get(formKey(o.word)), o.word);
    if (!targets.length) continue;
    for (const s of o.senses ?? []) {
      if (s.form_of || s.alt_of) continue;
      for (const g of s.glosses ?? []) {
        // Las glosas con letras latinas remiten a otra palabra española («πληθυντικός του grande»)
        if (!g || /[A-Za-z]/.test(g) || !isGreek(g)) continue;
        for (const t of targets) pushUnique(b.gloss(b.lemmas.get(t)!, 'el'), stripNotes(g), MAX_EL);
        added++;
      }
    }
  }
  console.log(`  Wiktionary griego: ${added} acepciones en griego`);
}

/** Wiktionary español: tablas de traducción al griego */
async function readSpanishWiktionary(b: DictBuilder, path: string, byKey: Map<string, string[]>) {
  let added = 0;
  for await (const o of jsonl(path)) {
    if (!o.word) continue;
    const trs: any[] = [...(o.translations ?? []), ...(o.senses ?? []).flatMap((s: any) => s.translations ?? [])];
    const el = trs.filter((t) => t.lang_code === 'el' && t.word && isGreek(t.word));
    if (!el.length) continue;
    const targets = DictBuilder.pick(byKey.get(formKey(o.word)), o.word);
    if (!targets.length) continue;
    for (const t of el) for (const l of targets) pushUnique(b.gloss(b.lemmas.get(l)!, 'el'), stripNotes(t.word), MAX_EL);
    added += el.length;
  }
  console.log(`  Wiktionary español: ${added} traducciones al griego`);
}

/** FreeDict griego→español leído al revés: «σπίτι → casa» da «casa → σπίτι» */
function invertFreeDict(b: DictBuilder, path: string, byKey: Map<string, string[]>, greekFreq: Map<string, number>) {
  const bySpanish = new Map<string, Set<string>>();
  const spelling = new Map<string, string>();
  for (const e of readFreeDict(path)) {
    if (e.orth.includes(' ') || !isGreek(e.orth)) continue;
    for (const tr of e.trans) {
      for (const part of stripNotes(tr).split(/[,;]/)) {
        const w = part.trim();
        if (!w || w.includes(' ')) continue;
        const k = formKey(w);
        if (!spelling.has(k)) spelling.set(k, w);
        let set = bySpanish.get(k);
        if (!set) bySpanish.set(k, (set = new Set()));
        set.add(e.orth);
      }
    }
  }
  let linked = 0;
  for (const [k, greek] of bySpanish) {
    const targets = DictBuilder.pick(byKey.get(k), spelling.get(k)!);
    if (!targets.length) continue;
    const ranked = [...greek].sort((a, c) => (greekFreq.get(formKey(c)) ?? 0) - (greekFreq.get(formKey(a)) ?? 0)).slice(0, 4);
    for (const l of targets) for (const g of ranked) pushUnique(b.gloss(b.lemmas.get(l)!, 'el'), g, MAX_EL);
    linked++;
  }
  console.log(`  FreeDict invertido: ${linked} lemas españoles con griego`);
}

/** Primer significado de una glosa inglesa, normalizado para comparar («to write; to compose» → «to write») */
function firstMeaning(gloss: string | undefined): string | null {
  if (!gloss) return null;
  const m = stripNotes(gloss).split(/[,;:]/)[0].trim().toLowerCase().replace(/^(a|an|the) /, '');
  return m && m.split(' ').length <= 3 ? m : null;
}

/**
 * Respaldo: si un lema español no tiene griego, se busca un lema griego frecuente de la misma
 * categoría cuyo primer significado en inglés sea idéntico («dar: to give» ↔ «δίνω: to give»).
 */
async function pivotThroughEnglish(b: DictBuilder, greekPath: string, greekFreq: Map<string, number>) {
  const byMeaning = new Map<string, { word: string; freq: number }[]>();
  for await (const o of jsonl(greekPath)) {
    const word: string = o.word;
    if (!word || word.includes(' ') || !isKnownPos(o.pos) || o.pos === 'name') continue;
    const s = (o.senses ?? []).find((x: any) => !x.form_of && !x.alt_of && x.glosses?.length);
    const m = firstMeaning(s?.glosses?.at(-1));
    const freq = greekFreq.get(formKey(word)) ?? 0;
    if (!m || freq < 20) continue;
    const key = `${o.pos}|${m}`;
    const arr = byMeaning.get(key) ?? [];
    if (!arr.some((x) => x.word === word)) arr.push({ word, freq });
    byMeaning.set(key, arr);
  }
  let added = 0;
  for (const [, info] of b.lemmas) {
    if (info.gloss.el?.length) continue;
    const m = firstMeaning(info.gloss.en?.[0]);
    if (!m) continue;
    const found = [...info.pos].flatMap((p) => byMeaning.get(`${p}|${m}`) ?? []);
    if (!found.length) continue;
    for (const g of found.sort((a, c) => c.freq - a.freq).slice(0, 2)) pushUnique(b.gloss(info, 'el'), g.word, MAX_EL);
    added++;
  }
  console.log(`  Pivote por el inglés: ${added} lemas con griego`);
}

export async function buildSpanish(paths: Record<string, string>): Promise<DictBuilder> {
  const b = new DictBuilder('es', ['el', 'en'], ['el', 'en'], (tags, ui) => describeSpanish(tags, ui as 'el' | 'en'));
  console.log('2. Wiktextract (español)');
  await readWiktextract(b, paths['wiktextract-es']);
  b.resolveChains();
  const byKey = b.lemmaKeys();
  const greekFreq = readFrequencies(paths['freq-el']);
  console.log('3. Traducciones al griego');
  await readGreekWiktionary(b, paths['elwikt-es'], byKey);
  await readSpanishWiktionary(b, paths['eswikt-es'], byKey);
  invertFreeDict(b, paths['freedict-ell-spa'], byKey, greekFreq);
  await pivotThroughEnglish(b, paths['wiktextract-el'], greekFreq);
  const withEl = [...b.lemmas.values()].filter((l: LemmaInfo) => l.gloss.el?.length).length;
  console.log(`  ${withEl} lemas con griego en total`);
  console.log('4. Frecuencias');
  b.scoreLemmas(readFrequencies(paths['freq-es']), true);
  return b;
}
