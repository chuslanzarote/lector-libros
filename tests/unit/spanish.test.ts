// DIC-7 / IDI — Español como idioma de estudio: normalización, troceado, búsqueda y perfiles.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadDict } from '../../scripts/build-dict/sample.ts';
import { coverage } from '../../scripts/build-dict/coverage.ts';
import { lookup, sourceFromJson, bestTranslation, encliticSplits, type DictSource } from '../../src/lib/lookup.ts';
import { formKey, noAccentKey } from '../../src/lib/normalize.ts';
import { splitSentences, textToSentences } from '../../src/lib/text.ts';
import { glossOrder, isTargetWord, isValidProfile, uiLangsFor } from '../../src/lib/langs.ts';
import { TABLES } from '../../src/i18n/index.ts';

let src: DictSource;
let srcEn: DictSource;
beforeAll(() => {
  const d = loadDict('es');
  src = sourceFromJson(d, 'el');
  srcEn = sourceFromJson(d, 'en');
});
const first = async (w: string, s = src) => (await lookup(w, s)).candidates;
const lemmas = async (w: string) => (await first(w)).map((c) => c.lemma);

describe('IDI-1 perfiles e idiomas', () => {
  it('nunca el mismo idioma en los dos lados', () => {
    expect(isValidProfile({ target: 'es', ui: 'el' })).toBe(true);
    expect(isValidProfile({ target: 'es', ui: 'es' })).toBe(false);
    expect(isValidProfile({ target: 'el', ui: 'el' })).toBe(false);
    expect(isValidProfile({ target: 'fr', ui: 'es' })).toBe(false);
    expect(uiLangsFor('es')).toEqual(['el', 'en']);
  });
  it('DIC-8: tu idioma primero, luego inglés', () => {
    expect(glossOrder({ target: 'es', ui: 'el' })).toEqual(['el', 'en']);
    expect(glossOrder({ target: 'es', ui: 'en' })).toEqual(['en', 'el']);
    expect(glossOrder({ target: 'el', ui: 'es' })).toEqual(['es', 'en']);
    expect(glossOrder({ target: 'el', ui: 'en' })).toEqual(['en', 'es']);
  });
  it('palabras tocables según el idioma', () => {
    expect(isTargetWord('casa', 'es')).toBe(true);
    expect(isTargetWord('σπίτι', 'es')).toBe(false);
    expect(isTargetWord('σπίτι', 'el')).toBe(true);
  });
});

describe('IDI-2 mensajes', () => {
  it('inglés y griego tienen las mismas claves que el español, sin textos vacíos', () => {
    const keys = Object.keys(TABLES.es).sort();
    expect(Object.keys(TABLES.en).sort()).toEqual(keys);
    expect(Object.keys(TABLES.el).sort()).toEqual(keys);
    for (const l of ['es', 'en', 'el'] as const) for (const k of keys) expect(TABLES[l][k], `${l}:${k}`).toBeTruthy();
  });
  it('los marcadores {x} coinciden entre idiomas', () => {
    const marks = (s: string) => (s.match(/\{\w+\}/g) ?? []).sort().join();
    for (const k of Object.keys(TABLES.es)) {
      expect(marks(TABLES.en[k]), `en:${k}`).toBe(marks(TABLES.es[k]));
      expect(marks(TABLES.el[k]), `el:${k}`).toBe(marks(TABLES.es[k]));
    }
  });
});

describe('claves y texto en español', () => {
  it('noAccentKey quita tildes y diéresis pero conserva la ñ', () => {
    expect(noAccentKey('Año')).toBe('año');
    expect(noAccentKey('pingüino')).toBe('pinguino');
    expect(noAccentKey('fué')).toBe('fue');
    expect(formKey('¡Hola!')).toBe('hola');
  });
  it('«;» no cierra frase; ¿? y ¡! sí; abreviaturas e incisos de diálogo no', () => {
    expect(splitSentences('Llegó tarde; luego se fue. ¿Vienes? ¡Claro!', 'es')).toEqual(['Llegó tarde; luego se fue.', '¿Vienes?', '¡Claro!']);
    expect(splitSentences('—¿Qué haces? —preguntó el Sr. Gómez. Nada.', 'es')).toEqual(['—¿Qué haces? —preguntó el Sr. Gómez.', 'Nada.']);
  });
  it('el texto español no se pasa a monotónico', () => {
    const [s] = textToSentences('Él dijo: «sí».', '0', false, 'es');
    expect(s.text).toBe('Él dijo: «sí».');
  });
  it('separa enclíticos', () => {
    expect(encliticSplits('dámelo').map((x) => x.base)).toContain('dá');
    expect(encliticSplits('vámonos').map((x) => x.base)).toContain('vámos'); // «vamos» sale por la vía sin tildes
    expect(encliticSplits('sentaos').map((x) => x.base)).toContain('sentad');
  });
});

describe('DIC-7 búsqueda en español', () => {
  it('formas verbales → infinitivo con análisis', async () => {
    const [c] = await first('hablé');
    expect(c.lemma).toBe('hablar');
    expect(c.analyses.join(' ')).toMatch(/αόριστος/);
    const [e] = await first('hablé', srcEn);
    expect(e.analyses.join(' ')).toMatch(/preterite, 1st sg\./);
    expect((await first('tuviera'))[0].lemma).toBe('tener');
  });
  it('formas ambiguas: «fue» → ser e ir', async () => {
    expect(await lemmas('fue')).toEqual(expect.arrayContaining(['ser', 'ir']));
  });
  it('plurales y femeninos', async () => {
    expect(await lemmas('casas')).toContain('casa');
    expect(await lemmas('niñas')).toContain('niña');
  });
  it('enclíticos: dámelo, diciéndole, levantarse', async () => {
    const [d] = await first('dámelo');
    expect(d.lemma).toBe('dar');
    expect(d.via).toBe('clitic');
    expect(d.clitics).toEqual(['me', 'lo']);
    expect((await first('diciéndole'))[0].lemma).toBe('decir');
    expect((await first('levantarse'))[0].lemma).toBe('levantar');
  });
  it('ortografía antigua: fué, dió', async () => {
    expect(await lemmas('fué')).toEqual(expect.arrayContaining(['ser', 'ir']));
    expect(await lemmas('dió')).toContain('dar');
  });
  it('DIC-8: griego primero, inglés de respaldo', async () => {
    const [p] = await first('perro');
    expect(bestTranslation(p, ['el', 'en'])?.lang).toBe('el');
    expect(bestTranslation(p, ['en', 'el'])?.lang).toBe('en');
  });
  it('los afijos no son candidatos', async () => {
    expect((await lemmas('á')).some((l) => l.startsWith('-'))).toBe(false);
  });
});

describe('cobertura sobre un texto español', () => {
  it('al menos el 95 % de las palabras encuentran lema', async () => {
    const text = `Era una mañana fría de invierno. Los niños salieron de la casa corriendo y se fueron al río,
      donde el agua bajaba muy deprisa. —¡Mirad! —gritó la más pequeña—. Hay un pájaro herido en la orilla.
      Lo recogieron con cuidado, lo envolvieron en una bufanda y volvieron a casa para dárselo a su abuela,
      que sabía curar a todos los animales del pueblo. Ella lo miró despacio, sonrió y dijo que se pondría bien.`;
    const { pct, missing } = await coverage(text, 'es');
    expect(pct, [...missing.keys()].join(', ')).toBeGreaterThanOrEqual(95);
  });
});
