// IDI-1 — Pantalla de inicio: idioma que aprendes + tu idioma. También sirve para cambiarlos (#/idiomas).
import { Wordmark } from '../components/Logo.tsx';
import { useState } from 'preact/hooks';
import { setUiLang, t } from '../i18n/index.ts';
import { ENDONYM, TARGETS, uiLangsFor, type Lang, type Profile, type TargetLang } from '../lib/langs.ts';
import { browserLang, saveProfile } from '../profile.ts';
import { go } from '../hooks.ts';

/** Elección inicial razonable según el idioma del navegador */
function guess(): { target: TargetLang | null; ui: Lang | null } {
  const b = browserLang();
  if (b === 'el') return { target: 'es', ui: 'el' };
  if (b === 'es') return { target: 'el', ui: 'es' };
  return { target: null, ui: 'en' };
}

export function Welcome({ current }: { current?: Profile }) {
  const init = current ?? guess();
  const [target, setTarget] = useState<TargetLang | null>(init.target);
  const [ui, setUi] = useState<Lang | null>(init.ui);
  const [, rerender] = useState(0);

  const pickUi = (l: Lang) => {
    setUi(l);
    setUiLang(l); // la pantalla cambia de idioma al vuelo
    rerender((n) => n + 1);
  };

  const pickTarget = (l: TargetLang) => {
    setTarget(l);
    // nunca el mismo idioma en los dos lados
    if (ui === l) {
      const next = uiLangsFor(l).find((x) => x === browserLang()) ?? uiLangsFor(l).find((x) => x !== 'en') ?? 'en';
      pickUi(next);
    }
  };

  const start = () => {
    if (!target || !ui) return;
    if (current && current.target === target && current.ui === ui) return go('/');
    saveProfile({ target, ui });
  };

  return (
    <div class="welcome">
      <div class="logo"><Wordmark size={40} /></div>
      <h1>{t('welcome.title')}</h1>
      <p class="muted">{t('welcome.subtitle')}</p>

      <h2>{t('welcome.learn')}</h2>
      <div class="choices" role="radiogroup" aria-label={t('welcome.learn')}>
        {TARGETS.map((l) => (
          <button key={l} class={`choice ${target === l ? 'on' : ''}`} role="radio" aria-checked={target === l} onClick={() => pickTarget(l)}>
            <span class="name" lang={l}>{ENDONYM[l]}</span>
            <span class="desc">{t(`welcome.learn.${l}`)}</span>
          </button>
        ))}
      </div>

      <h2>{t('welcome.native')}</h2>
      <div class="seg" role="radiogroup" aria-label={t('welcome.native')}>
        {(['es', 'el', 'en'] as Lang[]).map((l) => (
          <button key={l} class={ui === l ? 'on' : ''} role="radio" aria-checked={ui === l} disabled={l === target} onClick={() => pickUi(l)} lang={l}>
            {ENDONYM[l]}
          </button>
        ))}
      </div>

      <div style={{ marginTop: 28 }}>
        <button class="btn primary" disabled={!target || !ui} onClick={start}>{t('welcome.start')}</button>
      </div>
      <p class="muted tiny" style={{ marginTop: 16 }}>{t('welcome.later')}</p>
    </div>
  );
}
