// DIC-4 / IDI-2 — Traducción fija de etiquetas gramaticales de Wiktextract a cada idioma de interfaz.
// Griego (lo que se aprende) → español e inglés; español → griego e inglés.
import type { Lang } from '../../src/lib/langs.ts';

const IGNORE = new Set([
  'form-of', 'alt-of', 'table-tags', 'inflection-template', 'romanization', 'canonical',
  'error-unrecognized-form', 'error-unknown-tag', 'indicative', 'definite', 'indefinite',
  'class', 'common', 'mainly', 'often', 'also', 'usually', 'noun', 'pronoun', 'numeral',
  'proper-noun', 'unknown', 'Greek', 'transcription', 'variant', 'standard', 'personal',
  'strong', 'without-noun', 'no-past', 'with-accusative', 'with-nominative', 'before-vowel',
  'literally', 'idiomatic', 'calque', '-i', 'uppercase', 'lowercase',
  // español
  'with-tú', 'with-vos', 'second-person-semantically', 'no-table-tags', 'irregular',
  'by-personal-gender', 'transitive', 'intransitive', 'reflexive', 'pronominal', 'countable', 'uncountable',
]);

/** Etiquetas que no aportan nada y deben ignorarse al comparar análisis. */
export function significantTags(tags: string[]): string[] {
  return tags.filter((x) => !IGNORE.has(x)).sort();
}

export const CASE_ORDER = ['nominative', 'genitive', 'dative', 'accusative', 'vocative'];
export const CASE_TAGS = new Set(CASE_ORDER);

type Terms = Record<string, string>;

// ---------------------------------------------------------------- griego → es / en
const GREEK_TERMS: Record<'es' | 'en', Terms> = {
  es: {
    lemma: 'forma de diccionario', inflected: 'forma flexionada',
    'part.pas': 'part. pasivo', 'part.act': 'participio activo', part: 'participio', gerund: 'gerundio',
    infAor: 'infinitivo aoristo (con έχω)', impAor: 'imperativo aoristo', impPres: 'imperativo presente', imp: 'imperativo',
    subj: 'subjuntivo', depAor: 'aoristo dependiente (tras να/θα)', dep: 'forma dependiente (tras να/θα)',
    plup: 'pluscuamperfecto', perf: 'perfecto', futSimple: 'futuro simple', futCont: 'futuro continuo', fut: 'futuro',
    impf: 'imperfecto', aor: 'aoristo', pres: 'presente', cont: 'continuo',
    '1': '1.ª', '2': '2.ª', '3': '3.ª', sg: 'sg.', pl: 'pl.', dual: 'dual',
    masc: 'masc.', fem: 'fem.', neut: 'neutro',
    nominative: 'nom.', genitive: 'gen.', dative: 'dat.', accusative: 'ac.', vocative: 'voc.',
    passive: 'voz pasiva', active: 'voz activa',
  },
  en: {
    lemma: 'dictionary form', inflected: 'inflected form',
    'part.pas': 'passive participle', 'part.act': 'active participle', part: 'participle', gerund: 'gerund',
    infAor: 'aorist infinitive (with έχω)', impAor: 'aorist imperative', impPres: 'present imperative', imp: 'imperative',
    subj: 'subjunctive', depAor: 'dependent aorist (after να/θα)', dep: 'dependent form (after να/θα)',
    plup: 'pluperfect', perf: 'perfect', futSimple: 'simple future', futCont: 'continuous future', fut: 'future',
    impf: 'imperfect', aor: 'aorist', pres: 'present', cont: 'continuous',
    '1': '1st', '2': '2nd', '3': '3rd', sg: 'sg.', pl: 'pl.', dual: 'dual',
    masc: 'masc.', fem: 'fem.', neut: 'neut.',
    nominative: 'nom.', genitive: 'gen.', dative: 'dat.', accusative: 'acc.', vocative: 'voc.',
    passive: 'passive', active: 'active',
  },
};

