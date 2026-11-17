// VOC-2 — Repaso diario FSRS con la frase original del libro como contexto.
import { useEffect, useState } from 'preact/hooks';
import { db, bumpActivity, type CardRow, type Lexeme } from '../db.ts';
import { useLive } from '../hooks.ts';
import { previewIntervals, reviewCard, type Grade } from '../lib/srs.ts';
import { setState } from '../lib/vocab.ts';
import { speak, ttsAvailable } from '../lib/platform.ts';
import { IconSpeaker } from '../components/icons.tsx';
import { LANG_BADGE } from '../lib/langs.ts';
import { profile } from '../profile.ts';
import { fmtDate, t, tt, uiLang, type MsgKey } from '../i18n/index.ts';

const GRADES: [Grade, MsgKey][] = [[1, 'review.again'], [2, 'review.hard'], [3, 'review.good'], [4, 'review.easy']];
const SESSION_MAX = 50;

function highlight(sentence: string, form?: string) {
  if (!form) return <>{sentence}</>;
  const i = sentence.toLowerCase().indexOf(form.toLowerCase());
  if (i < 0) return <>{sentence}</>;
  return <>{sentence.slice(0, i)}<b>{sentence.slice(i, i + form.length)}</b>{sentence.slice(i + form.length)}</>;
}

export function Review() {
  const [now] = useState(() => Date.now());
  const due = useLive(() => db.cards.where('dueAt').belowOrEqual(now).limit(SESSION_MAX).toArray(), [now]);
  const total = useLive(() => db.cards.count(), []);
  const next = useLive(() => db.cards.orderBy('dueAt').first(), []);
  const [queue, setQueue] = useState<CardRow[] | null>(null);
  const [lex, setLex] = useState<Lexeme | undefined>();
  const [shown, setShown] = useState(false);
  const [intervals, setIntervals] = useState<Record<Grade, string> | null>(null);
  const [done, setDone] = useState(0);

  useEffect(() => {
    if (due && queue === null) setQueue(due);
  }, [due]);

  const card = queue?.[0];
  useEffect(() => {
    setShown(false);
    setIntervals(null);
    if (!card) return;
    db.lexemes.get(card.lemma).then(setLex);
    previewIntervals(card, new Date(), uiLang()).then(setIntervals);
  }, [card?.id, card?.updatedAt]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!card) return;
      if (!shown && (e.key === ' ' || e.key === 'Enter')) { e.preventDefault(); setShown(true); }
      else if (shown && ['1', '2', '3', '4'].includes(e.key)) grade(Number(e.key) as Grade);
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  });

  const grade = async (g: Grade) => {
    if (!card || !queue) return;
    const updated = await reviewCard(card, g);
    await db.cards.put(updated);
    await bumpActivity('reviews');
    setDone((d) => d + 1);
    // Si vuelve a vencer en esta sesión (pasos de aprendizaje cortos), se reencola al final
    const rest = queue.slice(1);
    setQueue(updated.dueAt <= Date.now() + 10 * 60_000 && g === 1 ? [...rest, updated] : rest);
  };

  const markKnown = async () => {
    if (!card || !queue) return;
    await setState(db, card.lemma, 'known');
    await db.cards.delete(card.id);
    setQueue(queue.slice(1));
  };

  return (
    <>
      <header class="topbar">
        <h1>{t('tab.review')}</h1>
        {queue && <span class="muted small">{t('review.counter', { done, left: queue.length })}</span>}
      </header>
      <main>
        {queue === null && <p class="muted">{t('loading')}</p>}
        {queue && !card && (
          <div class="empty">
            <div class="big">{tt('review.bravo')}</div>
            <p>{done ? t('review.reviewed', { n: done }) : t('review.none')}</p>
            <p class="muted small">
              {total ? t('review.total', { n: total }) : t('review.howTo')}
              {next && next.dueAt > Date.now() && t('review.nextDue', { when: fmtDate(next.dueAt, { weekday: 'short', hour: '2-digit', minute: '2-digit' }) })}
            </p>
          </div>
        )}
        {card && (
          <div class="card review-card">
            {card.sentence || lex?.sourceSentence ? (
              <p class="ctx" lang={profile.target}>{highlight(card.sentence ?? lex!.sourceSentence!, lex?.sourceForm)}</p>
            ) : null}
            <div class="lemma" lang={profile.target}>{card.lemma}</div>
            {ttsAvailable() && (
              <button class="btn small ghost" onClick={() => speak(card.sentence ?? card.lemma, profile.target)}><IconSpeaker width={16} /> {t('review.listen')}</button>
            )}
            {shown ? (
              <>
                <div class="answer">{lex?.translation ?? <span class="muted">{t('review.noTranslation')}</span>}{lex?.translationLang && lex.translationLang !== 'user' && lex.translationLang !== profile.ui && <> <span class="lang">{LANG_BADGE[lex.translationLang]}</span></>}</div>
                {lex?.notes && <div class="small muted"><i>{lex.notes}</i></div>}
                <div class="grades">
                  {GRADES.map(([g, label]) => (
                    <button key={g} class={`btn ${g === 3 ? 'primary' : ''}`} onClick={() => grade(g)}>
                      {t(label)}
                      <small style={g === 3 ? { color: 'inherit', opacity: 0.8 } : undefined}>{intervals?.[g] ?? ''}</small>
                    </button>
                  ))}
                </div>
                <button class="btn small ghost" style={{ marginTop: 12 }} onClick={markKnown}>{t('review.knowIt')}</button>
              </>
            ) : (
              <div style={{ marginTop: 20 }}>
                <button class="btn primary" onClick={() => setShown(true)}>{t('review.show')}</button>
              </div>
            )}
          </div>
        )}
      </main>
    </>
  );
}
