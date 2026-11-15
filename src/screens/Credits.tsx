// Créditos y atribución CC BY-SA del diccionario (DIC-1, paso 7).
import { IconBack } from '../components/icons.tsx';
import { go } from '../hooks.ts';

export function Credits() {
  return (
    <>
      <header class="topbar">
        <button class="icon-btn" aria-label="Volver" onClick={() => go('/ajustes')}><IconBack /></button>
        <h1>Créditos</h1>
      </header>
      <main class="prose">
        <p>
          El diccionario de Ellinikó se genera a partir de fuentes abiertas, todas derivadas de{' '}
          <a href="https://en.wiktionary.org" target="_blank" rel="noopener">Wiktionary</a>. Gracias a sus editores.
        </p>
        <ul>
          <li>
            <strong>Wiktextract / kaikki.org</strong> — formas flexionadas, análisis y glosas en inglés. Tatu Ylonen,
            «Wiktextract: Wiktionary as Machine-Readable Structured Data», LREC 2022.{' '}
            <a href="https://kaikki.org/dictionary/Greek/" target="_blank" rel="noopener">kaikki.org</a>. Contenido de
            Wiktionary bajo <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener">CC BY-SA 4.0</a> y GFDL.
          </li>
          <li>
            <strong>FreeDict griego→español</strong> (2023.05.29) y <strong>griego→inglés</strong> (2025.11.23) —{' '}
            <a href="https://freedict.org" target="_blank" rel="noopener">freedict.org</a>, derivados de Wiktionary,{' '}
            <a href="https://creativecommons.org/licenses/by-sa/3.0/" target="_blank" rel="noopener">CC BY-SA 3.0</a>.
          </li>
          <li>
            <strong>FrequencyWords</strong> (OpenSubtitles 2018), Hermit Dave —{' '}
            <a href="https://github.com/hermitdave/FrequencyWords" target="_blank" rel="noopener">GitHub</a>, CC BY-SA 4.0.
            Sólo se usa al generar el diccionario para ordenar lemas ambiguos.
          </li>
        </ul>
        <p>
          El diccionario resultante (<code>dict/dict.json.gz</code>) es una obra derivada y se distribuye bajo{' '}
          <strong>CC BY-SA 4.0</strong>. Puedes descargarlo, modificarlo y redistribuirlo con la misma licencia y esta atribución.
        </p>
        <p>
          Texto de ejemplo: <em>Τα ψηλά βουνά</em>, Zacharias Papantoniou (1918), dominio público; transcripción de{' '}
          <a href="https://el.wikisource.org/wiki/Τα_ψηλά_βουνά" target="_blank" rel="noopener">el.wikisource.org</a>.
        </p>
        <p class="muted small">
          Software: Preact, Dexie, JSZip, ts-fsrs, Vite y vite-plugin-pwa (licencias MIT/Apache-2.0). Ellinikó no envía
          ningún dato a ningún servidor; la única conexión externa es abrir una frase en el traductor que elijas.
        </p>
      </main>
    </>
  );
}
