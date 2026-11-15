// Cobertura del diccionario sobre un texto: npm run coverage:text -- archivo.txt [--missing]
import { readFileSync } from 'node:fs';
import { loadDict } from './sample.ts';
import { lookup, sourceFromJson } from '../../src/lib/lookup.ts';
import { textToSentences, words } from '../../src/lib/text.ts';
import { isGreek } from '../../src/lib/normalize.ts';

export async function coverage(text: string) {
  const src = sourceFromJson(loadDict());
  const sentences = textToSentences(text, 'c');
  let total = 0, found = 0;
  const missing = new Map<string, number>();
  for (const s of sentences) {
    for (const w of words(s.text)) {
      if (!isGreek(w)) continue;
      total++;
      const r = await lookup(w, src);
      if (r.candidates.length) found++;
      else missing.set(w, (missing.get(w) ?? 0) + 1);
    }
  }
  return { total, found, pct: (100 * found) / total, missing };
}

const files = process.argv.slice(2).filter((a) => !a.startsWith('--'));
if (files.length) {
  for (const f of files) {
    const { total, found, pct, missing } = await coverage(readFileSync(f, 'utf8'));
    console.log(`${f}: ${found}/${total} palabras con lema = ${pct.toFixed(1)} %`);
    if (process.argv.includes('--missing')) {
      console.log('  sin lema:', [...missing].sort((a, b) => b[1] - a[1]).map(([w, n]) => (n > 1 ? `${w}×${n}` : w)).join(', '));
    }
  }
}
