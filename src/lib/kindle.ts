// KIN-1 — Exporta un capítulo como EPUB 3 con glosas de las palabras nuevas/en aprendizaje.
// Pensado para Send-to-Kindle: glosa en línea (pequeña, tras la palabra, sólo la primera vez
// por capítulo) y un glosario al final. Evitamos notas emergentes, que Kindle trata de forma irregular.
import JSZip from 'jszip';
import { tokenize } from './text.ts';
import { formKey } from './normalize.ts';
import type { Sentence } from './text.ts';

export interface Gloss { lemma: string; translation: string }

export interface KindleInput {
  bookTitle: string;
  author?: string;
  chapterTitle: string;
  sentences: Sentence[];
  /** clave de forma → glosa; sólo las palabras que deben glosarse */
  glossFor: (formKey: string) => Gloss | undefined;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function chapterXhtml(input: KindleInput): { xhtml: string; glossary: Gloss[] } {
  const seen = new Set<string>();
  const glossary: Gloss[] = [];
  const paras: string[][] = [];
  for (const s of input.sentences) {
    if (s.para || !paras.length) paras.push([]);
    let html = '';
    for (const t of tokenize(s.text)) {
      if (!t.w) { html += esc(t.t); continue; }
      const g = input.glossFor(formKey(t.t));
      if (g && !seen.has(g.lemma)) {
        seen.add(g.lemma);
        glossary.push(g);
        html += `${esc(t.t)}<span class="gl"> (${esc(g.translation)})</span>`;
      } else html += esc(t.t);
    }
    paras[paras.length - 1].push(html);
  }
  const body = paras.map((p) => `<p>${p.join(' ')}</p>`).join('\n');
  const gl = glossary.length
    ? `<h2>Glosario</h2>\n<dl>\n${glossary.map((g) => `<dt lang="el">${esc(g.lemma)}</dt><dd lang="es">${esc(g.translation)}</dd>`).join('\n')}\n</dl>`
    : '';
  const xhtml = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="el" lang="el">
<head><meta charset="utf-8"/><title>${esc(input.chapterTitle)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>
<h1>${esc(input.chapterTitle)}</h1>
${body}
${gl}
</body>
</html>`;
  return { xhtml, glossary };
}

/** Bytes del EPUB (el llamador lo envuelve en Blob con tipo application/epub+zip). */
export async function buildKindleEpub(input: KindleInput): Promise<Uint8Array> {
  const { xhtml } = chapterXhtml(input);
  const id = `urn:uuid:${globalThis.crypto?.randomUUID?.() ?? Date.now()}`;
  const title = `${input.bookTitle} — ${input.chapterTitle}`;
  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const zip = new JSZip();
  // El mimetype debe ir primero y sin comprimir
  zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' });
  zip.file(
    'META-INF/container.xml',
    `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>`,
  );
  zip.file(
    'OEBPS/content.opf',
    `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="el">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">${esc(id)}</dc:identifier>
    <dc:title>${esc(title)}</dc:title>
    <dc:language>el</dc:language>
    ${input.author ? `<dc:creator>${esc(input.author)}</dc:creator>` : ''}
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="css" href="style.css" media-type="text/css"/>
    <item id="ch" href="chapter.xhtml" media-type="application/xhtml+xml"/>
  </manifest>
  <spine><itemref idref="ch"/></spine>
</package>`,
  );
  zip.file(
    'OEBPS/nav.xhtml',
    `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="el" lang="el">
<head><meta charset="utf-8"/><title>${esc(title)}</title></head>
<body><nav epub:type="toc" id="toc"><ol><li><a href="chapter.xhtml">${esc(input.chapterTitle)}</a></li></ol></nav></body>
</html>`,
  );
  zip.file(
    'OEBPS/style.css',
    `body { line-height: 1.5; }
p { text-indent: 1.2em; margin: 0 0 .4em; }
.gl { font-size: .7em; color: #555; font-style: italic; }
dt { font-weight: bold; margin-top: .3em; }
dd { margin-left: 1em; }`,
  );
  zip.file('OEBPS/chapter.xhtml', xhtml);
  return zip.generateAsync({ type: 'uint8array', mimeType: 'application/epub+zip', compression: 'DEFLATE' });
}
