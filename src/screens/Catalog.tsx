// IMP-5 / IMP-6 — Catálogo de libros de dominio público, filtrado por nivel estimado.
import { useEffect, useState } from 'preact/hooks';
import { db } from '../db.ts';
import { go, toast, useLive } from '../hooks.ts';
import { fetchCatalog, fetchCatalogBook, KIND_LABEL, LEVEL_LABEL, readingTime, type CatalogEntry, type CatalogFile, type CatalogLevel } from '../lib/catalog.ts';
import { importRaw } from './Library.tsx';
import { IconBack, IconDownload, IconExternal } from '../components/icons.tsx';

const LEVEL_HINT: Record<CatalogLevel, string> = {
  A2: 'Cuentos y libros infantiles con vocabulario cotidiano y frases cortas.',
  B1: 'Novela juvenil y relatos en demótico: algo más de vocabulario, mucho diálogo.',
  B2: 'Narrativa adulta en demótico, con vocabulario rural, marinero o regional.',
  C1: 'Clásicos en lengua culta (katharévousa) o en verso: para leer con la app al lado.',
};

const KEY = 'elliniko.catalog.level';
function savedLevel(): CatalogLevel {
  try {
    const v = localStorage.getItem(KEY);
    if (v === 'A2' || v === 'B1' || v === 'B2' || v === 'C1') return v;
  } catch { /* sin almacenamiento */ }
  return 'A2';
}

export function Catalog() {
  const [cat, setCat] = useState<CatalogFile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState<CatalogLevel>(savedLevel);
  const [busy, setBusy] = useState<string | null>(null);
  const imported = useLive(async () => {
    const m = new Map<string, string>();
    await db.books.each((b) => b.catalogId && m.set(b.catalogId, b.id));
    return m;
  }, []);

  useEffect(() => {
    fetchCatalog().then(setCat, (e) => setError((e as Error).message));
  }, []);

  const pick = (l: CatalogLevel) => {
    setLevel(l);
    try { localStorage.setItem(KEY, l); } catch { /* da igual */ }
  };

  const add = async (b: CatalogEntry) => {
    setBusy(b.id);
    try {
      const raw = await fetchCatalogBook(b);
      const book = await importRaw(raw, 'catalog', b.id);
      const pct = Math.round((book.initialCoverage ?? 0) * 100);
      toast(`«${b.title}» añadido · ya conoces el ${pct} %`, 3500);
      go(`leer/${book.id}`);
    } catch (e) {
      toast(navigator.onLine ? `No se pudo descargar: ${(e as Error).message}` : 'Sin conexión: los libros del catálogo se descargan al añadirlos.', 5000);
    } finally {
      setBusy(null);
    }
  };

  const list = cat?.books.filter((b) => b.level === level) ?? [];
  return (
    <>
      <header class="topbar">
        <a class="icon-btn" href="#/" aria-label="Volver a la biblioteca"><IconBack /></a>
        <h1>Catálogo</h1>
      </header>
      <main>
        <p class="muted small">Libros de dominio público, listos para leer. El nivel es orientativo: se calcula por la frecuencia de su vocabulario, la longitud de las frases y el peso de la katharévousa.</p>
        {error && <div class="banner">{error}</div>}
        {!cat && !error && <p class="muted">Cargando…</p>}
        {cat && (
          <>
            <div class="seg levels" role="tablist" aria-label="Nivel">
              {cat.levels.map((l) => (
                <button key={l} role="tab" aria-selected={l === level} class={l === level ? 'on' : ''} onClick={() => pick(l)}>
                  {l} <span class="count">{cat.books.filter((b) => b.level === l).length}</span>
                </button>
              ))}
            </div>
            <h2 class="level-title">{LEVEL_LABEL[level]}</h2>
            <p class="muted small">{LEVEL_HINT[level]}</p>
            {list.map((b) => {
              const mine = imported?.get(b.id);
              return (
                <div class="card cat-book" key={b.id}>
                  <div class="info">
                    <div class="title" lang="el">{b.title}</div>
                    <div class="author" lang="el">{b.author}{b.translator ? ` · μτφρ. ${b.translator}` : ''}</div>
                    {b.original && <div class="small muted">{b.original}</div>}
                    <div class="row small muted" style={{ marginTop: 4 }}>
                      <span>{KIND_LABEL[b.kind]}</span>
                      <span>· {readingTime(b.words)}</span>
                      <span>· {b.chapters} cap.</span>
                      {b.year && <span>· {b.year}</span>}
                      {b.katharevousa && <span class="pill hard" title="Narrado en buena parte en lengua culta">katharévousa</span>}
                    </div>
                    <div class="row tiny muted" style={{ marginTop: 2 }}>
                      <span title="Palabras del texto que están entre las 3000 más frecuentes del griego">{Math.round(b.top3k)} % vocabulario frecuente</span>
                      <span>·</span>
                      <a href={b.source.url} target="_blank" rel="noopener" class="muted">{b.source.name} <IconExternal width={12} height={12} /></a>
                    </div>
                  </div>
                  {mine ? (
                    <a class="btn small" href={`#/leer/${mine}`}>Leer</a>
                  ) : (
                    <button class="btn small primary" disabled={!!busy} onClick={() => add(b)} aria-label={`Añadir ${b.title}`}>
                      <IconDownload width={16} /> {busy === b.id ? '…' : 'Añadir'}
                    </button>
                  )}
                </div>
              );
            })}
            <p class="muted tiny">Dentro de cada nivel van de más fácil a más difícil. Al añadir un libro se descarga (unos cientos de KB) y desde entonces funciona sin conexión.</p>
          </>
        )}
      </main>
    </>
  );
}
