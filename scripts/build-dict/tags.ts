// DIC-4 — Traducción fija de etiquetas gramaticales de Wiktextract al español.

const IGNORE = new Set([
  'form-of', 'alt-of', 'table-tags', 'inflection-template', 'romanization', 'canonical',
  'error-unrecognized-form', 'error-unknown-tag', 'indicative', 'definite', 'indefinite',
  'class', 'common', 'mainly', 'often', 'also', 'usually', 'noun', 'pronoun', 'numeral',
  'proper-noun', 'unknown', 'Greek', 'transcription', 'variant', 'standard', 'personal',
  'strong', 'without-noun', 'no-past', 'with-accusative', 'with-nominative', 'before-vowel',
  'literally', 'idiomatic', 'calque', '-i', 'uppercase', 'lowercase',
]);

const PERSON: Record<string, string> = { 'first-person': '1.ª', 'second-person': '2.ª', 'third-person': '3.ª' };
const NUMBER: Record<string, string> = { singular: 'sg.', plural: 'pl.', dual: 'dual' };
const GENDER: Record<string, string> = { masculine: 'masc.', feminine: 'fem.', neuter: 'neutro' };
const CASE_ORDER = ['nominative', 'genitive', 'dative', 'accusative', 'vocative'];
const CASE: Record<string, string> = {
  nominative: 'nom.', genitive: 'gen.', dative: 'dat.', accusative: 'ac.', vocative: 'voc.',
};
const EXTRA: Record<string, string> = {
  comparative: 'comparativo',
  superlative: 'superlativo',
  absolute: 'absoluto',
  alternative: 'forma alternativa',
  Katharevousa: 'katharevousa',
  Demotic: 'demótico',
  archaic: 'arcaico',
  obsolete: 'obsoleto',
  dated: 'anticuado',
  historical: 'histórico',
  informal: 'coloquial',
  colloquial: 'coloquial',
  vernacular: 'popular',
  formal: 'formal',
  literary: 'literario',
  rare: 'poco frecuente',
  uncommon: 'poco frecuente',
  dialectal: 'dialectal',
  regional: 'regional',
  Cyprus: 'chipriota',
  polytonic: 'politónico',
  misspelling: 'error ortográfico',
  nonstandard: 'no estándar',
  hypercorrect: 'hipercorrección',
  abbreviation: 'abreviatura',
  initialism: 'sigla',
  contraction: 'contracción',
  diminutive: 'diminutivo',
  possessive: 'posesivo',
  weak: 'forma átona',
  'short-form': 'forma breve',
  'indirect-object': 'objeto indirecto',
  indeclinable: 'indeclinable',
};

/**
 * Convierte una lista de etiquetas inglesas en una descripción española
 * como «aoristo, 1.ª sg., voz activa» o «part. pasivo, neutro pl., nom./ac.».
 */
export function describeTags(tags: Iterable<string>): string {
  const t = new Set(tags);
  const parts: string[] = [];

  const active = t.has('active');
  const passive = t.has('passive');
  let voiceUsed = false;

  // --- núcleo verbal ---
  if (t.has('participle')) {
    let p = passive ? 'part. pasivo' : active ? 'participio activo' : 'participio';
    if (t.has('perfect') && passive) p = 'part. pasivo';
    if (t.has('present') && active) p = 'gerundio';
    parts.push(p);
    voiceUsed = true;
  } else if (t.has('infinitive-aorist') || t.has('infinitive')) {
    parts.push('infinitivo aoristo (con έχω)');
  } else if (t.has('imperative')) {
    parts.push(t.has('perfective') ? 'imperativo aoristo' : t.has('imperfective') ? 'imperativo presente' : 'imperativo');
  } else if (t.has('subjunctive')) {
    parts.push('subjuntivo');
  } else if (t.has('dependent')) {
    parts.push(t.has('perfective') ? 'aoristo dependiente (tras να/θα)' : 'forma dependiente (tras να/θα)');
  } else if (t.has('pluperfect') || (t.has('past') && t.has('perfect'))) {
    parts.push('pluscuamperfecto');
  } else if (t.has('perfect')) {
    parts.push('perfecto');
  } else if (t.has('future')) {
    parts.push(t.has('perfective') ? 'futuro simple' : t.has('imperfective') ? 'futuro continuo' : 'futuro');
  } else if (t.has('imperfect') || (t.has('past') && t.has('imperfective'))) {
    parts.push('imperfecto');
  } else if (t.has('past')) {
    parts.push('aoristo');
  } else if (t.has('present')) {
    parts.push('presente');
  } else if (t.has('progressive') || t.has('continuative')) {
    parts.push('continuo');
  }

  // --- persona y número / género y número ---
  const person = Object.keys(PERSON).find((k) => t.has(k));
  const numbers = Object.keys(NUMBER).filter((k) => t.has(k)).map((k) => NUMBER[k]);
  const genders = Object.keys(GENDER).filter((k) => t.has(k)).map((k) => GENDER[k]);
  const num = numbers.join('/');
  if (person) {
    parts.push([PERSON[person], num].filter(Boolean).join(' '));
  } else if (genders.length || num) {
    parts.push([genders.join('/'), num].filter(Boolean).join(' '));
  }

  // --- casos ---
  const cases = CASE_ORDER.filter((k) => t.has(k)).map((k) => CASE[k]);
  if (cases.length) parts.push(cases.join('/'));

  // --- voz (si no la llevaba ya el participio) ---
  if (!voiceUsed && (active || passive) && parts.length) {
    parts.push(passive ? 'voz pasiva' : 'voz activa');
  }

  // --- grado, registro, variantes ---
  for (const [k, v] of Object.entries(EXTRA)) {
    if (t.has(k) && !parts.includes(v)) parts.push(v);
  }

  return parts.join(', ');
}

/** Etiquetas que no aportan nada y deben ignorarse al comparar análisis. */
export function significantTags(tags: string[]): string[] {
  return tags.filter((x) => !IGNORE.has(x)).sort();
}

export const POS_ES: Record<string, string> = {
  noun: 'sustantivo',
  adj: 'adjetivo',
  verb: 'verbo',
  name: 'nombre propio',
  adv: 'adverbio',
  pron: 'pronombre',
  prefix: 'prefijo',
  suffix: 'sufijo',
  num: 'numeral',
  intj: 'interjección',
  phrase: 'locución',
  proverb: 'refrán',
  prep: 'preposición',
  conj: 'conjunción',
  prep_phrase: 'locución preposicional',
  article: 'artículo',
  det: 'determinante',
  particle: 'partícula',
  contraction: 'contracción',
  character: 'letra',
  symbol: 'símbolo',
  punct: 'puntuación',
  interfix: 'interfijo',
};

export const CASE_TAGS = new Set(CASE_ORDER);
