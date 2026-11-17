// IDI-2 — Interfaz en el idioma del usuario (español, inglés o griego).
// Cada pantalla tiene su archivo de mensajes en src/i18n/<ns>.ts con las tres lenguas; el español es
// la referencia y el tipo obliga a que inglés y griego tengan exactamente las mismas claves.
import { LOCALE, type Lang } from '../lib/langs.ts';
import { browserLang, hasProfile, profile } from '../profile.ts';
import common from './common.ts';
import welcome from './welcome.ts';
import library from './library.ts';
import word from './word.ts';
import reader from './reader.ts';
import vocab from './vocab.ts';
import review from './review.ts';
import progress from './progress.ts';
import settings from './settings.ts';
import credits from './credits.ts';
import catalog from './catalog.ts';

type Table = Record<string, string>;
export { defineMessages } from './define.ts';

const NAMESPACES = [common, welcome, library, word, reader, vocab, review, progress, settings, credits, catalog];

type Keys<N extends { es: object }> = keyof N['es'] & string;
export type MsgKey =
  | Keys<typeof common> | Keys<typeof welcome> | Keys<typeof library> | Keys<typeof word> | Keys<typeof reader>
  | Keys<typeof vocab> | Keys<typeof review> | Keys<typeof progress> | Keys<typeof settings> | Keys<typeof credits>
  | Keys<typeof catalog>;

export const TABLES: Record<Lang, Table> = {
  es: Object.assign({}, ...NAMESPACES.map((n) => n.es)),
  en: Object.assign({}, ...NAMESPACES.map((n) => n.en)),
  el: Object.assign({}, ...NAMESPACES.map((n) => n.el)),
};

let ui: Lang = hasProfile ? profile.ui : browserLang();

/** Sólo para la pantalla de inicio, que cambia de idioma al vuelo */
export function setUiLang(l: Lang) {
  ui = l;
  if (typeof document !== 'undefined') document.documentElement.lang = l;
}

export function uiLang(): Lang {
  return ui;
}

export function locale(): string {
  return LOCALE[ui];
}

export function fmtNum(n: number, opts?: Intl.NumberFormatOptions): string {
  return n.toLocaleString(LOCALE[ui], opts);
}

export function fmtDate(d: number | Date, opts?: Intl.DateTimeFormatOptions): string {
  return new Date(d).toLocaleString(LOCALE[ui], opts);
}

/**
 * Mensaje traducido. `{x}` se sustituye por params.x (los números se formatean según el idioma).
 * Si falta una clave se usa el español y, si tampoco está, la propia clave.
 */
export function t(key: MsgKey, params?: Record<string, string | number | undefined>): string {
  const s = TABLES[ui][key] ?? TABLES.es[key] ?? key;
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, k) => {
    const v = params[k];
    return v === undefined ? m : typeof v === 'number' ? fmtNum(v) : v;
  });
}

/** Mensaje que depende del idioma que se aprende: busca `${key}.${target}` */
export function tt(key: string, params?: Record<string, string | number | undefined>): string {
  return t(`${key}.${profile.target}` as MsgKey, params);
}
