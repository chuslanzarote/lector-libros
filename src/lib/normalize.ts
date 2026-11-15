// IMP-3 / DIC-2 — Normalización de texto griego.
// Compartido por la app y por scripts/build-dict (Node ejecuta TypeScript directamente),
// así las claves del diccionario y las de búsqueda se calculan con el mismo código.

const COMBINING = /[̀-ͯ]/g;

// Diacríticos politónicos (tras NFD)
const ACUTE = '́';
const GRAVE = '̀';
const PERISPOMENI = '͂';
const DIAERESIS = '̈';
const DROP = /[̓̔̄̆̓ͅ]/g; // psili, dasia, iota suscrita, macrón, breve, koronis

const APOSTROPHES = /['‘’ʼ´`΄᾽᾿]/g;

/** Unifica comillas/apóstrofos de elisión en ’ (el que usa Wiktionary). */
export function normalizeApostrophes(s: string): string {
  return s.replace(APOSTROPHES, '’');
}

export function nfc(s: string): string {
  return s.normalize('NFC');
}

const VOWELS = 'αεηιουω';

/**
 * Cuenta sílabas de una palabra griega (aprox.): los diptongos αι ει οι υι ου αυ ευ ηυ cuentan
 * como una, y una ι/υ átona tras consonante o diptongo seguida de vocal es sinicesis
 * (μια, για, ποιος, φωτιά = φω-τιά).
 */
export function countSyllables(word: string): number {
  const d = word.normalize('NFD').toLowerCase();
  const letters: { ch: string; diaeresis: boolean; accent: boolean }[] = [];
  for (const ch of d) {
    if (/[̀-ͯ͂̓ͅ]/.test(ch)) {
      const last = letters[letters.length - 1];
      if (last && ch === DIAERESIS) last.diaeresis = true;
      if (last && (ch === ACUTE || ch === GRAVE || ch === PERISPOMENI)) last.accent = true;
      continue;
    }
    letters.push({ ch, diaeresis: false, accent: false });
  }
  const isV = (i: number) => !!letters[i] && VOWELS.includes(letters[i].ch);
  let n = 0;
  for (let i = 0; i < letters.length; i++) {
    if (!isV(i)) continue;
    n++;
    let j = i;
    const next = letters[j + 1];
    if (next && !next.diaeresis && ['αι', 'ει', 'οι', 'υι', 'ου', 'αυ', 'ευ', 'ηυ'].includes(letters[j].ch + next.ch)) j++;
    // sinicesis: ι/υ átona (sola tras consonante, o final de diptongo) + vocal
    const glide = letters[j];
    const prevCons = j === i ? i > 0 && !isV(i - 1) : true;
    if ((glide.ch === 'ι' || glide.ch === 'υ') && !glide.accent && prevCons && isV(j + 1) && !letters[j + 1].diaeresis) j++;
    i = j;
  }
  return n;
}

// Monosílabos que conservan el acento en monotónico.
const KEEP_MONO_ACCENT = new Set(['ή', 'πού', 'πώς']);

/**
 * Convierte una palabra politónica a monotónica:
 * grave y perispómeni → aguda, se eliminan espíritus e iota suscrita,
 * y los monosílabos pierden el acento (salvo ή, πού, πώς).
 */
export function wordToMonotonic(word: string, polytonicText = false): string {
  let d = word.normalize('NFD');
  // En un texto politónico también los monosílabos con aguda («τί») pierden el acento
  if (!/[̀̓̔͂̄̆̓ͅ]/.test(d) && !(polytonicText && d.includes(ACUTE))) return word.normalize('NFC');
  const hadPerispomeni = d.includes(PERISPOMENI);
  d = d.replace(DROP, '').replaceAll(GRAVE, ACUTE).replaceAll(PERISPOMENI, ACUTE);
  // Nunca más de un acento por vocal
  d = d.replace(/́+/g, ACUTE);
  let out = d.normalize('NFC');
  if (countSyllables(out) <= 1) {
    const bare = out.normalize('NFD').replace(/́/g, '').normalize('NFC');
    const lower = out.toLowerCase();
    if (!(KEEP_MONO_ACCENT.has(lower) && (lower === 'ή' || hadPerispomeni))) out = bare;
  }
  return out;
}

const GREEK_WORD = /[\p{Script=Greek}\p{M}]+/gu;

// Letras latinas que se confunden con griegas (errores de OCR o de tecleo en palabras mixtas)
const LATIN_TO_GREEK: Record<string, string> = {
  A: 'Α', B: 'Β', E: 'Ε', H: 'Η', I: 'Ι', K: 'Κ', M: 'Μ', N: 'Ν', O: 'Ο', P: 'Ρ', T: 'Τ', X: 'Χ', Y: 'Υ', Z: 'Ζ',
  a: 'α', o: 'ο', v: 'ν', x: 'χ', i: 'ι', k: 'κ', u: 'υ', p: 'ρ', e: 'ε',
};

/** Arregla palabras que mezclan alfabetos (Bρέθηκε) y el signo micro µ por μ. */
export function fixMixedScript(text: string): string {
  return text.replace(/µ/g, 'μ').replace(/[\p{L}\p{M}]+/gu, (w) => {
    if (!/\p{Script=Greek}/u.test(w) || !/[A-Za-z]/.test(w)) return w;
    return w.replace(/[A-Za-z]/g, (c) => LATIN_TO_GREEK[c] ?? c);
  });
}

/** ¿Está el texto en politónico? (espíritus, perispómeni, grave o iota suscrita frecuentes) */
export function isPolytonic(text: string): boolean {
  const sample = text.length > 200_000 ? text.slice(0, 200_000) : text;
  const marks = (sample.normalize('NFD').match(/[̓̔͂̀ͅ]/g) ?? []).length;
  return marks >= 3 && marks > sample.length / 400;
}

/** Convierte un texto entero (politónico o mixto) a monotónico NFC. */
export function toMonotonic(text: string, polytonicText = false): string {
  const t = fixMixedScript(text.normalize('NFC')).replace(/·/g, '·').replace(/;/g, ';');
  return t.replace(GREEK_WORD, (w) => wordToMonotonic(w, polytonicText));
}

/** Clave exacta del índice `forms`: sin puntuación, minúsculas, NFC, ς→σ. */
export function formKey(token: string): string {
  let s = normalizeApostrophes(token.normalize('NFC'));
  s = s.replace(/[^\p{L}\p{M}’]/gu, '');
  // El apóstrofo sólo cuenta como elisión al final (σ’, απ’); al principio se quita (’ναι → ναι)
  s = s.replace(/^’+/, '');
  s = s.toLowerCase().replace(/ς/g, 'σ');
  return s.normalize('NFC');
}

/** Clave del índice `noAccent`: como formKey pero sin ningún diacrítico. */
export function noAccentKey(token: string): string {
  return formKey(token).normalize('NFD').replace(COMBINING, '').replace(/͂/g, '').normalize('NFC');
}

/** ¿Contiene la cadena al menos una letra griega? */
export function isGreek(s: string): boolean {
  return /\p{Script=Greek}/u.test(s);
}
