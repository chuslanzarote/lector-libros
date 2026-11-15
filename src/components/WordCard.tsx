// LEC-3 — Tarjeta al tocar una palabra: lema(s), análisis, acepciones, audio, estado y traducción propia.
import { useEffect, useRef, useState } from 'preact/hooks';
import { db, type Lexeme, type WordState } from '../db.ts';
import { lookupWithUser } from '../dict.ts';
import { useLive, useSettings } from '../hooks.ts';
import { bestTranslation, type Candidate } from '../lib/lookup.ts';
import { chooseLemma, deleteLexeme, saveLookup, setState, setUserTranslation, STATE_LABEL, updateLexeme } from '../lib/vocab.ts';
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
      if (settings.autoSpeak) speak(token);
      const c = r.candidates[0];
      if (!c) return;
      const prev = await db.lexemes.get(c.lemma);
      if (!prev || prev.state === 'new') {
        const tr = bestTranslation(c);
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
    const tr = bestTranslation(next);
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
      <div class="sheet" role="dialog" aria-label={`Palabra ${token}`}>
        <div class="grip" />
        <div class="wc-head">
          {c ? <span class="wc-lemma" lang="el">{c.lemma}</span> : <span class="wc-lemma" lang="el">{token}</span>}
          {c?.pos && <span class="wc-pos">{c.pos}</span>}
          <span class="spacer" />
          {ttsAvailable() && (
            <button class="icon-btn" aria-label="Escuchar" onClick={() => speak(token)}><IconSpeaker /></button>
          )}
          <button class="icon-btn" aria-label="Cerrar" onClick={onClose}><IconX /></button>
        </div>
        {c && c.lemma.toLowerCase() !== token.toLowerCase() && <div class="wc-form" lang="el">{token}</div>}

        {cands === null && <p class="muted">Buscando…</p>}

        {cands && cands.length > 1 && (
          <>
            <div class="tiny muted">Esta forma puede venir de varios lemas; elige el correcto:</div>
            <div class="cands" role="radiogroup">
              {cands.map((x, i) => (
                <button key={x.lemma} class={i === sel ? 'on' : ''} role="radio" aria-checked={i === sel} onClick={() => pickCandidate(i)} lang="el">
                  {x.lemma}
                </button>
              ))}
            </div>
          </>
        )}

        {c && c.analyses.length > 0 && (
          <div class="wc-analysis">{c.analyses.join(' · ')}{c.via === 'noAccent' ? ' · (sin acento)' : c.via === 'variant' ? ' · (ortografía antigua)' : ''}</div>
        )}

        {cands && cands.length === 0 && (
          <div>
            <p><strong>No está en el diccionario.</strong> Puedes añadir tu propia traducción.</p>
          </div>
        )}

        {c && (
          <ul class="senses">
            {c.user && (
              <li class={chosen === c.user ? 'on' : ''} onClick={() => pickSense(c.user!, 'user')}>
                <span class="lang user">TUYA</span><span>{c.user}</span>
              </li>
            )}
            {c.es.map((t, i) => (
              <li key={'es' + i} class={chosen === t ? 'on' : ''} onClick={() => pickSense(t, 'es')}>
                <span class="n">{i + 1}</span><span>{t}</span>
              </li>
            ))}
            {c.en.map((t, i) => (
              <li key={'en' + i} class={chosen === t ? 'on' : ''} onClick={() => pickSense(t, 'en')}>
                <span class="lang">EN</span><span>{t}</span>
              </li>
            ))}
            {!c.user && !c.es.length && !c.en.length && <li class="muted">Sin acepciones; añade la tuya.</li>}
          </ul>
        )}

        {(editing || (cands && cands.length === 0)) ? (
          <div class="row" style={{ marginBottom: 8 }}>
            <input
              type="text"
              value={own}
              placeholder={`Tu traducción de «${c?.lemma ?? token}»`}
              onInput={(e) => setOwn(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && saveOwn()}
              style={{ flex: 1, width: 'auto' }}
              autoFocus
            />
            <button class="btn primary" onClick={saveOwn}>Guardar</button>
          </div>
        ) : (
          <button class="btn small ghost" onClick={() => setEditing(true)}><IconEdit width={16} /> {userTr ? 'Editar mi traducción' : 'Añadir mi traducción'}</button>
        )}

        <div class="states" role="radiogroup" aria-label="Estado">
          {STATES.map((s) => {
            const on = (lex?.state ?? 'new') === s;
            return (
              <button key={s} class={`btn small ${s} ${on ? 'on' : ''}`} role="radio" aria-checked={on} onClick={() => changeState(s)}>
                {STATE_LABEL[s]}
              </button>
            );
          })}
        </div>

        <div class="row" style={{ marginTop: 12 }}>
          <button class="btn small" onClick={() => openExternal(translatorUrl(settings.translatorUrl, sentence.text))}>
            <IconExternal width={16} /> Traducir la frase
          </button>
          <button class="btn small" onClick={() => openExternal(wiktionaryUrl(c?.lemma ?? token))}>
            <IconLink width={16} /> Wiktionary
          </button>
          {ttsAvailable() && (
            <button class="btn small" onClick={() => speak(sentence.text)}><IconSpeaker width={16} /> Frase</button>
          )}
        </div>
      </div>
    </>
  );
}
