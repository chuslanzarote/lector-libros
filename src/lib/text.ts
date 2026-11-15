// IMP-1 / IMP-3 — Troceado de texto en párrafos, frases y palabras.
import { toMonotonic, isGreek, isPolytonic } from './normalize.ts';

export interface Sentence {
  /** id estable dentro del capítulo: `${chapterIndex}.${n}` lo compone quien llama */
  id: string;
  /** texto monotónico NFC (lo que se muestra y se busca) */
  text: string;
  /** texto original tal como venía (politónico, etc.) */
  original: string;
  /** true si la frase abre un párrafo */
  para?: boolean;
}

export interface Token {
  /** texto de la palabra o del separador */
  t: string;
  /** true si es una palabra (griega o no) que se puede tocar */
  w: boolean;
}

// Palabra: letras y marcas, con apóstrofos de elisión internos o finales (σ’, απ’, ’ναι)
const WORD = /[’'΄᾽]?[\p{L}\p{M}]+(?:[’'΄᾽][\p{L}\p{M}]+)*[’'΄᾽]?/gu;

/** Divide una frase en tokens (palabras y separadores) conservando todo el texto. */
export function tokenize(sentence: string): Token[] {
  const out: Token[] = [];
  let last = 0;
  for (const m of sentence.matchAll(WORD)) {
    const i = m.index!;
    let word = m[0];
    // Un apóstrofo inicial pegado sólo cuenta como elisión si va seguido de griego (’ναι)
    if (/^[’'΄᾽]/.test(word) && !isGreek(word.slice(1, 2))) {
      word = word.slice(1);
    }
    const start = i + (m[0].length - word.length);
    if (start > last) out.push({ t: sentence.slice(last, start), w: false });
    out.push({ t: word, w: true });
    last = start + word.length;
  }
  if (last < sentence.length) out.push({ t: sentence.slice(last), w: false });
  return out;
}

/** Sólo las palabras de una frase. */
export function words(sentence: string): string[] {
  return tokenize(sentence).filter((t) => t.w).map((t) => t.t);
}

// Fin de frase: . ; ! ? … · seguidos de comillas/paréntesis de cierre y espacio.
// El «;» es el signo de interrogación griego.
const SENTENCE_END = /([.;!?…·»”"')\]]*[.;!?…·][»”"')\]]*)(\s+)/gu;

// Abreviaturas comunes que no cierran frase
const ABBREV = /(?:^|\s)(?:κ|κα|δρ|π\.χ|δηλ|βλ|σελ|αρ|τ\.μ|χλμ|μ\.Χ|π\.Χ|κτλ|κλπ|Αγ|Ι\.Χ)\.$/u;

/** Divide un párrafo en frases. */
export function splitSentences(paragraph: string): string[] {
  const p = paragraph.replace(/\s+/g, ' ').trim();
  if (!p) return [];
  const out: string[] = [];
  let start = 0;
  for (const m of p.matchAll(SENTENCE_END)) {
    const end = m.index! + m[1].length;
    const candidate = p.slice(start, end);
    // Inicial de nombre propio («Ζ. Παπαντωνίου») o abreviatura: no corta
    if (ABBREV.test(candidate) || /(?:^|\s)\p{Lu}\.$/u.test(candidate)) continue;
    // Si lo que sigue empieza en minúscula («Ναι!» είπε), la frase continúa
    if (/^\p{Ll}/u.test(p.slice(end + m[2].length))) continue;
    out.push(candidate.trim());
    start = end + m[2].length;
  }
  if (start < p.length) out.push(p.slice(start).trim());
  return out.filter(Boolean);
}

/** Divide un texto en párrafos (líneas en blanco o saltos simples). */
export function splitParagraphs(text: string): string[] {
  const t = text.replace(/\r\n?/g, '\n');
  // Si hay líneas en blanco, son el separador; si no, cada línea es un párrafo
  const parts = /\n\s*\n/.test(t) ? t.split(/\n\s*\n/) : t.split('\n');
  return parts.map((p) => p.replace(/\s*\n\s*/g, ' ').trim()).filter(Boolean);
}

/** Texto → frases normalizadas (NFC + monotónico) conservando el original. */
export function textToSentences(text: string, idPrefix: string, polytonic = isPolytonic(text)): Sentence[] {
  const out: Sentence[] = [];
  let n = 0;
  for (const para of splitParagraphs(text.normalize('NFC'))) {
    let first = true;
    for (const s of splitSentences(para)) {
      const mono = toMonotonic(s, polytonic);
      out.push({ id: `${idPrefix}.${n++}`, text: mono, original: s, ...(first ? { para: true } : {}) });
      first = false;
    }
  }
  return out;
}
