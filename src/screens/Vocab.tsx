// VOC-1 / VOC-3 — Lista de vocabulario editable y exportación a CSV para Anki.
import { useMemo, useState } from 'preact/hooks';
import { db, today, type Lexeme, type WordState } from '../db.ts';
import { toast, useLive } from '../hooks.ts';
import { deleteLexeme, setState, setUserTranslation, updateLexeme } from '../lib/vocab.ts';
import { vocabToCsv } from '../lib/anki.ts';
import { shareOrDownload, speak, ttsAvailable } from '../lib/platform.ts';
import { IconDownload, IconSpeaker, IconTrash } from '../components/icons.tsx';
import { LANG_BADGE } from '../lib/langs.ts';
import { profile } from '../profile.ts';
import { t, type MsgKey } from '../i18n/index.ts';

type Filter = WordState | 'all' | 'expr';
const FILTERS: Filter[] = ['learning', 'known', 'ignored', 'expr', 'all'];

export function Vocab() {
  const all = useLive(() => db.lexemes.orderBy('updatedAt').reverse().toArray(), []);
  const [filter, setFilter] = useState<Filter>('learning');
  const [q, setQ] = useState('');
  const [editing, setEditing] = useState<string | null>(null);

  const list = useMemo(() => {
    const nq = q.trim().toLowerCase();
    return (all ?? []).filter((x) => {
      if (filter === 'expr' ? !x.isExpression : filter !== 'all' && x.state !== filter) return false;
      if (!nq) return true;
      return x.lemma.toLowerCase().includes(nq) || (x.translation ?? '').toLowerCase().includes(nq) || (x.sourceForm ?? '').toLowerCase().includes(nq);
    });
  }, [all, filter, q]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: all?.length ?? 0, expr: 0, new: 0, learning: 0, known: 0, ignored: 0 };
    for (const x of all ?? []) { c[x.state]++; if (x.isExpression) c.expr++; }
    return c;
  }, [all]);

  const exportCsv = async () => {
    const items = (all ?? []).filter((x) => x.state === 'learning' || x.state === 'known');
    const csv = vocabToCsv(items, { deck: profile.target === 'el' ? 'elliniko' : 'espanol' });
    await shareOrDownload(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `${profile.target === 'el' ? 'elliniko' : 'espanol'}-${t('vocab.fileName')}-${today()}.csv`);
    toast(t('vocab.exported', { n: items.length }));
  };

  return (
    <>
      <header class="topbar">
        <h1>{t('tab.vocab')}</h1>
        <button class="btn small" onClick={exportCsv} disabled={!all?.length}><IconDownload width={18} /> {t('vocab.csv')}</button>
      </header>
      <main>
        <input type="search" placeholder={t('vocab.search')} value={q} onInput={(e) => setQ(e.currentTarget.value)} />
        <div class="row" style={{ margin: '10px 0' }}>
          {FILTERS.map((f) => (
            <button key={f} class={`btn small ${filter === f ? 'primary' : ''}`} onClick={() => setFilter(f)}>
              {t(`vocab.filter.${f}` as MsgKey)} <span class="muted tiny">{counts[f]}</span>
            </button>
          ))}
        </div>
        {all && !list.length && <div class="empty"><p>{t('vocab.empty')}</p></div>}
        {list.slice(0, 500).map((x) => (
          <VocabItem key={x.lemma} x={x} editing={editing === x.lemma} onEdit={() => setEditing(editing === x.lemma ? null : x.lemma)} />
        ))}
        {list.length > 500 && <p class="muted small">{t('vocab.showing', { n: list.length })}</p>}
      </main>
    </>
  );
}

function VocabItem({ x, editing, onEdit }: { x: Lexeme; editing: boolean; onEdit: () => void }) {
  const [tr, setTr] = useState(x.translation ?? '');
  const [notes, setNotes] = useState(x.notes ?? '');
  const save = async () => {
    await updateLexeme(db, x.lemma, { translation: tr.trim() || undefined, translationLang: tr.trim() !== x.translation ? 'user' : x.translationLang, notes: notes.trim() || undefined });
    if (tr.trim() && tr.trim() !== x.translation) await setUserTranslation(db, x.lemma, tr.trim(), x.isExpression);
    onEdit();
  };
  return (
    <div class="vocab-item">
      <span class={`dot ${x.state}`} title={t(`state.${x.state}` as MsgKey)} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div class="row" style={{ gap: 6 }}>
          <span class="lemma" lang={profile.target}>{x.lemma}</span>
          {x.sourceForm && x.sourceForm.toLowerCase() !== x.lemma.toLowerCase() && <span class="muted small" lang={profile.target}>({x.sourceForm})</span>}
          {x.translationLang && x.translationLang !== 'user' && x.translationLang !== profile.ui && <span class="lang">{LANG_BADGE[x.translationLang]}</span>}
          <span class="spacer" />
          {ttsAvailable() && <button class="icon-btn" aria-label={t('vocab.listen')} onClick={() => speak(x.lemma, profile.target)}><IconSpeaker width={18} /></button>}
        </div>
        {!editing && (
          <div onClick={onEdit} style={{ cursor: 'pointer' }}>
            <div>{x.translation ?? <span class="muted">{t('vocab.noTranslation')}</span>}</div>
            {x.notes && <div class="small muted"><i>{x.notes}</i></div>}
            {x.sourceSentence && <div class="ctx" lang={profile.target}>{x.sourceSentence}</div>}
          </div>
        )}
        {editing && (
          <div>
            <label class="field"><span>{t('vocab.translation')}</span><input type="text" value={tr} onInput={(e) => setTr(e.currentTarget.value)} /></label>
            <label class="field"><span>{t('vocab.notes')}</span><input type="text" value={notes} onInput={(e) => setNotes(e.currentTarget.value)} /></label>
            <div class="row">
              <select value={x.state} onChange={(e) => setState(db, x.lemma, e.currentTarget.value as WordState)} style={{ width: 'auto' }} aria-label={t('vocab.state')}>
                {(['new', 'learning', 'known', 'ignored'] as WordState[]).map((s) => <option value={s}>{t(`state.${s}` as MsgKey)}</option>)}
              </select>
              <button class="btn small danger" onClick={() => confirm(t('vocab.confirmDelete', { w: x.lemma })) && deleteLexeme(db, x.lemma)}><IconTrash width={16} /> {t('vocab.delete')}</button>
              <span class="spacer" />
              <button class="btn small ghost" onClick={onEdit}>{t('btn.cancel')}</button>
              <button class="btn small primary" onClick={save}>{t('btn.save')}</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
