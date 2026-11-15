import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'node:fs';
import { loadDict } from '../../scripts/build-dict/sample.ts';
import { coverage } from '../../scripts/build-dict/coverage.ts';
import { lookup, sourceFromJson, bestTranslation, orthographicVariants, type DictSource } from '../../src/lib/lookup.ts';

let src: DictSource;
beforeAll(() => {
  src = sourceFromJson(loadDict());
});

const first = async (w: string) => (await lookup(w, src)).candidates;

describe('DIC-2 búsqueda forma → lema + análisis (tests de la Fase 1)', () => {
  it('«έγραψα» → γράφω (aoristo, 1.ª sg.)', async () => {
    const c = await first('έγραψα');
    expect(c[0].lemma).toBe('γράφω');
    expect(c[0].analyses.join(' ')).toMatch(/aoristo, 1\.ª sg\./);
  });
  it('«γράφτηκε» → γράφω (pasiva)', async () => {
    const c = await first('γράφτηκε');
    expect(c[0].lemma).toBe('γράφω');
    expect(c[0].analyses.join(' ')).toMatch(/pasiva/);
  });
  it('«σκονισμένα» → participio', async () => {
    const c = await first('σκονισμένα');
    expect(c[0].lemma).toBe('σκονίζω');
    expect(c[0].analyses.join(' ')).toMatch(/part/);
  });
  it('«δω» → βλέπω', async () => {
    const c = await first('δω');
    expect(c.map((x) => x.lemma)).toContain('βλέπω');
  });
  it('formas ambiguas devuelven varios lemas', async () => {
    const c = await first('το');
    expect(c.map((x) => x.lemma)).toEqual(expect.arrayContaining(['ο', 'το']));
  });
  it('sin acentos y con mayúsculas', async () => {
    expect((await first('ΕΓΡΑΨΑ'))[0].lemma).toBe('γράφω');
    expect((await first('Ανεβήκαμε'))[0].lemma).toBe('ανεβαίνω');
  });
  it('ortografía antigua: subjuntivo en -η', async () => {
    expect(orthographicVariants('πη')).toContain('πει');
    expect((await first('δώση'))[0].lemma).toBe('δίνω');
  });
  it('repeticiones expresivas', () => {
    expect(orthographicVariants('γανώωω')).toContain('γανώ');
  });
  it('palabra desconocida → sin candidatos', async () => {
    expect(await first('ξψζξψζ')).toHaveLength(0);
  });
  it('DIC-3: español si existe, si no inglés; DIC-5: lo personal prevalece', async () => {
    const [g] = await first('γράφω');
    expect(bestTranslation(g)?.lang).toBe('es');
    const [s] = await first('σκονίζω');
    expect(bestTranslation(s)?.lang).toBe('en');
    expect(bestTranslation({ ...s, user: 'empolvar' })).toEqual({ text: 'empolvar', lang: 'user' });
  });
  it('menos de 50 ms por búsqueda', async () => {
    const words = ['έγραψα', 'σπίτια', 'βουνά', 'ερχόμαστε', 'εγραψα', 'κουρασμένοι'];
    const t = performance.now();
    for (const w of words) await lookup(w, src);
    expect((performance.now() - t) / words.length).toBeLessThan(50);
  });
});

describe('cobertura sobre «Τα ψηλά βουνά»', () => {
  it('al menos el 90 % de las palabras del primer capítulo encuentran lema', async () => {
    const { pct } = await coverage(readFileSync('tests/fixtures/psila-vouna-1.txt', 'utf8'));
    expect(pct).toBeGreaterThanOrEqual(90);
  });
});
