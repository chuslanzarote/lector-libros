// PRO-1 — Panel de progreso: palabras conocidas, racha, actividad y cobertura por libro.
import { db, today } from '../db.ts';
import { useLive } from '../hooks.ts';
import { bookCoverage, coverageLabel, streak } from '../lib/progress.ts';
import { useLexemeStates } from './Library.tsx';
import { profile } from '../profile.ts';
import { fmtNum, t, type MsgKey } from '../i18n/index.ts';

export function Progress() {
  const states = useLexemeStates();
  const activity = useLive(() => db.activity.toArray(), []);
  const books = useLive(() => db.books.toArray(), []);
  const due = useLive(() => db.cards.where('dueAt').belowOrEqual(Date.now()).count(), []);

  const count = (s: string) => [...(states?.values() ?? [])].filter((x) => x === s).length;
  const days: { day: string; n: number }[] = [];
  const byDay = new Map((activity ?? []).map((a) => [a.day, a.lookups + a.reviews]));
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = today(d);
    days.push({ day: k, n: byDay.get(k) ?? 0 });
  }
  const max = Math.max(1, ...days.map((d) => d.n));
  const todayRow = activity?.find((a) => a.day === today());

  return (
    <>
      <header class="topbar"><h1>{t('tab.progress')}</h1></header>
      <main>
        <div class="stats">
          <div class="stat"><div class="v">{fmtNum(count('known'))}</div><div class="k">{t('progress.known')}</div></div>
          <div class="stat"><div class="v">{fmtNum(count('learning'))}</div><div class="k">{t('progress.learning')}</div></div>
          <div class="stat"><div class="v">{fmtNum(activity ? streak(activity) : 0)}</div><div class="k">{t('progress.streak')}</div></div>
          <div class="stat"><div class="v">{fmtNum(due ?? 0)}</div><div class="k">{t('progress.due')}</div></div>
        </div>

        <div class="section-title">{t('progress.last30')}</div>
        <div class="card">
          <div class="bars" aria-label={t('progress.activity')}>
            {days.map((d) => (
              <i key={d.day} class={d.n ? '' : 'zero'} style={{ height: `${(d.n / max) * 100}%` }} title={`${d.day}: ${d.n}`} />
            ))}
          </div>
          <div class="small muted" style={{ marginTop: 8 }}>
            {t('progress.today', { lookups: todayRow?.lookups ?? 0, reviews: todayRow?.reviews ?? 0 })}
          </div>
        </div>

        <div class="section-title">{t('progress.coverage')}</div>
        {!books?.length && <p class="muted">{t('progress.noBooks')}</p>}
        {books?.map((b) => {
          const c = states ? bookCoverage(b.vocab, (k) => states.get(k)) : null;
          if (!c) return null;
          const l = coverageLabel(c.known);
          return (
            <div class="card" key={b.id}>
              <div class="row">
                <strong class="spacer" lang={profile.target}>{b.title}</strong>
                <span class={`pill ${l.level}`}>{t(`coverage.${l.level}` as MsgKey, { pct: l.pct })}</span>
              </div>
              <div class="meter">
                <i class="learning" style={{ width: `${c.withLearning * 100}%` }} />
                <i style={{ width: `${c.known * 100}%` }} />
              </div>
              <div class="tiny muted" style={{ marginTop: 6 }}>
                {t('progress.withLearning', { pct: Math.round(c.withLearning * 100) })} · {t('progress.words', { n: c.total })} ·{' '}
                {b.initialCoverage !== undefined && t('progress.initial', { pct: Math.round(b.initialCoverage * 100) })}
              </div>
            </div>
          );
        })}
      </main>
    </>
  );
}
