// LEC-3 — Tarjeta al tocar una palabra: lema(s), análisis, acepciones, audio, estado y traducción propia.
import { useEffect, useRef, useState } from 'preact/hooks';
import { db, type Lexeme, type WordState } from '../db.ts';
import { lookupWithUser } from '../dict.ts';
import { useLive, useSettings } from '../hooks.ts';
import { bestTranslation, type Candidate } from '../lib/lookup.ts';
import { chooseLemma, deleteLexeme, saveLookup, setState, setUserTranslation, updateLexeme } from '../lib/vocab.ts';
import { glossOrder, LANG_BADGE } from '../lib/langs.ts';
import { profile } from '../profile.ts';
import { t } from '../i18n/index.ts';
import { openExternal, speak, translatorUrl, ttsAvailable, wiktionaryUrl } from '../lib/platform.ts';
import { IconEdit, IconExternal, IconLink, IconSpeaker, IconX } from './icons.tsx';

export interface WordCardProps {
  token: string;
  formKey: string;
  sentence: { id: string; text: string };
  bookId?: string;
  onClose: () => void;
}

const STATES: WordState[] = ['new', 'learning', 'known', 'ignored'];
const ORDER = glossOrder(profile);
const L = profile.target;

export function WordCard({ token, formKey, sentence, bookId, onClose }: WordCardProps) {
  const [settings] = useSettings();
  const [cands, setCands] = useState<Candidate[] | null>(null);
  const [sel, setSel] = useState(0);
  const [editing, setEditing] = useState(false);
  const [own, setOwn] = useState('');
  const autoCreated = useRef<string | null>(null);

  const lemma = cands?.[sel]?.lemma ?? formKey;
  const lex = useLive(() => db.lexemes.get(lemma), [lemma]);
  const userTr = useLive(() => db.userDict.get(lemma), [lemma]);

  const reload = async () => {
    const r = await lookupWithUser(token);
    setCands(r.candidates);
    return r;
  };

  // Al abrir: buscar y pasar la palabra a «aprendiendo» con la mejor traducción (LEC-3)
  useEffect(() => {
    let alive = true;
    (async () => {
      const r = await reload();
      if (!alive) return;
      setSel(0);
      if (settings.autoSpeak) speak(token, L);
      const c = r.candidates[0];
      if (!c) return;
      const prev = await db.lexemes.get(c.lemma);
      if (!prev || prev.state === 'new') {
        const tr = bestTranslation(c, ORDER);
        if (!prev) autoCreated.current = c.lemma;
        await saveLookup(db, { lemma: c.lemma, form: token, translation: tr?.text, translationLang: tr?.lang, sentence: { ...sentence, bookId } });
      }
    })();
    return () => { alive = false; };
  }, [token, sentence.id]);

  useEffect(() => setOwn(userTr?.translation ?? ''), [userTr?.translation, lemma]);

  const pickCandidate = async (i: number) => {
    if (!cands || i === sel) return;
    const prevLemma = cands[sel].lemma;
    const next = cands[i];
    setSel(i);
    await chooseLemma(db, formKey, next.lemma);
    // Si la elección automática anterior acaba de crearse, se deshace
    if (autoCreated.current === prevLemma) {
      const l = await db.lexemes.get(prevLemma);
      if (l?.state === 'learning') await deleteLexeme(db, prevLemma);
      autoCreated.current = null;
    }
    const existing = await db.lexemes.get(next.lemma);
    if (!existing) autoCreated.current = next.lemma;
    const tr = bestTranslation(next, ORDER);
    await saveLookup(db, { lemma: next.lemma, form: token, translation: existing?.translation ?? tr?.text, translationLang: existing?.translationLang ?? tr?.lang, sentence: { ...sentence, bookId } });
  };

  const pickSense = async (text: string, lang: Lexeme['translationLang']) => {
    autoCreated.current = null;
    if (!lex) await saveLookup(db, { lemma, form: token, translation: text, translationLang: lang, sentence: { ...sentence, bookId } });
    else await updateLexeme(db, lemma, { translation: text, translationLang: lang });
  };

  const saveOwn = async () => {
    const t = own.trim();
    await setUserTranslation(db, lemma, t);
    autoCreated.current = null;
    if (t) {
      if (lex) await updateLexeme(db, lemma, { translation: t, translationLang: 'user' });
      else await saveLookup(db, { lemma, form: token, translation: t, translationLang: 'user', sentence: { ...sentence, bookId } });
    }
    setEditing(false);
    await reload();
  };

  const changeState = async (s: WordState) => {
    autoCreated.current = null;
    await setState(db, lemma, s, lex ? {} : { sourceForm: token, sourceSentence: sentence.text, sourceSentenceId: sentence.id, sourceBookId: bookId });
  };

  const c = cands?.[sel];
  const chosen = lex?.translation;

  return (
    <>
      <div class="sheet-backdrop" onClick={onClose} />
      <div class="sheet" role="dialog" aria-label={t('word.aria', { w: token })}>
        <div class="grip" />
        <div class="wc-head">
          <span class="wc-lemma" lang={L}>{c ? c.lemma : token}</span>
          {c?.pos && <span class="wc-pos">{c.pos}</span>}
          <span class="spacer" />
          {ttsAvailable() && (
            <button class="icon-btn" aria-label={t('word.listen')} onClick={() => speak(token, L)}><IconSpeaker /></button>
          )}
          <button class="icon-btn" aria-label={t('btn.close')} onClick={onClose}><IconX /></button>
        </div>
        {c && c.lemma.toLowerCase() !== token.toLowerCase() && <div class="wc-form" lang={L}>{token}</div>}

        {cands === null && <p class="muted">{t('word.searching')}</p>}

        {cands && cands.length > 1 && (
          <>
            <div class="tiny muted">{t('word.ambiguous')}</div>
            <div class="cands" role="radiogroup">
              {cands.map((x, i) => (
                <button key={x.lemma} class={i === sel ? 'on' : ''} role="radio" aria-checked={i === sel} onClick={() => pickCandidate(i)} lang={L}>
                  {x.lemma}
                </button>
              ))}
            </div>
          </>
        )}

        {c && (c.analyses.length > 0 || c.clitics) && (
          <div class="wc-analysis">
            {[
              ...c.analyses,
              ...(c.clitics ? [t('word.clitic', { list: c.clitics.join(', ') })] : []),
              ...(c.via === 'noAccent' ? [t('word.noAccent')] : c.via === 'variant' ? [t('word.variant')] : []),
            ].join(' · ')}
          </div>
        )}

        {cands && cands.length === 0 && (
          <div>
            <p><strong>{t('word.notFound')}</strong> {t('word.addOwnHint')}</p>
          </div>
        )}

        {c && (
          <ul class="senses">
            {c.user && (
              <li class={chosen === c.user ? 'on' : ''} onClick={() => pickSense(c.user!, 'user')}>
                <span class="lang user">{t('lang.user')}</span><span>{c.user}</span>
              </li>
            )}
            {ORDER.map((lang, li) =>
              (c.gloss[lang] ?? []).map((g, i) => (
                <li key={lang + i} class={chosen === g ? 'on' : ''} onClick={() => pickSense(g, lang)} lang={lang}>
                  {li === 0 ? <span class="n">{i + 1}</span> : <span class="lang">{LANG_BADGE[lang]}</span>}
                  <span>{g}</span>
                </li>
              )),
            )}
            {!c.user && !ORDER.some((l) => c.gloss[l]?.length) && <li class="muted">{t('word.noSenses')}</li>}
          </ul>
        )}

        {(editing || (cands && cands.length === 0)) ? (
          <div class="row" style={{ marginBottom: 8 }}>
            <input
              type="text"
              value={own}
              placeholder={t('word.ownPlaceholder', { w: c?.lemma ?? token })}
              onInput={(e) => setOwn(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveOwn()}
              style={{ flex: 1, width: 'auto' }}
              autoFocus
            />
            <button class="btn primary" onClick={saveOwn}>{t('btn.save')}</button>
          </div>
        ) : (
          <button class="btn small ghost" onClick={() => setEditing(true)}><IconEdit width={16} /> {userTr ? t('word.editOwn') : t('word.addOwn')}</button>
        )}

        <div class="states" role="radiogroup" aria-label={t('word.state')}>
          {STATES.map((s) => {
            const on = (lex?.state ?? 'new') === s;
            return (
              <button key={s} class={`btn small ${s} ${on ? 'on' : ''}`} role="radio" aria-checked={on} onClick={() => changeState(s)}>
                {t(`state.${s}`)}
              </button>
            );
          })}
        </div>

        <div class="row" style={{ marginTop: 12 }}>
          <button class="btn small" onClick={() => openExternal(translatorUrl(settings.translatorUrl, sentence.text))}>
            <IconExternal width={16} /> {t('word.translateSentence')}
          </button>
          <button class="btn small" onClick={() => openExternal(wiktionaryUrl(c?.lemma ?? token, L))}>
            <IconLink width={16} /> Wiktionary
          </button>
          {ttsAvailable() && (
            <button class="btn small" onClick={() => speak(sentence.text, L)}><IconSpeaker width={16} /> {t('word.sentence')}</button>
          )}
        </div>
      </div>
    </>
  );
}
