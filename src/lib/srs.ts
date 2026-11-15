// VOC-2 — Repaso espaciado con ts-fsrs. El estado FSRS se guarda serializado (fechas en ISO)
// para que IndexedDB y el backup JSON tengan exactamente el mismo formato.
import { DefaultScheduler, Rating } from 'ts-fsrs';
import type { CardRow } from '../db.ts';

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
export async function previewIntervals(row: CardRow, now = new Date()): Promise<Record<Grade, string>> {
  const s = await getScheduler();
  const out = {} as Record<Grade, string>;
  for (const p of s.preview({ card: reviveCard(row.fsrs), now })) {
    const due = (p.card as { dueAt: Date }).dueAt.getTime();
    out[p.grade as Grade] = humanInterval(due - now.getTime());
  }
  return out;
}

export function humanInterval(ms: number): string {
  const m = Math.round(ms / 60000);
  if (m < 60) return `${Math.max(1, m)} min`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h`;
  const d = Math.round(h / 24);
  if (d < 31) return `${d} d`;
  const mo = Math.round(d / 30);
  if (mo < 12) return `${mo} mes${mo > 1 ? 'es' : ''}`;
  return `${(d / 365).toFixed(1)} años`;
}
