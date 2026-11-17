// IDI-1…IDI-4 — Idiomas: el que se aprende (target) y el del usuario (ui).
// Lógica pura, compartida con los scripts de build.

export type Lang = 'el' | 'es' | 'en';
export type TargetLang = 'el' | 'es';

export interface Profile {
  /** idioma que se aprende: el de los libros y el diccionario */
  target: TargetLang;
  /** idioma del usuario: interfaz y primera traducción */
  ui: Lang;
}

export const TARGETS: TargetLang[] = ['el', 'es'];
export const UI_LANGS: Lang[] = ['es', 'el', 'en'];

export interface TargetInfo {
  /** base de datos IndexedDB de este idioma (IDI-3); la de griego es la original */
  dbName: string;
  /** voz para el TTS (IDI-4) */
  tts: string;
  /** sección de en.wiktionary.org */
  wiktionary: string;
  /** idiomas de las acepciones del diccionario */
  glosses: Lang[];
  /** nombre del idioma en su propio idioma */
  endonym: string;
  /** marca de la cabecera */
  brand: string;
}

export const TARGET_INFO: Record<TargetLang, TargetInfo> = {
  el: { dbName: 'elliniko', tts: 'el-GR', wiktionary: 'Greek', glosses: ['es', 'en'], endonym: 'Ελληνικά', brand: 'Ελληνικό' },
  es: { dbName: 'elliniko-es', tts: 'es-ES', wiktionary: 'Spanish', glosses: ['el', 'en'], endonym: 'Español', brand: 'Español' },
};

/** Nombre de cada idioma en su propio idioma */
export const ENDONYM: Record<Lang, string> = { el: 'Ελληνικά', es: 'Español', en: 'English' };

/** Etiqueta corta para marcar acepciones en otro idioma */
export const LANG_BADGE: Record<Lang, string> = { el: 'ΕΛ', es: 'ES', en: 'EN' };

/** Locale para formatear números y fechas en la interfaz */
export const LOCALE: Record<Lang, string> = { el: 'el-GR', es: 'es-ES', en: 'en-GB' };

export function isValidProfile(p: unknown): p is Profile {
  const x = p as Profile;
  return !!x && TARGETS.includes(x.target) && UI_LANGS.includes(x.ui) && (x.ui as string) !== x.target;
}

/** Idiomas de interfaz posibles para un idioma de estudio (nunca el mismo). */
export function uiLangsFor(target: TargetLang): Lang[] {
  return UI_LANGS.filter((l) => l !== target);
}

/** DIC-8: orden de las acepciones: tu idioma → inglés → el resto del diccionario. */
export function glossOrder(p: Profile): Lang[] {
  const available = TARGET_INFO[p.target].glosses;
  const out: Lang[] = [];
  for (const l of [p.ui, 'en' as Lang, ...available]) if (available.includes(l) && !out.includes(l)) out.push(l);
  return out;
}

/** ¿Es una palabra del idioma de estudio (y por tanto se puede tocar)? */
export function isTargetWord(w: string, target: TargetLang): boolean {
  return target === 'el' ? /\p{Script=Greek}/u.test(w) : /\p{Script=Latin}/u.test(w);
}
