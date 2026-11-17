// Biblioteca: libros con cobertura (PRO-1/PRO-2) e importación (IMP-1, IMP-2).
import { useState } from 'preact/hooks';
import { Fragment } from 'preact';
import { db, type Book, type WordState } from '../db.ts';
import { toast, useLive } from '../hooks.ts';
import { source } from '../dict.ts';
import { parseEpub } from '../lib/epub.ts';
import { decodeText, rawBookToRecords, saveImport, textToRawBook } from '../lib/importer.ts';
import { bookCoverage, coverageLabel } from '../lib/progress.ts';
import { pickFile } from '../lib/platform.ts';
import { sampleBook } from '../samples/psilaVouna.ts';
import { IconTrash, IconUpload, IconEdit, IconBook } from '../components/icons.tsx';
import type { RawBook } from '../lib/epub.ts';
import { profile } from '../profile.ts';
import { t, tt } from '../i18n/index.ts';
import { TARGET_INFO } from '../lib/langs.ts';

/** Dónde encontrar textos libres en el idioma que se aprende */
const FREE_TEXTS: Record<'el' | 'es', [string, string][]> = {
  el: [
    ['ebooks4greeks.gr', 'https://www.ebooks4greeks.gr'],
    ['openbook.gr', 'https://www.openbook.gr'],
    ['Gutenberg', 'https://www.gutenberg.org/browse/languages/el'],
    ['el.wikisource', 'https://el.wikisource.org'],
  ],
  es: [
    ['Biblioteca Virtual Miguel de Cervantes', 'https://www.cervantesvirtual.com'],
    ['Gutenberg', 'https://www.gutenberg.org/browse/languages/es'],
    ['es.wikisource', 'https://es.wikisource.org'],
  ],
};

/** Títulos de capítulo genéricos al trocear un TXT, en el idioma del usuario */
function chapterLabels() {
  return { start: t('chapter.start'), part: (n: number) => t('chapter.part', { n }) };
}

export function useLexemeStates(): Map<string, WordState> | undefined {
  return useLive(async () => {
    const m = new Map<string, WordState>();
    await db.lexemes.each((l) => m.set(l.lemma, l.state));
    return m;
  }, []);
}

export async function importRaw(raw: RawBook, kind: Book['source'], catalogId?: string) {
  const choices = new Map((await db.formChoices.toArray()).map((c) => [c.form, c.lemma]));
  const rec = await rawBookToRecords(raw, kind, source(), choices, profile.target);
  // PRO-2: cobertura previa con lo que ya conoces
  const states = new Map<string, WordState>();
  await db.lexemes.each((l) => states.set(l.lemma, l.state));
  rec.book.initialCoverage = bookCoverage(rec.book.vocab, (k) => states.get(k)).known;
  if (catalogId) rec.book.catalogId = catalogId;
  await saveImport(db, rec);
  return rec.book;
}

