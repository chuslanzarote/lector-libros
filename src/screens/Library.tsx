// Biblioteca: libros con cobertura (PRO-1/PRO-2) e importación (IMP-1, IMP-2).
import { useState } from 'preact/hooks';
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

export function useLexemeStates(): Map<string, WordState> | undefined {
  return useLive(async () => {
    const m = new Map<string, WordState>();
    await db.lexemes.each((l) => m.set(l.lemma, l.state));
    return m;
  }, []);
}

export async function importRaw(raw: RawBook, kind: Book['source'], catalogId?: string) {
  const choices = new Map((await db.formChoices.toArray()).map((c) => [c.form, c.lemma]));
  const rec = await rawBookToRecords(raw, kind, source(), choices);
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
        toast(`«${b.title}» importado · ${b.chapterCount} cap. · ya conoces el ${pct} %`, 4000);
      }
    } catch (e) {
      toast(`No se pudo importar: ${(e as Error).message}`, 5000);
    } finally {
      setBusy(null);
    }
  };

  const importFile = () =>
    run('Importando…', async () => {
      const f = await pickFile('.epub,.txt,application/epub+zip,text/plain');
      if (!f) return null;
      const buf = await f.arrayBuffer();
      const isEpub = /\.epub$/i.test(f.name) || f.type === 'application/epub+zip';
      const raw = isEpub ? await parseEpub(buf) : textToRawBook(decodeText(buf), f.name.replace(/\.[^.]+$/, ''));
      return importRaw(raw, isEpub ? 'epub' : 'txt');
    });

  const remove = async (b: Book) => {
    if (!confirm(`¿Borrar «${b.title}»? Tu vocabulario se conserva.`)) return;
    await db.transaction('rw', db.books, db.chapters, async () => {
      await db.chapters.where('bookId').equals(b.id).delete();
      await db.books.delete(b.id);
    });
  };

  return (
    <>
      <header class="topbar">
        <h1 class="brand">Ελληνικό</h1>
        <a class="btn small" href="#/catalogo"><IconBook width={18} /> Catálogo</a>
        <button class="btn small" onClick={() => setPaste(true)} disabled={!!busy} aria-label="Pegar texto"><IconEdit width={18} /> <span class="wide-only">Pegar</span></button>
        <button class="btn small primary" onClick={importFile} disabled={!!busy}><IconUpload width={18} /> EPUB / TXT</button>
      </header>
      <main>
        {update && (
          <div class="banner">
            <span class="spacer">Hay un diccionario nuevo ({update}). Tu vocabulario no se toca.</span>
            <button class="btn small" onClick={onUpdate}>Actualizar</button>
          </div>
        )}
        {busy && <div class="banner">{busy}</div>}

        {books && books.length === 0 && (
          <div class="empty">
            <div class="big">Καλώς ήρθες</div>
            <p>Elige un libro del catálogo por nivel, importa el tuyo (EPUB o TXT) o pega un texto. Toca cualquier palabra para ver su lema, su análisis y su traducción.</p>
            <div class="row" style={{ justifyContent: 'center' }}>
              <a class="btn primary" href="#/catalogo"><IconBook width={18} /> Ver el catálogo por niveles</a>
              <button class="btn" onClick={importFile}><IconUpload width={18} /> Importar EPUB / TXT</button>
              <button class="btn" onClick={() => run('Importando ejemplo…', () => importRaw(sampleBook(), 'txt'))}>Probar con «Τα ψηλά βουνά»</button>
            </div>
            <p class="muted small" style={{ marginTop: 24 }}>
              Textos libres: <a href="https://www.ebooks4greeks.gr" target="_blank" rel="noopener">ebooks4greeks.gr</a>,{' '}
              <a href="https://www.openbook.gr" target="_blank" rel="noopener">openbook.gr</a>,{' '}
              <a href="https://www.gutenberg.org/browse/languages/el" target="_blank" rel="noopener">Gutenberg</a>,{' '}
              <a href="https://el.wikisource.org" target="_blank" rel="noopener">el.wikisource</a>.
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
                  <div class="title">{b.title}</div>
                  {b.author && <div class="author">{b.author}</div>}
                  <div class="row small muted" style={{ marginTop: 4 }}>
                    <span>Cap. {b.pos.chapter + 1}/{b.chapterCount}</span>
                    <span>· {cov?.uniqueForms ?? 0} formas distintas</span>
                    {label && <span class={`pill ${label.level}`}>{label.text}</span>}
                  </div>
                  {cov && (
                    <div class="meter" title={`Conocidas ${Math.round(cov.known * 100)} % · con las que aprendes ${Math.round(cov.withLearning * 100)} %`}>
                      <i class="learning" style={{ width: `${cov.withLearning * 100}%` }} />
                      <i style={{ width: `${cov.known * 100}%` }} />
                    </div>
                  )}
                </a>
                <button class="icon-btn" aria-label={`Borrar ${b.title}`} onClick={() => remove(b)}><IconTrash /></button>
              </div>
            </div>
          );
        })}
        {books && books.length > 0 && (
          <p class="muted tiny">Cobertura = % de palabras del libro que ya conoces. Cómodo desde ~95 %, aprovechable desde ~85 %.</p>
        )}
      </main>
      {paste && (
        <PasteDialog
          onClose={() => setPaste(false)}
          onSave={(title, text) => {
            setPaste(false);
            run('Importando…', () => importRaw(textToRawBook(text, title), 'paste'));
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
      <div class="dialog" role="dialog" aria-label="Pegar texto">
        <h2>Pegar texto</h2>
        <label class="field">
          <span>Título</span>
          <input type="text" value={title} onInput={(e) => setTitle(e.currentTarget.value)} placeholder="Opcional" />
        </label>
        <label class="field">
          <span>Texto en griego (politónico o monotónico)</span>
          <textarea lang="el" value={text} onInput={(e) => setText(e.currentTarget.value)} placeholder="Επικόλλησε εδώ το κείμενο…" />
        </label>
        <div class="row">
          <span class="spacer" />
          <button class="btn ghost" onClick={onClose}>Cancelar</button>
          <button
            class="btn primary"
            disabled={!ok}
            onClick={() => onSave(title.trim() || text.trim().split(/\s+/).slice(0, 4).join(' ') + '…', text)}
          >
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}
