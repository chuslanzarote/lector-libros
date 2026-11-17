// VOC-2 — Repaso espaciado con ts-fsrs. El estado FSRS se guarda serializado (fechas en ISO)
// para que IndexedDB y el backup JSON tengan exactamente el mismo formato.
import { DefaultScheduler, Rating } from 'ts-fsrs';
import type { CardRow } from '../db.ts';
import { LOCALE, type Lang } from './langs.ts';

export { Rating };
export type Grade = 1 | 2 | 3 | 4;

type Scheduler = Awaited<ReturnType<typeof DefaultScheduler>>;
let scheduler: Promise<Scheduler> | null = null;

export function getScheduler(): Promise<Scheduler> {
  scheduler ??= DefaultScheduler({ desiredRetention: 0.9, enableFuzz: false });
  return scheduler;
}

const DATE_FIELDS = ['dueAt', 'lastReviewAt', 'reviewTime'];

export function serializeCard(card: object): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(card)) out[k] = v instanceof Date ? v.toISOString() : v;
  return out;
}

export function reviveCard(data: Record<string, unknown>): any {
  const out: Record<string, unknown> = { ...data };
  for (const f of DATE_FIELDS) {
    const v = out[f];
    if (typeof v === 'string' || typeof v === 'number') out[f] = new Date(v);
  }
  return out;
}

export async function newCardRow(lemma: string, sentence?: { id?: string; text?: string }, now = new Date()): Promise<CardRow> {
  const s = await getScheduler();
  const card = s.newCard({ now });
  return {
    id: `${lemma}`,
    lemma,
    sentenceId: sentence?.id,
    sentence: sentence?.text,
    fsrs: serializeCard(card),
    dueAt: now.getTime(),
    updatedAt: now.getTime(),
  };
}

export async function reviewCard(row: CardRow, grade: Grade, now = new Date()): Promise<CardRow> {
  const s = await getScheduler();
  const result = s.review({ card: reviveCard(row.fsrs), grade, now });
  const card = result.card as { dueAt: Date };
  return { ...row, fsrs: serializeCard(result.card), dueAt: card.dueAt.getTime(), updatedAt: now.getTime() };
}

/** Intervalo previsto por cada nota, para mostrarlo en los botones */
export async function previewIntervals(row: CardRow, now = new Date(), lang: Lang = 'es'): Promise<Record<Grade, string>> {
  const s = await getScheduler();
  const out = {} as Record<Grade, string>;
  for (const p of s.preview({ card: reviveCard(row.fsrs), now })) {
    const due = (p.card as { dueAt: Date }).dueAt.getTime();
    out[p.grade as Grade] = humanInterval(due - now.getTime(), lang);
  }
  return out;
}

/** Unidades de intervalo por idioma de interfaz (IDI-2) */
const UNITS: Record<Lang, { min: string; h: string; d: string; month: (n: number) => string; year: string }> = {
  es: { min: 'min', h: 'h', d: 'd', month: (n) => `mes${n > 1 ? 'es' : ''}`, year: 'años' },
  en: { min: 'min', h: 'h', d: 'd', month: (n) => `month${n > 1 ? 's' : ''}`, year: 'years' },
  el: { min: 'λεπ.', h: 'ώρ.', d: 'ημ.', month: (n) => (n > 1 ? 'μήνες' : 'μήνας'), year: 'χρόνια' },
};

export function humanInterval(ms: number, lang: Lang = 'es'): string {
  const u = UNITS[lang];
  const m = Math.round(ms / 60000);
  if (m < 60) return `${Math.max(1, m)} ${u.min}`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${u.h}`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d} ${u.d}`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo} ${u.month(mo)}`;
  const y = d / 365;
  const ys = lang === 'es' ? y.toFixed(1) : y.toLocaleString(LOCALE[lang], { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `${ys} ${u.year}`;
}
