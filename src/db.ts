// Esquema IndexedDB (Dexie). Ver docs/PRD.md, «Datos del usuario y backup».
// El diccionario base (dict*) es de solo lectura y se reemplaza entero; lo del usuario nunca se pisa.
import Dexie, { type EntityTable } from 'dexie';
import type { FormRow, LemmaRecord } from './lib/lookup.ts';
import type { Sentence } from './lib/text.ts';
import type { Lang } from './lib/langs.ts';
import { dbNameFor, profile } from './profile.ts';

export type WordState = 'new' | 'learning' | 'known' | 'ignored';

export interface DictFormRow { k: string; r: FormRow[] }
export interface DictNoAccentRow { k: string; v: string[] }
export interface DictLemmaRow extends LemmaRecord { l: string }
export interface MetaRow { key: string; value: unknown }

export interface Book {
  id: string;
  title: string;
  author?: string;
  importedAt: number;
  updatedAt: number;
  /** posición de lectura */
  pos: { chapter: number; sentence: number };
  chapterCount: number;
  /** vocabulario del libro: clave de forma → [lema principal | '', apariciones] (PRO-1, PRO-2) */
  vocab: Record<string, [string, number]>;
  /** cobertura al importar (PRO-2) */
  initialCoverage?: number;
  source?: 'epub' | 'txt' | 'paste' | 'catalog';
  /** id en public/catalog/catalog.json si viene del catálogo (IMP-5) */
  catalogId?: string;
}

export interface Chapter {
  id: string;
  bookId: string;
  index: number;
  title: string;
  sentences: Sentence[];
  readAt?: number;
  updatedAt: number;
}

export interface Lexeme {
  /** lema (o expresión, o forma suelta si no está en el diccionario) */
  lemma: string;
  state: WordState;
  /** traducción elegida */
  translation?: string;
  translationLang?: Lang | 'user';
  notes?: string;
  /** frase de origen */
  sourceSentence?: string;
  sourceSentenceId?: string;
  sourceBookId?: string;
  /** forma tal como apareció */
  sourceForm?: string;
  isExpression?: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface FormChoice { form: string; lemma: string; updatedAt: number }

export interface UserDictEntry {
  /** lema o expresión */
  key: string;
  translation: string;
  isExpression?: boolean;
  updatedAt: number;
}

export interface CardRow {
  id: string;
  lemma: string;
  sentenceId?: string;
  sentence?: string;
  /** estado FSRS serializado (ts-fsrs Card) */
  fsrs: Record<string, unknown>;
  dueAt: number;
  updatedAt: number;
}

export interface SettingRow { key: string; value: unknown; updatedAt: number }

/** Un registro por día con actividad (racha, PRO-1) */
export interface ActivityRow { day: string; lookups: number; reviews: number; updatedAt: number }

export class ElliDB extends Dexie {
  dictForms!: EntityTable<DictFormRow, 'k'>;
  dictNoAccent!: EntityTable<DictNoAccentRow, 'k'>;
  dictLemmas!: EntityTable<DictLemmaRow, 'l'>;
  meta!: EntityTable<MetaRow, 'key'>;
  books!: EntityTable<Book, 'id'>;
  chapters!: EntityTable<Chapter, 'id'>;
  lexemes!: EntityTable<Lexeme, 'lemma'>;
  formChoices!: EntityTable<FormChoice, 'form'>;
  userDict!: EntityTable<UserDictEntry, 'key'>;
  cards!: EntityTable<CardRow, 'id'>;
  settings!: EntityTable<SettingRow, 'key'>;
  activity!: EntityTable<ActivityRow, 'day'>;

  /** IDI-3: una base de datos por idioma de estudio («elliniko» es la de griego) */
  constructor(name = dbNameFor(profile.target)) {
    super(name);
    this.version(1).stores({
      dictForms: 'k',
      dictNoAccent: 'k',
      dictLemmas: 'l',
      meta: 'key',
      books: 'id, updatedAt',
      chapters: 'id, bookId, [bookId+index], updatedAt',
      lexemes: 'lemma, state, updatedAt',
      formChoices: 'form, updatedAt',
      userDict: 'key, updatedAt',
      cards: 'id, lemma, dueAt, updatedAt',
      settings: 'key, updatedAt',
      activity: 'day, updatedAt',
    });
  }
}

export const db = new ElliDB();

/** Almacenes del usuario que entran en el backup (SYS-2) */
export const USER_TABLES = ['lexemes', 'formChoices', 'userDict', 'cards', 'settings', 'activity'] as const;
export const BOOK_TABLES = ['books', 'chapters'] as const;

export function today(d = new Date()): string {
  const z = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`;
}

export async function bumpActivity(field: 'lookups' | 'reviews', database: ElliDB = db) {
  const day = today();
  await database.transaction('rw', database.activity, async () => {
    const row = (await database.activity.get(day)) ?? { day, lookups: 0, reviews: 0, updatedAt: 0 };
    row[field]++;
    row.updatedAt = Date.now();
    await database.activity.put(row);
  });
}
