// PRO-1 / PRO-2 — Cobertura por libro, palabras conocidas y racha.
import type { ActivityRow, Book, WordState } from '../db.ts';
import { today } from '../db.ts';

/**
 * Cobertura de un libro: % de apariciones cuyo lema es conocido (o ignorado).
 * `learningCounts` permite sumar también las que estás aprendiendo (cobertura «con ayuda»).
 */
export function bookCoverage(
  vocab: Book['vocab'],
  stateOf: (lemmaOrForm: string) => WordState | undefined,
): { known: number; withLearning: number; total: number; uniqueForms: number } {
  let total = 0, known = 0, learning = 0;
  for (const [form, [lemma, n]] of Object.entries(vocab)) {
    total += n;
    const st = stateOf(lemma || form);
    if (st === 'known' || st === 'ignored') known += n;
    else if (st === 'learning') learning += n;
  }
  return {
    known: total ? known / total : 0,
    withLearning: total ? (known + learning) / total : 0,
    total,
    uniqueForms: Object.keys(vocab).length,
  };
}

/** Racha: días seguidos con actividad terminando hoy (o ayer, si hoy aún no has leído). */
export function streak(activity: ActivityRow[], now = new Date()): number {
  const days = new Set(activity.filter((a) => a.lookups + a.reviews > 0).map((a) => a.day));
  const d = new Date(now);
  if (!days.has(today(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (days.has(today(d))) {
    n++;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

export function coverageLabel(p: number): { text: string; level: 'easy' | 'ok' | 'hard' } {
  const pct = Math.round(p * 100);
  if (p >= 0.95) return { text: `${pct} % · cómodo`, level: 'easy' };
  if (p >= 0.85) return { text: `${pct} % · aprovechable`, level: 'ok' };
  return { text: `${pct} % · exigente`, level: 'hard' };
}
