// VOC-1 / LEC-2 / LEC-7 / DIC-5 — Operaciones sobre el vocabulario del usuario.
import type { Chapter, ElliDB, Lexeme, WordState } from '../db.ts';
import { bumpActivity } from '../db.ts';
import { newCardRow } from './srs.ts';
import { countForms, resolveLemmas } from './importer.ts';
import type { DictSource } from './lookup.ts';

export const STATE_LABEL: Record<WordState, string> = {
  new: 'nueva',
  learning: 'aprendiendo',
  known: 'conocida',
  ignored: 'ignorada',
};

export interface SaveLookupInput {
  lemma: string;
  form: string;
  translation?: string;
  translationLang?: Lexeme['translationLang'];
  sentence?: { id: string; text: string; bookId?: string };
  isExpression?: boolean;
}

/** LEC-3: al consultar y elegir, la palabra pasa a «aprendiendo» con la traducción elegida y se crea su tarjeta. */
export async function saveLookup(database: ElliDB, input: SaveLookupInput): Promise<Lexeme> {
  const now = Date.now();
  let saved!: Lexeme;
  // La tarjeta se prepara fuera: dentro de una transacción de IndexedDB no se puede esperar a nada ajeno
  const freshCard = await newCardRow(input.lemma, input.sentence);
  await database.transaction('rw', database.lexemes, database.cards, async () => {
    const prev = await database.lexemes.get(input.lemma);
    saved = {
      ...(prev ?? { createdAt: now, state: 'new' as WordState }),
      lemma: input.lemma,
      state: prev && prev.state !== 'new' ? prev.state : 'learning',
      translation: input.translation ?? prev?.translation,
      translationLang: input.translationLang ?? prev?.translationLang,
      sourceSentence: prev?.sourceSentence ?? input.sentence?.text,
      sourceSentenceId: prev?.sourceSentenceId ?? input.sentence?.id,
      sourceBookId: prev?.sourceBookId ?? input.sentence?.bookId,
      sourceForm: prev?.sourceForm ?? input.form,
      isExpression: input.isExpression ?? prev?.isExpression,
      updatedAt: now,
    } as Lexeme;
    await database.lexemes.put(saved);
    if (saved.state === 'learning' && !(await database.cards.get(input.lemma))) {
      await database.cards.put(freshCard);
    }
  });
  await bumpActivity('lookups', database);
  return saved;
}

export async function setState(database: ElliDB, lemma: string, state: WordState, extra: Partial<Lexeme> = {}) {
  const now = Date.now();
  const freshCard = state === 'learning' ? await newCardRow(lemma, extra.sourceSentence ? { id: extra.sourceSentenceId, text: extra.sourceSentence } : undefined) : null;
  await database.transaction('rw', database.lexemes, database.cards, async () => {
    const prev = await database.lexemes.get(lemma);
    await database.lexemes.put({ createdAt: now, ...prev, ...extra, lemma, state, updatedAt: now });
    if (freshCard && !(await database.cards.get(lemma))) await database.cards.put(freshCard);
  });
}

export async function updateLexeme(database: ElliDB, lemma: string, patch: Partial<Lexeme>) {
  const prev = await database.lexemes.get(lemma);
  if (!prev) return;
  await database.lexemes.put({ ...prev, ...patch, lemma, updatedAt: Date.now() });
}

export async function deleteLexeme(database: ElliDB, lemma: string) {
  await database.transaction('rw', database.lexemes, database.cards, async () => {
    await database.lexemes.delete(lemma);
    await database.cards.delete(lemma);
  });
}

/** DIC-5: traducción propia, que prevalece sobre la del diccionario */
export async function setUserTranslation(database: ElliDB, key: string, translation: string, isExpression = false) {
  const now = Date.now();
  if (!translation.trim()) {
    await database.userDict.delete(key);
    return;
  }
  await database.userDict.put({ key, translation: translation.trim(), isExpression, updatedAt: now });
}

export async function chooseLemma(database: ElliDB, form: string, lemma: string) {
  await database.formChoices.put({ form, lemma, updatedAt: Date.now() });
}

/** LEC-7: las palabras nuevas no consultadas del capítulo pasan a conocidas. Devuelve cuántas. */
export async function markChapterRead(database: ElliDB, chapter: Chapter, src: DictSource): Promise<number> {
  const forms = [...countForms(chapter.sentences).keys()];
  const choices = new Map((await database.formChoices.bulkGet(forms)).filter(Boolean).map((c) => [c!.form, c!.lemma]));
  const lemmaOf = await resolveLemmas(forms, src, choices);
  const keys = [...new Set(forms.map((f) => lemmaOf.get(f) || f))];
  const existing = await database.lexemes.bulkGet(keys);
  const now = Date.now();
  const toKnown: Lexeme[] = [];
  keys.forEach((k, i) => {
    const prev = existing[i];
    if (!prev || prev.state === 'new') toKnown.push({ createdAt: now, ...prev, lemma: k, state: 'known', updatedAt: now });
  });
  await database.transaction('rw', database.lexemes, database.chapters, async () => {
    await database.lexemes.bulkPut(toKnown);
    await database.chapters.update(chapter.id, { readAt: now, updatedAt: now });
  });
  return toKnown.length;
}

/** Mapa lema → estado para colorear (lo que no está es «nueva») */
export async function statesFor(database: ElliDB, lemmas: string[]): Promise<Map<string, WordState>> {
  const rows = await database.lexemes.bulkGet(lemmas);
  const m = new Map<string, WordState>();
  rows.forEach((r, i) => m.set(lemmas[i], r?.state ?? 'new'));
  return m;
}
