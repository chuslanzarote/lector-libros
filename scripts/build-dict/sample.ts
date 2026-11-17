// Muestra de búsquedas sobre el diccionario generado:
//   npm run sample:dict [-- --lang=es] [-- --ui=en] [palabra1 palabra2 ...]
import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { lookup, sourceFromJson, bestTranslation, type DictJson } from '../../src/lib/lookup.ts';
import { glossOrder, LANG_BADGE, uiLangsFor, type Lang, type TargetLang } from '../../src/lib/langs.ts';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
export function loadDict(lang: TargetLang = 'el'): DictJson {
  return JSON.parse(gunzipSync(readFileSync(join(ROOT, `public/dict/${lang}/dict.json.gz`))).toString('utf8'));
}

const DEFAULT: Record<TargetLang, string[]> = {
  el: [
    'έγραψα', 'γράφτηκε', 'σκονισμένα', 'δω', 'πιο', 'είναι', 'το', 'της', 'βουνά', 'παιδιά',
    'ήταν', 'πήγαμε', 'Ανεβήκαμε', 'καλύτερη', 'σπίτι', 'μας', 'είπε', 'θάλασσa', 'εγραψα', 'σ’',
  ],
  es: [
    'hablé', 'fue', 'casas', 'dámelo', 'diciéndole', 'vámonos', 'levantarse', 'tuviera', 'hiciese', 'niñas',
    'grande', 'mejor', 'fué', 'á', 'perro', 'libro', 'quiero', 'había', 'dijo', 'año',
  ],
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  const args = process.argv.slice(2);
  const lang = (args.find((a) => a.startsWith('--lang='))?.slice(7) ?? 'el') as TargetLang;
  const ui = (args.find((a) => a.startsWith('--ui='))?.slice(5) ?? uiLangsFor(lang)[0]) as Lang;
  const words = args.filter((a) => !a.startsWith('--'));
  const dict = loadDict(lang);
  const src = sourceFromJson(dict, ui);
  const order = glossOrder({ target: lang, ui });
  for (const w of words.length ? words : DEFAULT[lang]) {
    const t = performance.now();
    const r = await lookup(w, src);
    const ms = (performance.now() - t).toFixed(2);
    console.log(`\n${w}  (${ms} ms)`);
    if (!r.candidates.length) console.log('   — No está en el diccionario');
    for (const c of r.candidates) {
      const tr = bestTranslation(c, order);
      const trs = tr && tr.lang !== 'user' ? `${tr.lang === order[0] ? '' : `[${LANG_BADGE[tr.lang]}] `}${c.gloss[tr.lang]!.slice(0, 3).join('; ')}` : '—';
      const via = c.via !== 'exact' ? `  [${c.via}${c.clitics ? ': ' + c.clitics.join('+') : ''}]` : '';
      console.log(`   → ${c.lemma} (${c.pos ?? '?'})  ${c.analyses.join(' | ')}  ·  ${trs}${via}`);
    }
  }
}