// Grado, registro y variantes (comunes a ambos idiomas de estudio)
const EXTRA: Record<string, Partial<Record<Lang, string>>> = {
  comparative: { es: 'comparativo', en: 'comparative', el: 'συγκριτικός' },
  superlative: { es: 'superlativo', en: 'superlative', el: 'υπερθετικός' },
  absolute: { es: 'absoluto', en: 'absolute', el: 'απόλυτος' },
  alternative: { es: 'forma alternativa', en: 'alternative form', el: 'εναλλακτική μορφή' },
  apocopic: { es: 'apócope', en: 'apocopated', el: 'αποκομμένος τύπος' },
  Katharevousa: { es: 'katharevousa', en: 'Katharevousa' },
  Demotic: { es: 'demótico', en: 'Demotic' },
  archaic: { es: 'arcaico', en: 'archaic', el: 'αρχαϊκό' },
  obsolete: { es: 'obsoleto', en: 'obsolete', el: 'απαρχαιωμένο' },
  dated: { es: 'anticuado', en: 'dated', el: 'παρωχημένο' },
  historical: { es: 'histórico', en: 'historical', el: 'ιστορικό' },
  informal: { es: 'coloquial', en: 'informal' },
  colloquial: { es: 'coloquial', en: 'colloquial', el: 'καθομιλουμένη' },
  vernacular: { es: 'popular', en: 'vernacular', el: 'λαϊκό' },
  formal: { es: 'formal', en: 'formal', el: 'ευγενικός τύπος' },
  literary: { es: 'literario', en: 'literary', el: 'λογοτεχνικό' },
  rare: { es: 'poco frecuente', en: 'rare', el: 'σπάνιο' },
  uncommon: { es: 'poco frecuente', en: 'uncommon', el: 'σπάνιο' },
  dialectal: { es: 'dialectal', en: 'dialectal', el: 'διαλεκτικό' },
  regional: { es: 'regional', en: 'regional', el: 'τοπικό' },
  Cyprus: { es: 'chipriota', en: 'Cypriot' },
  polytonic: { es: 'politónico', en: 'polytonic' },
  misspelling: { es: 'error ortográfico', en: 'misspelling', el: 'ορθογραφικό λάθος' },
  nonstandard: { es: 'no estándar', en: 'nonstandard', el: 'μη πρότυπο' },
  hypercorrect: { es: 'hipercorrección', en: 'hypercorrection', el: 'υπερδιόρθωση' },
  abbreviation: { es: 'abreviatura', en: 'abbreviation', el: 'συντομογραφία' },
  initialism: { es: 'sigla', en: 'initialism', el: 'αρκτικόλεξο' },
  contraction: { es: 'contracción', en: 'contraction', el: 'σύντμηση' },
  diminutive: { es: 'diminutivo', en: 'diminutive', el: 'υποκοριστικό' },
  augmentative: { es: 'aumentativo', en: 'augmentative', el: 'μεγεθυντικό' },
  possessive: { es: 'posesivo', en: 'possessive', el: 'κτητικό' },
  weak: { es: 'forma átona', en: 'weak form', el: 'αδύναμος τύπος' },
  'short-form': { es: 'forma breve', en: 'short form', el: 'σύντομος τύπος' },
  'indirect-object': { es: 'objeto indirecto', en: 'indirect object', el: 'έμμεσο αντικείμενο' },
  indeclinable: { es: 'indeclinable', en: 'indeclinable', el: 'άκλιτο' },
  'vos-form': { en: 'voseo (vos)', el: 'voseo (vos)' },
};

function extras(t: Set<string>, ui: Lang, parts: string[]) {
  for (const [k, v] of Object.entries(EXTRA)) {
    const s = v[ui];
    if (s && t.has(k) && !parts.includes(s)) parts.push(s);
  }
}

/**
 * Etiquetas inglesas de una forma griega → descripción en el idioma de la interfaz:
 * «aoristo, 1.ª sg., voz activa» / «aorist, 1st sg., active».
 */
export function describeGreek(tags: Iterable<string>, ui: 'es' | 'en'): string {
  const T = GREEK_TERMS[ui];
  const t = new Set(tags);
  const parts: string[] = [];
  const active = t.has('active');
  const passive = t.has('passive');
  let voiceUsed = false;

  // --- núcleo verbal ---
  if (t.has('participle')) {
    let p = passive ? T['part.pas'] : active ? T['part.act'] : T.part;
    if (t.has('perfect') && passive) p = T['part.pas'];
    if (t.has('present') && active) p = T.gerund;
    parts.push(p);
    voiceUsed = true;
  } else if (t.has('infinitive-aorist') || t.has('infinitive')) {
    parts.push(T.infAor);
  } else if (t.has('imperative')) {
    parts.push(t.has('perfective') ? T.impAor : t.has('imperfective') ? T.impPres : T.imp);
  } else if (t.has('subjunctive')) {
    parts.push(T.subj);
  } else if (t.has('dependent')) {
    parts.push(t.has('perfective') ? T.depAor : T.dep);
  } else if (t.has('pluperfect') || (t.has('past') && t.has('perfect'))) {
    parts.push(T.plup);
  } else if (t.has('perfect')) {
    parts.push(T.perf);
  } else if (t.has('future')) {
    parts.push(t.has('perfective') ? T.futSimple : t.has('imperfective') ? T.futCont : T.fut);
  } else if (t.has('imperfect') || (t.has('past') && t.has('imperfective'))) {
    parts.push(T.impf);
  } else if (t.has('past')) {
    parts.push(T.aor);
  } else if (t.has('present')) {
    parts.push(T.pres);
  } else if (t.has('progressive') || t.has('continuative')) {
    parts.push(T.cont);
  }

  personNumberGender(t, T, parts);

  // --- casos ---
  const cases = CASE_ORDER.filter((k) => t.has(k)).map((k) => T[k]);
  if (cases.length) parts.push(cases.join('/'));

  // --- voz (si no la llevaba ya el participio) ---
  if (!voiceUsed && (active || passive) && parts.length) parts.push(passive ? T.passive : T.active);

  extras(t, ui, parts);
  return parts.join(', ');
}

