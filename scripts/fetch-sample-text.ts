// Descarga capítulos de «Τα ψηλά βουνά» (Z. Papantoniou, 1918, dominio público) desde el.wikisource.org
// para los tests de cobertura. Uso: node scripts/fetch-sample-text.ts [nCapítulos=2]
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const API = 'https://el.wikisource.org/w/api.php';
const BOOK = 'Τα ψηλά βουνά';
const n = Number(process.argv[2] ?? 2);

async function parse(page: string): Promise<string> {
  const u = new URL(API);
  u.search = new URLSearchParams({ action: 'parse', page, prop: 'text', format: 'json', formatversion: '2' }).toString();
  const res = await fetch(u, { headers: { 'User-Agent': 'elliniko-fixture-fetcher/0.1' } });
  const j = await res.json();
  if (!j.parse) throw new Error(`No se pudo leer ${page}`);
  return j.parse.text as string;
}

function htmlToText(h: string): string {
  return h
    .replace(/<style[\s\S]*?<\/style>/g, '')
    .replace(/<span[^>]*class="[^"]*pagenum[^"]*"[\s\S]*?<\/span>/g, '')
    .replace(/<sup[\s\S]*?<\/sup>/g, '')
    .replace(/<div[^>]*class="[^"]*(?:ws-noexport|noprint|mw-heading)[^"]*"[\s\S]*?<\/div>/g, '')
    .replace(/<\/p>/g, '\n\n')
    .replace(/<br\s*\/?>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&#160;|&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

const index = await parse(BOOK);
const chapters = [...new Set([...index.matchAll(/title="(Τα ψηλά βουνά\/[^"]+)"/g)].map((m) => m[1]))];
mkdirSync(join(ROOT, 'tests', 'fixtures'), { recursive: true });
for (let i = 0; i < Math.min(n, chapters.length); i++) {
  const title = chapters[i];
  const text = htmlToText(await parse(title));
  const file = join(ROOT, 'tests', 'fixtures', `psila-vouna-${i + 1}.txt`);
  writeFileSync(file, `${title.split('/')[1]}\n\n${text}\n`);
  console.log(`${file}: ${text.length} caracteres`);
}
