// Muestra de búsquedas sobre el diccionario generado: npm run sample:dict [-- palabra1 palabra2 ...]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lookup, sourceFromJson, bestTranslation, type DictJson } from '../../src/lib/lookup.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export function loadDict(): DictJson {
  return JSON.parse(gunzipSync(readFileSync(join(ROOT, 'public/dict/dict.json.gz'))).toString('utf8'));
}

const DEFAULT = [
  'έγραψα', 'γράφτηκε', 'σκονισμένα', 'δω', 'πιο', 'είναι', 'το', 'της', 'βουνά', 'παιδιά',
  'ήταν', 'πήγαμε', 'Ανεβήκαμε', 'καλύτερη', 'σπίτι', 'μας', 'είπε', 'θάλασσα', 'εγραψα', 'σ’',
];

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const words = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT;
  const dict = loadDict();
  const src = sourceFromJson(dict);
  for (const w of words) {
    const t = performance.now();
    const r = await lookup(w, src);
    const ms = (performance.now() - t).toFixed(2);
    console.log(`\n${w}  (${ms} ms)`);
    if (!r.candidates.length) console.log('   — No está en el diccionario');
    for (const c of r.candidates) {
      const tr = bestTranslation(c);
      const trs = tr ? (tr.lang === 'en' ? `[EN] ${c.en.slice(0, 3).join('; ')}` : c.es.slice(0, 3).join('; ')) : '—';
      console.log(`   → ${c.lemma} (${c.pos ?? '?'})  ${c.analyses.join(' | ')}  ·  ${trs}${c.via !== 'exact' ? `  [${c.via}]` : ''}`);
    }
  }
}
