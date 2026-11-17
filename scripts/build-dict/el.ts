// DIC-1 — Diccionario griego: Wiktextract (formas y glosas en inglés) + FreeDict griego→español/inglés.
import { createReadStream } from 'node:fs';
import { createInterface } from 'node:readline';
import { formKey, isGreek } from '../../src/lib/normalize.ts';
import { DictBuilder, readFreeDict, readFrequencies, pushUnique, SELF, type FdEntry } from './builder.ts';
import { CASE_TAGS, describeGreek, FD_POS, isKnownPos, significantTags } from './tags.ts';

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

const SKIP_FORM_TAGS = new Set(['romanization', 'table-tags', 'inflection-template']);
const GENDER_TAGS = ['masculine', 'feminine', 'neuter'];

async function readWiktextract(b: DictBuilder, path: string) {
  const pronLemmaKeys = new Set<string>();
  const pronTableForms = new Map<string, Set<string>>();
  const expandParticiple = (form: string, lemma: string, baseTags: string[]) => {
    if (!form.endsWith('μένος')) return;
    const stem = form.slice(0, -2);
    for (const [end, tags] of MENOS_ENDINGS) {
      b.addAnalysis(stem + end, lemma, significantTags([...baseTags.filter((t) => !CASE_TAGS.has(t)), ...tags]));
    }
  };

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
      const info = b.lemmaInfo(word);
      if (isKnownPos(o.pos)) info.pos.add(o.pos);
      for (const s of lemmaSenses) {
        for (const g of GENDER_TAGS) if (s.tags?.includes(g) && (o.pos === 'noun' || o.pos === 'name')) info.gender.add(g);
        const gl: string[] = s.glosses;
        pushUnique(b.gloss(info, 'en'), gl[gl.length - 1]);
      }
      b.addAnalysis(word, word, [SELF]);
      if (o.pos === 'pron') pronLemmaKeys.add(formKey(word));
      for (const f of o.forms ?? []) {
        const tags: string[] = f.tags ?? [];
        if (!f.form || tags.some((t) => SKIP_FORM_TAGS.has(t))) continue;
        if (f.form.includes(' ') || f.form === '-' || f.form === '—') continue;
        const sig = significantTags(tags);
        b.addAnalysis(f.form, word, sig);
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
          b.addAnalysis(word, target, significantTags([...(s.tags ?? []), ...extra]));
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
      if (k !== formKey(lemma) && pronLemmaKeys.has(k) && b.analyses.get(k)?.delete(lemma)) dropped++;
    }
  }
  console.log(`  Wiktextract: ${dropped} formas de tablas de pronombres ajenas descartadas`);
  console.log(`  Wiktextract: ${n} entradas, ${b.lemmas.size} lemas, ${b.analyses.size} formas`);
}

function attachFreeDict(b: DictBuilder, entries: FdEntry[], lang: 'es' | 'en') {
  const byKey = b.lemmaKeys();
  let matched = 0, created = 0;
  for (const e of entries) {
    if (e.orth.includes(' ')) continue;
    const k = formKey(e.orth);
    if (!k || !isGreek(k)) continue;
    let targets = byKey.get(k);
    if (!targets) {
      // Lema que no está en Wiktextract: lo creamos
      const info = b.lemmaInfo(e.orth);
      const p = e.pos && FD_POS[e.pos];
      if (p) info.pos.add(p);
      b.addAnalysis(e.orth, e.orth, [SELF]);
      targets = [e.orth];
      byKey.set(k, targets);
      created++;
    } else matched++;
    for (const t of targets) {
      const arr = b.gloss(b.lemmas.get(t)!, lang);
      // En inglés, Wiktextract es mejor; FreeDict sólo rellena lemas vacíos
      if (lang === 'en' && arr.length) continue;
      for (const tr of e.trans) pushUnique(arr, tr);
    }
  }
  console.log(`  FreeDict ${lang}: ${entries.length} entradas, ${matched} enlazadas, ${created} lemas nuevos`);
}

export async function buildGreek(paths: Record<string, string>): Promise<DictBuilder> {
  const b = new DictBuilder('el', ['es', 'en'], ['es', 'en'], (tags, ui) => describeGreek(tags, ui as 'es' | 'en'));
  console.log('2. Wiktextract');
  await readWiktextract(b, paths['wiktextract-el']);
  console.log('3. FreeDict');
  attachFreeDict(b, readFreeDict(paths['freedict-ell-spa']), 'es');
  attachFreeDict(b, readFreeDict(paths['freedict-ell-eng']), 'en');
  console.log('4. Frecuencias');
  b.scoreLemmas(readFrequencies(paths['freq-el']));
  return b;
}
