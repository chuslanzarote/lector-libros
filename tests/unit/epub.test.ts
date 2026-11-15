// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import { parseEpub } from '../../src/lib/epub.ts';
import { buildKindleEpub, chapterXhtml } from '../../src/lib/kindle.ts';
import { vocabToCsv } from '../../src/lib/anki.ts';
import { textToSentences } from '../../src/lib/text.ts';


async function makeEpub2(): Promise<Uint8Array> {
  const z = new JSZip();
  z.file('mimetype', 'application/epub+zip');
  z.file('META-INF/container.xml', `<?xml version="1.0"?><container xmlns="urn:oasis:names:tc:opendocument:xmlns:container" version="1.0"><rootfiles><rootfile full-path="OPS/book.opf" media-type="application/oebps-package+xml"/></rootfiles></container>`);
  z.file('OPS/book.opf', `<?xml version="1.0"?><package xmlns="http://www.idpf.org/2007/opf" version="2.0"><metadata xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>Τα ψηλά βουνά</dc:title><dc:creator>Ζαχαρίας Παπαντωνίου</dc:creator></metadata>
  <manifest><item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/><item id="c1" href="text/c1.xhtml" media-type="application/xhtml+xml"/><item id="c2" href="text/c2.xhtml" media-type="application/xhtml+xml"/><item id="img" href="cover.jpg" media-type="image/jpeg"/></manifest>
  <spine toc="ncx"><itemref idref="c1"/><itemref idref="c2"/></spine></package>`);
  z.file('OPS/toc.ncx', `<?xml version="1.0"?><ncx xmlns="http://www.daisy.org/z3986/2005/ncx/"><navMap><navPoint id="n1"><navLabel><text>Οι τρεις φωτιές</text></navLabel><content src="text/c1.xhtml"/></navPoint></navMap></ncx>`);
  z.file('OPS/text/c1.xhtml', `<?xml version="1.0"?><html xmlns="http://www.w3.org/1999/xhtml"><head><title>x</title></head><body><h1>1</h1><p>Βραδιάζει. Τί λαμπρὴ φωτιὰ<sup>1</sup>!</p><div><p>Δεύτερο.</p></div></body></html>`);
  z.file('OPS/text/c2.xhtml', `<html xmlns="http://www.w3.org/1999/xhtml"><body><h2>Δεύτερο κεφάλαιο</h2><p>Κείμενο<br/>με αλλαγή</p></body></html>`);
  return z.generateAsync({ type: 'uint8array' });
}

describe('IMP-1 EPUB', () => {
  it('lee título, autor, capítulos (NCX y encabezados) y párrafos', async () => {
    const b = await parseEpub(await makeEpub2());
    expect(b.title).toBe('Τα ψηλά βουνά');
    expect(b.author).toBe('Ζαχαρίας Παπαντωνίου');
    expect(b.chapters.map((c) => c.title)).toEqual(['Οι τρεις φωτιές', 'Δεύτερο κεφάλαιο']);
    expect(b.chapters[0].paragraphs).toEqual(['1', 'Βραδιάζει. Τί λαμπρὴ φωτιὰ!', 'Δεύτερο.']);
    expect(b.chapters[1].paragraphs).toEqual(['Δεύτερο κεφάλαιο', 'Κείμενο', 'με αλλαγή']);
  });

  it('rechaza archivos que no son EPUB', async () => {
    const z = new JSZip();
    z.file('a.txt', 'x');
    await expect(parseEpub(await z.generateAsync({ type: 'uint8array' }))).rejects.toThrow(/EPUB/);
  });
});

describe('KIN-1 EPUB glosado', () => {
  const sentences = textToSentences('Έγραψα ένα γράμμα. Το έγραψα ξανά.\n\nΤέλος.', '0');
  const input = {
    bookTitle: 'Libro',
    chapterTitle: 'Cap 1',
    sentences,
    glossFor: (k: string) => (k === 'έγραψα' ? { lemma: 'γράφω', translation: 'escribir' } : undefined),
  };

  it('glosa sólo la primera aparición y añade glosario', () => {
    const { xhtml, glossary } = chapterXhtml(input);
    expect(xhtml.match(/class="gl"/g)).toHaveLength(1);
    expect(glossary).toEqual([{ lemma: 'γράφω', translation: 'escribir' }]);
    expect(xhtml).toContain('<dt lang="el">γράφω</dt>');
    expect(xhtml.match(/<p>/g)).toHaveLength(2);
  });

  it('genera un EPUB 3 válido que se vuelve a leer', async () => {
    const buf = await buildKindleEpub(input);
    const zip = await JSZip.loadAsync(buf);
    expect(Object.keys(zip.files)[0]).toBe('mimetype');
    expect(await zip.file('mimetype')!.async('string')).toBe('application/epub+zip');
    const back = await parseEpub(buf);
    expect(back.title).toBe('Libro — Cap 1');
    expect(back.chapters[0].paragraphs.join(' ')).toContain('(escribir)');
  });
});

describe('VOC-3 CSV para Anki', () => {
  it('escapa comas y comillas, filtra por estado y resalta la palabra', () => {
    const csv = vocabToCsv([
      { lemma: 'γράφω', state: 'learning', translation: 'escribir, redactar', sourceSentence: 'Έγραψα "ένα" γράμμα.', sourceForm: 'Έγραψα', createdAt: 0, updatedAt: 0 },
      { lemma: 'ignorada', state: 'ignored', createdAt: 0, updatedAt: 0 },
    ]);
    const lines = csv.trim().split('\n');
    expect(lines[0]).toBe('#separator:Comma');
    expect(lines).toHaveLength(5);
    expect(lines[4]).toContain('"escribir, redactar"');
    expect(lines[4]).toContain('<b>Έγραψα</b>');
    expect(lines[4]).toContain('""ένα""');
  });
});