export function Library({ update, onUpdate }: { update?: string; onUpdate: () => void }) {
  const books = useLive(() => db.books.orderBy('updatedAt').reverse().toArray(), []);
  const states = useLexemeStates();
  const [busy, setBusy] = useState<string | null>(null);
  const [paste, setPaste] = useState(false);

  const run = async (label: string, fn: () => Promise<Book | null>) => {
    setBusy(label);
    try {
      const b = await fn();
      if (b) {
        const pct = Math.round((b.initialCoverage ?? 0) * 100);
        toast(t('library.imported', { title: b.title, chapters: b.chapterCount, pct }), 4000);
      }
    } catch (e) {
      toast(t('library.importError', { msg: (e as Error).message }), 5000);
    } finally {
      setBusy(null);
    }
  };

  const importFile = () =>
    run(t('library.importing'), async () => {
      const f = await pickFile('.epub,.txt,application/epub+zip,text/plain');
      if (!f) return null;
      const buf = await f.arrayBuffer();
      const isEpub = /\.epub$/i.test(f.name) || f.type === 'application/epub+zip';
      const raw = isEpub ? await parseEpub(buf) : textToRawBook(decodeText(buf, profile.target), f.name.replace(/\.[^.]+$/, ''), chapterLabels());
      return importRaw(raw, isEpub ? 'epub' : 'txt');
    });

  const remove = async (b: Book) => {
    if (!confirm(t('library.confirmDelete', { title: b.title }))) return;
    await db.transaction('rw', db.books, db.chapters, async () => {
      await db.chapters.where('bookId').equals(b.id).delete();
      await db.books.delete(b.id);
    });
  };

  return (
    <>
      <header class="topbar">
        <h1 class="brand" lang={profile.target}>{TARGET_INFO[profile.target].brand}</h1>
        <a class="btn small ghost lang-chip" href="#/idiomas" title={t('library.languages')} aria-label={t('library.languages')}>{profile.target.toUpperCase()} → {profile.ui.toUpperCase()}</a>
        <a class="btn small" href="#/catalogo"><IconBook width={18} /> {t('library.catalog')}</a>
        <button class="btn small" onClick={() => setPaste(true)} disabled={!!busy} aria-label={t('library.pasteAria')}><IconEdit width={18} /> <span class="wide-only">{t('library.paste')}</span></button>
        <button class="btn small primary" onClick={importFile} disabled={!!busy}><IconUpload width={18} /> {t('library.import')}</button>
      </header>
      <main>
        {update && (
          <div class="banner">
            <span class="spacer">{t('library.dictUpdate', { v: update })}</span>
            <button class="btn small" onClick={onUpdate}>{t('library.update')}</button>
          </div>
        )}
        {busy && <div class="banner">{busy}</div>}

        {books && books.length === 0 && (
          <div class="empty">
            <div class="big" lang={profile.target}>{tt('library.welcome')}</div>
            <p>{t('library.intro')}</p>
            <div class="row" style={{ justifyContent: 'center' }}>
              <a class="btn primary" href="#/catalogo"><IconBook width={18} /> {t('library.seeCatalog')}</a>
              <button class="btn" onClick={importFile}><IconUpload width={18} /> {t('library.importBtn')}</button>
              {profile.target === 'el' && (
                <button class="btn" onClick={() => run(t('library.importingSample'), () => importRaw(sampleBook(), 'txt'))}>{t('library.sample', { title: 'Τα ψηλά βουνά' })}</button>
              )}
            </div>
            <p class="muted small" style={{ marginTop: 24 }}>
              {t('library.freeTexts')}{' '}
              {FREE_TEXTS[profile.target].map(([name, url], i, all) => (
                <Fragment key={url}>
                  <a href={url} target="_blank" rel="noopener">{name}</a>{i < all.length - 1 ? ', ' : '.'}
                </Fragment>
              ))}
            </p>
          </div>
        )}

        {books?.map((b) => {
          const cov = states ? bookCoverage(b.vocab, (k) => states.get(k)) : null;
          const label = cov ? coverageLabel(cov.known) : null;
          const initials = b.title.replace(/[^\p{L}]/gu, '').slice(0, 1).toUpperCase() || '·';
          return (
            <div class="card" key={b.id}>
              <div class="book">
                <a href={`#/leer/${b.id}`} class="spine" aria-hidden="true">{initials}</a>
                <a href={`#/leer/${b.id}`} class="info" style={{ textDecoration: 'none', color: 'inherit' }}>
                  <div class="title" lang={profile.target}>{b.title}</div>
                  {b.author && <div class="author" lang={profile.target}>{b.author}</div>}
                  <div class="row small muted" style={{ marginTop: 4 }}>
                    <span>{t('library.chapterOf', { n: b.pos.chapter + 1, total: b.chapterCount })}</span>
                    <span>{t('library.forms', { n: cov?.uniqueForms ?? 0 })}</span>
                    {label && <span class={`pill ${label.level}`}>{t(`coverage.${label.level}`, { pct: label.pct })}</span>}
                  </div>
                  {cov && (
                    <div class="meter" title={t('library.meterTitle', { known: Math.round(cov.known * 100), learning: Math.round(cov.withLearning * 100) })}>
                      <i class="learning" style={{ width: `${cov.withLearning * 100}%` }} />
                      <i style={{ width: `${cov.known * 100}%` }} />
                    </div>
                  )}
                </a>
                <button class="icon-btn" aria-label={t('library.delete', { title: b.title })} onClick={() => remove(b)}><IconTrash /></button>
              </div>
            </div>
          );
        })}
        {books && books.length > 0 && (
          <p class="muted tiny">{t('library.coverageNote')}</p>
        )}
      </main>
      {paste && (
        <PasteDialog
          onClose={() => setPaste(false)}
          onSave={(title, text) => {
            setPaste(false);
            run(t('library.importing'), () => importRaw(textToRawBook(text, title, chapterLabels()), 'paste'));
          }}
        />
      )}
    </>
  );
}

function PasteDialog({ onClose, onSave }: { onClose: () => void; onSave: (title: string, text: string) => void }) {
  const [title, setTitle] = useState('');
  const [text, setText] = useState('');
  const ok = text.trim().length > 0;
  return (
    <div class="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div class="dialog" role="dialog" aria-label={t('library.pasteTitle')}>
        <h2>{t('library.pasteTitle')}</h2>
        <label class="field">
          <span>{t('library.titleField')}</span>
          <input type="text" value={title} onInput={(e) => setTitle(e.currentTarget.value)} placeholder={t('library.optional')} />
        </label>
        <label class="field">
          <span>{tt('library.textField')}</span>
          <textarea lang={profile.target} value={text} onInput={(e) => setText(e.currentTarget.value)} />
        </label>
        <div class="row">
          <span class="spacer" />
          <button class="btn ghost" onClick={onClose}>{t('btn.cancel')}</button>
          <button
            class="btn primary"
            disabled={!ok}
            onClick={() => onSave(title.trim() || text.trim().split(/\s+/).slice(0, 4).join(' ') + '…', text)}
          >
            {t('btn.save')}
          </button>
        </div>
      </div>
    </div>
  );
}
