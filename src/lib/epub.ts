// IMP-1 — Lectura de EPUB (2 y 3) con JSZip + DOMParser: título, autor y capítulos en texto plano.
import JSZip from 'jszip';

export interface RawChapter { title: string; paragraphs: string[] }
export interface RawBook { title: string; author?: string; chapters: RawChapter[] }

const BLOCK = new Set([
  'p', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'li', 'blockquote', 'pre', 'section', 'article',
  'td', 'th', 'dd', 'dt', 'figcaption', 'header', 'footer', 'aside', 'main', 'tr', 'ul', 'ol', 'table', 'body',
]);
const SKIP = new Set(['script', 'style', 'head', 'nav', 'sup', 'rt', 'rp', 'svg', 'math', 'img']);

function resolvePath(base: string, href: string): string {
  const clean = decodeURIComponent(href.split('#')[0]);
  if (clean.startsWith('/')) return clean.slice(1);
  const parts = base.split('/').slice(0, -1);
  for (const seg of clean.split('/')) {
    if (seg === '..') parts.pop();
    else if (seg !== '.' && seg !== '') parts.push(seg);
  }
  return parts.join('/');
}

function parseXml(text: string, type: DOMParserSupportedType = 'application/xhtml+xml'): Document {
  const parser = new DOMParser();
  let doc = parser.parseFromString(text, type);
  if (doc.getElementsByTagName('parsererror').length) {
    // XHTML mal formado: el parser HTML es más tolerante
    doc = parser.parseFromString(text, 'text/html');
  }
  return doc;
}

const local = (el: Element) => (el.localName || el.nodeName).toLowerCase().replace(/^.*:/, '');

function byLocalName(root: Document | Element, name: string): Element[] {
  return Array.from(root.getElementsByTagName('*')).filter((e) => local(e) === name);
}

/** Extrae párrafos de un documento XHTML: cada bloque «hoja» es un párrafo. */
export function extractParagraphs(doc: Document): { paragraphs: string[]; heading?: string } {
  const body = byLocalName(doc, 'body')[0] ?? doc.documentElement;
  const paragraphs: string[] = [];
  let heading: string | undefined;

  const hasBlockChild = (el: Element) => Array.from(el.children).some((c) => BLOCK.has(local(c)));

  const textOf = (el: Element): string => {
    let s = '';
    el.childNodes.forEach((n) => {
      if (n.nodeType === 3) s += n.nodeValue ?? '';
      else if (n.nodeType === 1) {
        const e = n as Element;
        const name = local(e);
        if (SKIP.has(name)) return;
        if (name === 'br') s += '\n';
        else s += textOf(e);
      }
    });
    return s;
  };

  const walk = (el: Element) => {
    const name = local(el);
    if (SKIP.has(name)) return;
    if (BLOCK.has(name) && !hasBlockChild(el)) {
      const raw = textOf(el);
      for (const line of raw.split(/\n+/)) {
        const t = line.replace(/\s+/g, ' ').trim();
        if (!t) continue;
        if (!heading && /^h[1-6]$/.test(name)) heading = t;
        paragraphs.push(t);
      }
      return;
    }
    // Texto suelto dentro de un bloque con hijos de bloque
    let loose = '';
    const flush = () => {
      const t = loose.replace(/\s+/g, ' ').trim();
      if (t) paragraphs.push(t);
      loose = '';
    };
    el.childNodes.forEach((n) => {
      if (n.nodeType === 3) loose += n.nodeValue ?? '';
      else if (n.nodeType === 1) {
        const e = n as Element;
        if (BLOCK.has(local(e))) {
          flush();
          walk(e);
        } else if (!SKIP.has(local(e))) loose += local(e) === 'br' ? '\n' : textOf(e);
      }
    });
    flush();
  };
  walk(body);
  return { paragraphs, heading };
}

