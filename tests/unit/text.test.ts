import { describe, it, expect } from 'vitest';
import { tokenize, splitSentences, textToSentences, words } from '../../src/lib/text.ts';
import { textToRawBook, decodeText } from '../../src/lib/importer.ts';

describe('troceado de texto', () => {
  it('divide frases con ; griego y comillas', () => {
    expect(splitSentences('Πού πας; Στο σπίτι. «Ναι!» είπε.')).toEqual(['Πού πας;', 'Στο σπίτι.', '«Ναι!» είπε.']);
  });
  it('no corta en iniciales', () => {
    expect(splitSentences('Ο Ζ. Παπαντωνίου έγραψε. Τέλος.')).toEqual(['Ο Ζ. Παπαντωνίου έγραψε.', 'Τέλος.']);
  });
  it('tokeniza conservando todo el texto y las elisiones', () => {
    const s = 'Είδε τ’ άλλα παιδιά, σ’ αγαπώ.';
    const t = tokenize(s);
    expect(t.map((x) => x.t).join('')).toBe(s);
    expect(words(s)).toEqual(['Είδε', 'τ’', 'άλλα', 'παιδιά', 'σ’', 'αγαπώ']);
  });
  it('textToSentences guarda original y monotónico, marca párrafos', () => {
    const r = textToSentences('Πρῶτος ὁ Φάνης τὴν εἶδε. Καλά.\n\nΔεύτερο.', '0');
    expect(r).toHaveLength(3);
    expect(r[0]).toMatchObject({ id: '0.0', text: 'Πρώτος ο Φάνης την είδε.', original: 'Πρῶτος ὁ Φάνης τὴν εἶδε.', para: true });
    expect(r[1].para).toBeUndefined();
    expect(r[2].para).toBe(true);
  });
});

describe('IMP-1/IMP-2 TXT', () => {
  it('detecta capítulos por encabezados', () => {
    const b = textToRawBook('ΚΕΦΑΛΑΙΟ 1\n\nΑρχή.\n\nΚΕΦΑΛΑΙΟ 2\n\nΤέλος.', 'Libro');
    expect(b.chapters.map((c) => c.title)).toEqual(['ΚΕΦΑΛΑΙΟ 1', 'ΚΕΦΑΛΑΙΟ 2']);
  });
  it('sin encabezados, trocea por longitud', () => {
    const p = Array.from({ length: 30 }, () => 'λέξη '.repeat(200)).join('\n\n');
    expect(textToRawBook(p, 'X').chapters.length).toBeGreaterThan(1);
  });
  it('decodifica Windows-1253', () => {
    const bytes = new Uint8Array([0xc3, 0xe5, 0xe9, 0xdc, 0x20, 0xf3, 0xef, 0xf5, ...Array(40).fill(0xe1)]);
    expect(decodeText(bytes).startsWith('Γειά σου')).toBe(true);
  });
});
