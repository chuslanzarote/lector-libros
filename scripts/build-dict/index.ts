// DIC-1 / DIC-7 — Genera public/dict/<lang>/dict.json.gz a partir de fuentes abiertas fijadas.
// Uso: npm run build:dict [-- --lang=el|es|all] [-- --accept-new]
import { statSync } from 'node:fs';
import { join } from 'node:path';
import { ensureSources, readSources, ROOT } from './builder.ts';
import { buildGreek } from './el.ts';
import { buildSpanish } from './es.ts';
import type { TargetLang } from '../../src/lib/langs.ts';

const MAX_BYTES = 20 * 1024 * 1024;
const ACCEPT_NEW = process.argv.includes('--accept-new');
const arg = process.argv.find((a) => a.startsWith('--lang='))?.slice(7) ?? 'all';
const langs: TargetLang[] = arg === 'all' ? ['el', 'es'] : [arg as TargetLang];

/** La versión depende sólo de las fuentes, para que el build sea reproducible */
const VERSION_SOURCE: Record<TargetLang, string> = { el: 'wiktextract-el', es: 'wiktextract-es' };

async function main() {
  for (const lang of langs) {
    const t0 = Date.now();
    console.log(`\n=== Diccionario ${lang}\n1. Fuentes`);
    const paths = await ensureSources(lang, ACCEPT_NEW);
    const b = lang === 'el' ? await buildGreek(paths) : await buildSpanish(paths);
    const sources = readSources().sources.filter((s) => s.langs.includes(lang));
    const version = sources.find((s) => s.id === VERSION_SOURCE[lang])!.version.replaceAll('-', '.');
    console.log('5. Salida');
    const manifest = b.write(version, MAX_BYTES, sources);
    const size = statSync(join(ROOT, 'public', 'dict', lang, 'dict.json.gz')).size;
    console.log(`Hecho en ${((Date.now() - t0) / 1000).toFixed(0)} s →`, manifest.counts, `${(size / 1048576).toFixed(1)} MB`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