/** Mapa href → título a partir del nav de EPUB 3 o del NCX de EPUB 2. */
async function readToc(zip: JSZip, opfPath: string, opf: Document): Promise<Map<string, string>> {
  const toc = new Map<string, string>();
  const items = byLocalName(opf, 'item');
  const navItem = items.find((i) => (i.getAttribute('properties') ?? '').split(/\s+/).includes('nav'));
  const ncxItem = items.find((i) => i.getAttribute('media-type') === 'application/x-dtbncx+xml');
  try {
    if (navItem) {
      const path = resolvePath(opfPath, navItem.getAttribute('href')!);
      const doc = parseXml(await zip.file(path)!.async('string'));
      const navs = byLocalName(doc, 'nav');
      const tocNav = navs.find((n) => (n.getAttribute('epub:type') ?? n.getAttributeNS('http://www.idpf.org/2007/ops', 'type') ?? '').includes('toc')) ?? navs[0];
      for (const a of tocNav ? byLocalName(tocNav, 'a') : []) {
        const href = a.getAttribute('href');
        const label = a.textContent?.replace(/\s+/g, ' ').trim();
        if (href && label) {
          const p = resolvePath(path, href);
          if (!toc.has(p)) toc.set(p, label);
        }
      }
    } else if (ncxItem) {
      const path = resolvePath(opfPath, ncxItem.getAttribute('href')!);
      const doc = parseXml(await zip.file(path)!.async('string'), 'application/xml');
      for (const np of byLocalName(doc, 'navpoint')) {
        const label = byLocalName(np, 'text')[0]?.textContent?.trim();
        const src = byLocalName(np, 'content')[0]?.getAttribute('src');
        if (label && src) {
          const p = resolvePath(path, src);
          if (!toc.has(p)) toc.set(p, label);
        }
      }
    }
  } catch {
    /* TOC opcional */
  }
  return toc;
}

export async function parseEpub(data: ArrayBuffer | Uint8Array): Promise<RawBook> {
  const zip = await JSZip.loadAsync(data);
  const container = zip.file('META-INF/container.xml');
  if (!container) throw new Error('No es un EPUB válido (falta META-INF/container.xml)');
  const cdoc = parseXml(await container.async('string'), 'application/xml');
  const opfPath = byLocalName(cdoc, 'rootfile')[0]?.getAttribute('full-path');
  if (!opfPath || !zip.file(opfPath)) throw new Error('No se encuentra el archivo OPF del EPUB');
  const opf = parseXml(await zip.file(opfPath)!.async('string'), 'application/xml');

  const title = byLocalName(opf, 'title')[0]?.textContent?.trim() || 'Sin título';
  const author = byLocalName(opf, 'creator')[0]?.textContent?.trim() || undefined;

  const manifest = new Map<string, { href: string; type: string }>();
  for (const it of byLocalName(opf, 'item')) {
    manifest.set(it.getAttribute('id')!, { href: it.getAttribute('href')!, type: it.getAttribute('media-type') ?? '' });
  }
  const spine = byLocalName(opf, 'itemref').map((r) => manifest.get(r.getAttribute('idref')!)).filter(Boolean) as { href: string; type: string }[];
  const toc = await readToc(zip, opfPath, opf);

  const chapters: RawChapter[] = [];
  for (const item of spine) {
    if (!/x?html|xml/.test(item.type)) continue;
    const path = resolvePath(opfPath, item.href);
    const f = zip.file(path);
    if (!f) continue;
    const { paragraphs, heading } = extractParagraphs(parseXml(await f.async('string')));
    if (!paragraphs.length) continue;
    const t = toc.get(path) ?? heading ?? `Capítulo ${chapters.length + 1}`;
    chapters.push({ title: t.length > 80 ? t.slice(0, 77) + '…' : t, paragraphs });
  }
  if (!chapters.length) throw new Error('El EPUB no contiene texto legible');
  return { title, author, chapters };
}
