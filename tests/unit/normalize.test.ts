import { describe, it, expect } from 'vitest';
import { toMonotonic, wordToMonotonic, formKey, noAccentKey, countSyllables, fixMixedScript } from '../../src/lib/normalize.ts';

describe('IMP-3 politónico → monotónico', () => {
  it('convierte grave, perispómeni y espíritus', () => {
    expect(wordToMonotonic('λαμπρὴ')).toBe('λαμπρή');
    expect(wordToMonotonic('εἶναι')).toBe('είναι');
    expect(wordToMonotonic('Ἀντρέα')).toBe('Αντρέα');
    expect(wordToMonotonic('ὥρα')).toBe('ώρα');
    expect(wordToMonotonic('τῆς')).toBe('της');
  });
  it('los monosílabos pierden el acento salvo ή, πού, πώς', () => {
    expect(wordToMonotonic('ὁ')).toBe('ο');
    expect(wordToMonotonic('καὶ')).toBe('και');
    expect(wordToMonotonic('μιὰ')).toBe('μια');
    expect(wordToMonotonic('ἢ')).toBe('ή');
    expect(wordToMonotonic('Πῶς')).toBe('Πώς');
    expect(wordToMonotonic('ποῦ')).toBe('πού');
    expect(wordToMonotonic('ποὺ')).toBe('που');
  });
  it('convierte una frase entera conservando la puntuación', () => {
    expect(toMonotonic('Βραδιάζει. Τί λαμπρὴ φωτιὰ εἶναι αὐτὴ ποὺ φάνηκε στὸ βουνό!'))
      .toBe('Βραδιάζει. Τί λαμπρή φωτιά είναι αυτή που φάνηκε στο βουνό!');
    expect(toMonotonic('τ’ οὐρανοῦ')).toBe('τ’ ουρανού');
  });
  it('en texto politónico, los monosílabos con aguda también pierden el acento', () => {
    expect(toMonotonic('Τί λαμπρὴ φωτιά', true)).toBe('Τι λαμπρή φωτιά');
    expect(toMonotonic('Τί λαμπρή φωτιά', false)).toBe('Τί λαμπρή φωτιά');
  });
  it('deja intacto el texto ya monotónico y aplica NFC', () => {
    const s = 'Η Ελλάδα είναι όμορφη; Ναι.';
    expect(toMonotonic(s)).toBe(s);
    expect(toMonotonic('έγραψα')).toBe('έγραψα');
  });
  it('corrige alfabetos mezclados y el signo micro', () => {
    expect(fixMixedScript('Bρέθηκε µέρος')).toBe('Βρέθηκε μέρος');
    expect(fixMixedScript('Hello κόσμε')).toBe('Hello κόσμε');
  });
});

describe('claves de búsqueda', () => {
  it('formKey: minúsculas, sin puntuación, ς→σ', () => {
    expect(formKey('«Κοιτάτε,')).toBe('κοιτάτε');
    expect(formKey('Φωτιές!')).toBe('φωτιέσ');
    expect(formKey("σ'")).toBe('σ’');
    expect(formKey('’ναι')).toBe('ναι');
  });
  it('noAccentKey quita todos los diacríticos', () => {
    expect(noAccentKey('Έγραψα')).toBe('εγραψα');
    expect(noAccentKey('προϊόν')).toBe('προιον');
  });
  it('cuenta sílabas con diptongos', () => {
    expect(countSyllables('και')).toBe(1);
    expect(countSyllables('μου')).toBe(1);
    expect(countSyllables('ευχαριστώ')).toBe(4);
    expect(countSyllables('κοροϊδεύω')).toBe(5);
    expect(countSyllables('μια')).toBe(1);
    expect(countSyllables('ποιος')).toBe(1);
    expect(countSyllables('φωτιά')).toBe(2);
    expect(countSyllables('βία')).toBe(2);
  });
});