function personNumberGender(t: Set<string>, T: Terms, parts: string[]) {
  // «first/third-person singular» (hablaba = yo/él): se muestran las dos personas
  const person = [t.has('first-person') && T['1'], t.has('second-person') && T['2'], t.has('third-person') && T['3']].filter(Boolean).join('/');
  const num = [t.has('singular') && T.sg, t.has('plural') && T.pl, t.has('dual') && T.dual].filter(Boolean).join('/');
  const genders = [t.has('masculine') && T.masc, t.has('feminine') && T.fem, t.has('neuter') && T.neut].filter(Boolean).join('/');
  if (person) parts.push([person, num].filter(Boolean).join(' '));
  else if (genders || num) parts.push([genders, num].filter(Boolean).join(' '));
}

// ---------------------------------------------------------------- español → el / en
const SPANISH_TERMS: Record<'el' | 'en', Terms> = {
  en: {
    lemma: 'dictionary form', inflected: 'inflected form',
    inf: 'infinitive', gerund: 'gerund', part: 'past participle',
    presInd: 'present indicative', pret: 'preterite', impfInd: 'imperfect indicative', futInd: 'future indicative',
    cond: 'conditional', presSubj: 'present subjunctive', impfSubjRa: 'imperfect subjunctive (-ra)',
    impfSubjSe: 'imperfect subjunctive (-se)', futSubj: 'future subjunctive', imp: 'imperative', impNeg: 'negative imperative',
    '1': '1st', '2': '2nd', '3': '3rd', sg: 'sg.', pl: 'pl.', dual: 'dual',
    masc: 'masc.', fem: 'fem.', neut: 'neut.', plural: 'plural', singular: 'singular',
  },
  el: {
    lemma: 'λήμμα', inflected: 'κλιτός τύπος',
    inf: 'απαρέμφατο', gerund: 'γερούνδιο', part: 'μετοχή',
    presInd: 'ενεστώτας οριστικής', pret: 'αόριστος οριστικής', impfInd: 'παρατατικός οριστικής', futInd: 'μέλλοντας οριστικής',
    cond: 'δυνητική', presSubj: 'ενεστώτας υποτακτικής', impfSubjRa: 'παρατατικός υποτακτικής (-ra)',
    impfSubjSe: 'παρατατικός υποτακτικής (-se)', futSubj: 'μέλλοντας υποτακτικής', imp: 'προστακτική', impNeg: 'αρνητική προστακτική',
    '1': 'α΄', '2': 'β΄', '3': 'γ΄', sg: 'εν.', pl: 'πληθ.', dual: 'δυϊκός',
    masc: 'αρσ.', fem: 'θηλ.', neut: 'ουδ.', plural: 'πληθυντικός', singular: 'ενικός',
  },
};

/**
 * Etiquetas inglesas de una forma española → descripción en griego o inglés:
 * «αόριστος οριστικής, γ΄ εν.» / «preterite, 3rd sg.».
 */
export function describeSpanish(tags: Iterable<string>, ui: 'el' | 'en'): string {
  const T = SPANISH_TERMS[ui];
  const t = new Set(tags);
  const parts: string[] = [];
  let verbal = true;
  if (t.has('infinitive')) parts.push(T.inf);
  else if (t.has('gerund')) parts.push(T.gerund);
  else if (t.has('participle')) parts.push(T.part);
  else if (t.has('imperative')) parts.push(t.has('negative') ? T.impNeg : T.imp);
  else if (t.has('subjunctive')) {
    parts.push(t.has('imperfect-se') ? T.impfSubjSe : t.has('imperfect') ? T.impfSubjRa : t.has('future') ? T.futSubj : T.presSubj);
  } else if (t.has('imperfect-se')) parts.push(T.impfSubjSe);
  else if (t.has('conditional')) parts.push(T.cond);
  else if (t.has('preterite')) parts.push(T.pret);
  else if (t.has('imperfect')) parts.push(T.impfInd);
  else if (t.has('future')) parts.push(T.futInd);
  else if (t.has('present')) parts.push(T.presInd);
  else verbal = false;

  if (verbal || t.has('first-person') || t.has('second-person') || t.has('third-person')) {
    personNumberGender(t, T, parts);
  } else {
    // sustantivos, adjetivos, determinantes: género y número
    const genders = [t.has('masculine') && T.masc, t.has('feminine') && T.fem, t.has('neuter') && T.neut].filter(Boolean).join('/');
    const num = t.has('plural') ? T.plural : t.has('singular') && genders ? T.singular : '';
    if (genders || num) parts.push([genders, num].filter(Boolean).join(' '));
  }
  extras(t, ui, parts);
  return parts.join(', ');
}

