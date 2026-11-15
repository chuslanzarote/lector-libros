// IMP-6 — Nivel estimado de un texto a partir de su vocabulario (sin IA).
// Se mide qué parte de las palabras pertenece a los lemas más frecuentes del griego
// (FrequencyWords, OpenSubtitles), la longitud de frase y el peso de la katharévousa.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { lookup, sourceFromJson, type DictJson, type DictSource } from '../../src/lib/lookup.ts';
import { formKey, isGreek } from '../../src/lib/normalize.ts';
import { textToSentences, words } from '../../src/lib/text.ts';
import type { RawBook } from '../../src/lib/epub.ts';

export interface Metrics {
  words: number;
  /** % de palabras (sin nombres propios) cubiertas por los 1000 / 3000 lemas más frecuentes */
  top1k: number;
  top3k: number;
  /** % de palabras sin lema en el diccionario */
  unknown: number;
  /** palabras por frase */
  sentenceLen: number;
  /** % de marcadores de katharévousa (εις, ήτο, ουχί…) */
  katharevousa: number;
  /** puntuación de dificultad: mayor = más difícil */
  score: number;
}

// Marcadores claros del registro culto que no aparecen en demótico corriente
const KATH = new Set(['εισ', 'εν', 'υπο', 'δια', 'ουχι', 'ητο', 'ινα', 'ουτω', 'τοισ', 'ταισ', 'ανευ', 'ουδε', 'ητον', 'ουδεισ', 'εκ', 'ων', 'ουσα', 'αι']);

export function lemmaRanks(dict: DictJson, freqFile: string): Map<string, number> {
  const byLemma = new Map<string, number>();
  for (const line of readFileSync(freqFile, 'utf8').split('\n')) {
    const [w, c] = line.trim().split(/\s+/);
    if (!w || !c) continue;
    const rows = dict.forms[formKey(w)];
    const lemma = rows?.[0]?.[0] ?? (dict.lemmas[formKey(w)] ? formKey(w) : undefined);
    if (lemma) byLemma.set(lemma, (byLemma.get(lemma) ?? 0) + Number(c));
  }
  const ranks = new Map<string, number>();
  [...byLemma].sort((a, b) => b[1] - a[1]).forEach(([l], i) => ranks.set(l, i + 1));
  return ranks;
}

export class Leveler {
  private src: DictSource;
  private cache = new Map<string, string | null>();
  private ranks: Map<string, number>;
  constructor(dict: DictJson, ranks: Map<string, number>) {
    this.src = sourceFromJson(dict);
    this.ranks = ranks;
  }

  private async lemma(w: string): Promise<string | null> {
    const k = formKey(w);
    if (this.cache.has(k)) return this.cache.get(k)!;
    const r = await lookup(w, this.src);
    const l = r.candidates[0]?.lemma ?? null;
    this.cache.set(k, l);
    return l;
  }

  async measure(book: RawBook): Promise<Metrics> {
    const text = book.chapters.map((c) => c.paragraphs.join('\n\n')).join('\n\n');
    const sentences = textToSentences(text, 'm');
    let n = 0, k1 = 0, k3 = 0, unk = 0, kath = 0, all = 0, sents = 0;
    for (const s of sentences) {
      const ws = words(s.text).filter(isGreek);
      if (!ws.length) continue;
      sents++;
      all += ws.length;
      for (let i = 0; i < ws.length; i++) {
        const w = ws[i];
        if (KATH.has(formKey(w))) kath++;
        const l = await this.lemma(w);
        // Mayúscula a mitad de frase y sin lema: casi siempre un nombre propio, no cuenta
        if (!l && i > 0 && w[0] !== w[0].toLowerCase()) continue;
        n++;
        if (!l) { unk++; continue; }
        const r = this.ranks.get(l) ?? Infinity;
        if (r <= 1000) k1++;
        if (r <= 3000) k3++;
      }
    }
    const pct = (x: number, d = n) => (d ? Math.round((1000 * x) / d) / 10 : 0);
    const m = {
      words: all,
      top1k: pct(k1),
      top3k: pct(k3),
      unknown: pct(unk),
      sentenceLen: sents ? Math.round((10 * all) / sents) / 10 : 0,
      katharevousa: pct(kath, all),
    };
    return { ...m, score: difficulty(m) };
  }
}

/**
 * Dificultad: palabras fuera de las 3000 más frecuentes (lo que obliga a consultar),
 * más un poco por frases largas y por katharévousa. Escala aproximada 10–60.
 */
export function difficulty(m: Omit<Metrics, 'score'>): number {
  const rare = 100 - m.top3k; // incluye las desconocidas
  return Math.round(10 * (rare + 0.25 * Math.max(0, m.sentenceLen - 10) + 1.5 * m.katharevousa)) / 10;
}

export type Level = 'A2' | 'B1' | 'B2' | 'C1';
export const LEVELS: Level[] = ['A2', 'B1', 'B2', 'C1'];

/** Cortes fijos (no por cuantiles) para que el nivel de un libro no dependa del resto del catálogo. */
export const CUTS: Record<Exclude<Level, 'C1'>, number> = { A2: 16, B1: 20.5, B2: 30 };

export function levelOf(score: number): Level {
  if (score < CUTS.A2) return 'A2';
  if (score < CUTS.B1) return 'B1';
  if (score < CUTS.B2) return 'B2';
  return 'C1';
}

export function freqFile(root: string) {
  return join(root, '.cache', 'el_50k.txt');
}
