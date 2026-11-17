import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach } from 'vitest';
import { ElliDB } from '../../src/db.ts';
import { exportBackup, importBackup, backupFileName, BackupLangError } from '../../src/lib/backup.ts';
import { saveLookup, setState, markChapterRead } from '../../src/lib/vocab.ts';
import { sourceFromJson, type DictJson } from '../../src/lib/lookup.ts';
import { installDict, idbSource, getDictMeta } from '../../src/lib/dictStore.ts';
import { rawBookToRecords, saveImport } from '../../src/lib/importer.ts';

let n = 0;
const fresh = () => new ElliDB(`test-${n++}`);

const miniDict: DictJson = {
  format: 2,
  lang: 'el',
  glosses: ['es', 'en'],
  version: 't',
  labels: {
    es: ['forma de diccionario', 'aoristo, 1.ª sg., voz activa', 'verbo', 'sustantivo'],
    en: ['dictionary form', 'aorist, 1st sg., active', 'verb', 'noun'],
  },
  lemmas: { γράφω: { p: 2, es: ['escribir'] }, σπίτι: { p: 3, es: ['casa'] } },
  forms: { γράφω: [['γράφω', 0]], έγραψα: [['γράφω', 1]], σπίτι: [['σπίτι', 0]] },
  noAccent: { εγραψα: ['έγραψα'], γραφω: ['γράφω'] },
};

describe('SYS-2 backup', () => {
  let a: ElliDB, b: ElliDB;
  beforeEach(() => {
    a = fresh();
    b = fresh();
  });

  it('nombre de archivo con la fecha', () => {
    expect(backupFileName(new Date(2026, 10, 5))).toBe('elliniko-backup-2026-11-05.json');
    expect(backupFileName(new Date(2026, 10, 5), 'es')).toBe('elliniko-es-backup-2026-11-05.json');
  });

  it('IDI-3: un backup de español no se importa en griego (los antiguos sin «lang» son de griego)', async () => {
    await a.settings.put({ key: 'fontSize', value: 22, updatedAt: 3 });
    const es = JSON.parse(JSON.stringify(await exportBackup(a, { includeBooks: false, lang: 'es' })));
    expect(es.lang).toBe('es');
    await expect(importBackup(b, es, 'el')).rejects.toBeInstanceOf(BackupLangError);
    expect((await importBackup(b, es, 'es')).added).toBe(1);
    const { lang: _drop, ...old } = es;
    await expect(importBackup(fresh(), old, 'es')).rejects.toBeInstanceOf(BackupLangError);
    expect((await importBackup(fresh(), old)).added).toBe(1);
  });

  it('exporta e importa sin perder nada (ida y vuelta por JSON)', async () => {
    await saveLookup(a, { lemma: 'γράφω', form: 'έγραψα', translation: 'escribir', translationLang: 'es', sentence: { id: '0.1', text: 'Έγραψα ένα γράμμα.' } });
    await setState(a, 'σπίτι', 'known');
    await a.formChoices.put({ form: 'το', lemma: 'ο', updatedAt: 1 });
    await a.userDict.put({ key: 'γράφω', translation: 'escribir (mío)', updatedAt: 2 });
    await a.settings.put({ key: 'fontSize', value: 22, updatedAt: 3 });

    const json = JSON.parse(JSON.stringify(await exportBackup(a, { includeBooks: false })));
    expect(json.tables.books).toBeUndefined();
    const rep = await importBackup(b, json);
    expect(rep.added).toBeGreaterThanOrEqual(6);

    for (const t of ['lexemes', 'formChoices', 'userDict', 'cards', 'settings', 'activity'] as const) {
      expect(await b.table(t).toArray()).toEqual(await a.table(t).toArray());
    }
  });

  it('fusiona por updatedAt: gana el más reciente y no borra nada', async () => {
    await a.lexemes.put({ lemma: 'x', state: 'known', createdAt: 1, updatedAt: 100 });
    await a.lexemes.put({ lemma: 'y', state: 'learning', createdAt: 1, updatedAt: 100 });
    await b.lexemes.put({ lemma: 'x', state: 'learning', createdAt: 1, updatedAt: 50 }); // más viejo → se actualiza
    await b.lexemes.put({ lemma: 'y', state: 'known', createdAt: 1, updatedAt: 200 }); // más nuevo → se queda
    await b.lexemes.put({ lemma: 'z', state: 'known', createdAt: 1, updatedAt: 1 }); // sólo en b → se queda

    const rep = await importBackup(b, JSON.parse(JSON.stringify(await exportBackup(a, { includeBooks: false }))));
    expect(rep.perTable.lexemes).toEqual({ added: 0, updated: 1, kept: 1 });
    expect((await b.lexemes.get('x'))!.state).toBe('known');
    expect((await b.lexemes.get('y'))!.state).toBe('known');
    expect(await b.lexemes.get('z')).toBeTruthy();
  });

  it('incluye libros si se pide', async () => {
    const r = await rawBookToRecords({ title: 'T', chapters: [{ title: 'c1', paragraphs: ['Έγραψα στο σπίτι.'] }] }, 'paste', sourceFromJson(miniDict));
    await saveImport(a, r);
    const bk = await exportBackup(a, { includeBooks: true });
    await importBackup(b, JSON.parse(JSON.stringify(bk)));
    expect((await b.books.toArray())[0].title).toBe('T');
    expect((await b.chapters.toArray())[0].sentences[0].text).toBe('Έγραψα στο σπίτι.');
  });

  it('rechaza archivos que no son backups', async () => {
    await expect(importBackup(b, { foo: 1 })).rejects.toThrow();
  });
});

describe('diccionario en IndexedDB y vocabulario', () => {
  it('instala el diccionario y busca a través de IndexedDB', async () => {
    const d = fresh();
    const progress: number[] = [];
    await installDict(d, miniDict, (p) => progress.push(p));
    expect(progress.at(-1)).toBe(1);
    const meta = await getDictMeta(d);
    const src = idbSource(d, meta!, 'es');
    expect((await src.form('έγραψα'))?.[0][0]).toBe('γράφω');
    expect(src.tag(1)).toBe('aoristo, 1.ª sg., voz activa');
    expect(idbSource(d, meta!, 'en').tag(1)).toBe('aorist, 1st sg., active');
    expect(meta!.lang).toBe('el');
  });

  it('rechaza diccionarios de formato antiguo', async () => {
    const d = fresh();
    await expect(installDict(d, { ...miniDict, format: 1 })).rejects.toThrow(/formato/i);
  });

  it('LEC-3: consultar pasa a «aprendiendo» y crea tarjeta; LEC-7 marca el resto como conocidas', async () => {
    const d = fresh();
    const src = sourceFromJson(miniDict);
    const r = await rawBookToRecords({ title: 'T', chapters: [{ title: 'c1', paragraphs: ['Έγραψα στο σπίτι.'] }] }, 'paste', src);
    expect(r.book.vocab['έγραψα']).toEqual(['γράφω', 1]);
    await saveLookup(d, { lemma: 'γράφω', form: 'Έγραψα', translation: 'escribir' });
    expect((await d.lexemes.get('γράφω'))!.state).toBe('learning');
    expect(await d.cards.get('γράφω')).toBeTruthy();
    const changed = await markChapterRead(d, r.chapters[0], src);
    expect((await d.lexemes.get('σπίτι'))!.state).toBe('known');
    expect((await d.lexemes.get('γράφω'))!.state).toBe('learning');
    expect(changed).toBe(2); // σπίτι y «στο» (sin lema en el mini-diccionario)
  });
});