// ---------------------------------------------------------------- categorías
const POS: Record<string, Partial<Record<Lang, string>>> = {
  noun: { es: 'sustantivo', en: 'noun', el: 'ουσιαστικό' },
  adj: { es: 'adjetivo', en: 'adjective', el: 'επίθετο' },
  verb: { es: 'verbo', en: 'verb', el: 'ρήμα' },
  name: { es: 'nombre propio', en: 'proper noun', el: 'κύριο όνομα' },
  adv: { es: 'adverbio', en: 'adverb', el: 'επίρρημα' },
  pron: { es: 'pronombre', en: 'pronoun', el: 'αντωνυμία' },
  prefix: { es: 'prefijo', en: 'prefix', el: 'πρόθημα' },
  suffix: { es: 'sufijo', en: 'suffix', el: 'επίθημα' },
  num: { es: 'numeral', en: 'numeral', el: 'αριθμητικό' },
  intj: { es: 'interjección', en: 'interjection', el: 'επιφώνημα' },
  phrase: { es: 'locución', en: 'phrase', el: 'φράση' },
  proverb: { es: 'refrán', en: 'proverb', el: 'παροιμία' },
  prep: { es: 'preposición', en: 'preposition', el: 'πρόθεση' },
  conj: { es: 'conjunción', en: 'conjunction', el: 'σύνδεσμος' },
  prep_phrase: { es: 'locución preposicional', en: 'prepositional phrase', el: 'προθετική φράση' },
  article: { es: 'artículo', en: 'article', el: 'άρθρο' },
  det: { es: 'determinante', en: 'determiner', el: 'προσδιοριστής' },
  particle: { es: 'partícula', en: 'particle', el: 'μόριο' },
  contraction: { es: 'contracción', en: 'contraction', el: 'σύντμηση' },
  character: { es: 'letra', en: 'letter', el: 'γράμμα' },
  symbol: { es: 'símbolo', en: 'symbol', el: 'σύμβολο' },
  punct: { es: 'puntuación', en: 'punctuation', el: 'σημείο στίξης' },
  interfix: { es: 'interfijo', en: 'interfix', el: 'ένθημα' },
};

/** Categorías de FreeDict → claves de POS */
export const FD_POS: Record<string, string> = {
  n: 'noun', noun: 'noun', v: 'verb', verb: 'verb', adj: 'adj', adv: 'adv',
  pron: 'pron', prep: 'prep', conj: 'conj', int: 'intj', intj: 'intj',
  num: 'num', art: 'article', pn: 'name', propn: 'name', phraseologicalUnit: 'phrase',
  suffix: 'suffix', prefix: 'prefix', ptcl: 'particle',
};

export function isKnownPos(pos: string): boolean {
  return pos in POS;
}

const GENDER_SHORT: Record<Lang, Record<string, string>> = {
  es: { masculine: 'masc.', feminine: 'fem.', neuter: 'neutro' },
  en: { masculine: 'masc.', feminine: 'fem.', neuter: 'neut.' },
  el: { masculine: 'αρσ.', feminine: 'θηλ.', neuter: 'ουδ.' },
};

/** «sustantivo neutro», «noun fem.», «ουσιαστικό θηλ.» */
export function describePos(pos: string[], genders: string[], ui: Lang): string {
  let p = pos.map((x) => POS[x]?.[ui] ?? x).join(' / ');
  if (genders.length) p += ' ' + genders.map((g) => GENDER_SHORT[ui][g]).join('/');
  return p;
}

/** Texto para el id 0 y para «forma flexionada» sin más análisis */
export function baseLabel(kind: 'lemma' | 'inflected', ui: Lang): string {
  const terms = ui === 'el' ? SPANISH_TERMS.el : ui === 'en' ? GREEK_TERMS.en : GREEK_TERMS.es;
  return terms[kind];
}
