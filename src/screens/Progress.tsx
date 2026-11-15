// PRO-1 — Panel de progreso: palabras conocidas, racha, actividad y cobertura por libro.
import { db, today } from '../db.ts';
import { useLive } from '../hooks.ts';
import { bookCoverage, coverageLabel, streak } from '../lib/progress.ts';
import { useLexemeStates } from './Library.tsx';

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
      <header class="topbar"><h1>Progreso</h1></header>
      <main>
        <div class="stats">
          <div class="stat"><div class="v">{count('known')}</div><div class="k">palabras conocidas</div></div>
          <div class="stat"><div class="v">{count('learning')}</div><div class="k">aprendiendo</div></div>
          <div class="stat"><div class="v">{activity ? streak(activity) : 0}</div><div class="k">días de racha</div></div>
          <div class="stat"><div class="v">{due ?? 0}</div><div class="k">tarjetas pendientes</div></div>
        </div>

        <div class="section-title">Últimos 30 días</div>
        <div class="card">
          <div class="bars" aria-label="Actividad diaria">
            {days.map((d) => (
              <i key={d.day} class={d.n ? '' : 'zero'} style={{ height: `${(d.n / max) * 100}%` }} title={`${d.day}: ${d.n}`} />
            ))}
          </div>
          <div class="small muted" style={{ marginTop: 8 }}>
            Hoy: {todayRow?.lookups ?? 0} consultas · {todayRow?.reviews ?? 0} repasos
          </div>
        </div>

        <div class="section-title">Cobertura por libro</div>
        {!books?.length && <p class="muted">Importa un libro para ver su cobertura.</p>}
        {books?.map((b) => {
          const c = states ? bookCoverage(b.vocab, (k) => states.get(k)) : null;
          if (!c) return null;
          const l = coverageLabel(c.known);
          return (
            <div class="card" key={b.id}>
              <div class="row">
                <strong class="spacer" lang="el">{b.title}</strong>
                <span class={`pill ${l.level}`}>{l.text}</span>
              </div>
              <div class="meter">
                <i class="learning" style={{ width: `${c.withLearning * 100}%` }} />
                <i style={{ width: `${c.known * 100}%` }} />
              </div>
              <div class="tiny muted" style={{ marginTop: 6 }}>
                {Math.round(c.withLearning * 100)} % contando las que aprendes · {c.total.toLocaleString('es')} palabras ·{' '}
                {b.initialCoverage !== undefined && `al importar: ${Math.round(b.initialCoverage * 100)} %`}
              </div>
            </div>
          );
        })}
      </main>
    </>
  );
}
