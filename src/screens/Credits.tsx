// Créditos y atribución CC BY-SA del diccionario (DIC-1, paso 7; DIC-7 para español).
import { Fragment, type ComponentChildren } from 'preact';
import { IconBack } from '../components/icons.tsx';
import { go } from '../hooks.ts';
import { profile } from '../profile.ts';
import { t, tt } from '../i18n/index.ts';

type Part = () => ComponentChildren;

const ext = (href: string, text: ComponentChildren) => <a href={href} target="_blank" rel="noopener">{text}</a>;

const LINKS: Record<string, Part> = {
  wiktionary: () => ext('https://en.wiktionary.org', 'Wiktionary'),
  kaikkiEl: () => ext('https://kaikki.org/dictionary/Greek/', 'kaikki.org'),
  kaikkiEs: () => ext('https://kaikki.org/dictionary/Spanish/', 'kaikki.org'),
  kaikkiElwikt: () => ext('https://kaikki.org/elwiktionary/Spanish/', 'kaikki.org'),
  kaikkiEswikt: () => ext('https://kaikki.org/eswiktionary/Espa%C3%B1ol/', 'kaikki.org'),
  freedict: () => ext('https://freedict.org', 'freedict.org'),
  ccbysa4: () => ext('https://creativecommons.org/licenses/by-sa/4.0/', 'CC BY-SA 4.0'),
  ccbysa3: () => ext('https://creativecommons.org/licenses/by-sa/3.0/', 'CC BY-SA 3.0'),
  github: () => ext('https://github.com/hermitdave/FrequencyWords', 'GitHub'),
  gutenberg: () => ext('https://www.gutenberg.org', 'Project Gutenberg'),
};

/** Sustituye **negrita** y {enlace} de un mensaje por JSX. */
function rich(s: string, parts: Record<string, Part> = LINKS): ComponentChildren[] {
  return s.split(/(\*\*[^*]+\*\*|\{\w+\})/).map((p, i) => {
    if (p.startsWith('**') && p.endsWith('**')) return <strong key={i}>{p.slice(2, -2)}</strong>;
    const m = /^\{(\w+)\}$/.exec(p);
    return <Fragment key={i}>{m && m[1] in parts ? parts[m[1]]() : p}</Fragment>;
  });
}

/** Número de fuentes del diccionario por idioma de estudio (claves credits.srcN.<target>) */
const SOURCES = { el: 3, es: 6 } as const;

export function Credits() {
  const target = profile.target;
  const wikisource: Part = () => target === 'el'
    ? ext('https://el.wikisource.org', 'Βικιθήκη')
    : ext('https://es.wikisource.org', 'Wikisource');
  return (
    <>
      <header class="topbar">
        <button class="icon-btn" aria-label={t('btn.back')} onClick={() => go('/ajustes')}><IconBack /></button>
        <h1>{t('credits.title')}</h1>
      </header>
      <main class="prose">
        <p>{rich(t('credits.intro'))}</p>
        <ul>
          {Array.from({ length: SOURCES[target] }, (_, i) => (
            <li key={i}>{rich(tt(`credits.src${i + 1}`))}</li>
          ))}
        </ul>
        <p>{rich(t('credits.result'), { file: () => <code>{`dict/${target}/dict.json.gz`}</code> })}</p>
        {target === 'el' && (
          <p>
            {rich(t('credits.sample'), {
              book: () => <em lang="el">Τα ψηλά βουνά</em>,
              source: () => ext('https://el.wikisource.org/wiki/Τα_ψηλά_βουνά', 'el.wikisource.org'),
            })}
          </p>
        )}
        <p>{rich(t('credits.catalog'), { wikisource, gutenberg: LINKS.gutenberg })}</p>
        <p class="muted small">{t('credits.software')}</p>
      </main>
    </>
  );
}
