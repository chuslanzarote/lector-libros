// IMP-5 / IMP-6 / IMP-7 — Catálogo de libros de dominio público del idioma que se aprende, filtrado por nivel estimado.
import { useEffect, useState } from 'preact/hooks';
import { db } from '../db.ts';
import { go, toast, useLive } from '../hooks.ts';
import { fetchCatalog, fetchCatalogBook, readingTime, type CatalogEntry, type CatalogFile, type CatalogLevel } from '../lib/catalog.ts';
import { profile } from '../profile.ts';
import { locale, t, tt } from '../i18n/index.ts';
import { importRaw } from './Library.tsx';
import { IconBack, IconDownload, IconExternal } from '../components/icons.tsx';

/** Nivel elegido, por idioma de estudio (la clave antigua sin sufijo era la del griego) */
const KEY = `elliniko.catalog.level.${profile.target}`;
const OLD_KEY = 'elliniko.catalog.level';
function savedLevel(): CatalogLevel {
  try {
    const v = localStorage.getItem(KEY) ?? (profile.target === 'el' ? localStorage.getItem(OLD_KEY) : null);
    if (v === 'A2' || v === 'B1' || v === 'B2' || v === 'C1') return v;
  } catch { /* sin almacenamiento */ }
  return 'A2';
}

export function Catalog() {
  const target = profile.target;
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
    fetchCatalog(target).then(setCat, (e) => setError((e as Error).message));
  }, []);

  const pick = (l: CatalogLevel) => {
    setLevel(l);
    try { localStorage.setItem(KEY, l); } catch { /* da igual */ }
  };

  const add = async (b: CatalogEntry) => {
    setBusy(b.id);
    try {
      const raw = await fetchCatalogBook(b, target);
      const book = await importRaw(raw, 'catalog', b.id);
      const pct = Math.round((book.initialCoverage ?? 0) * 100);
      toast(t('catalog.added', { title: b.title, pct }), 3500);
      go(`leer/${book.id}`);
    } catch (e) {
      toast(navigator.onLine ? t('catalog.downloadError', { msg: (e as Error).message }) : t('catalog.offline'), 5000);
    } finally {
      setBusy(null);
    }
  };

  const list = cat?.books.filter((b) => b.level === level) ?? [];
  return (
    <>
      <header class="topbar">
        <a class="icon-btn" href="#/" aria-label={t('catalog.back')}><IconBack /></a>
        <h1>{t('catalog.title')}</h1>
      </header>
      <main>
        <p class="muted small">{tt('catalog.intro')}</p>
        {error && <div class="banner">{error}</div>}
        {!cat && !error && <p class="muted">{t('loading')}</p>}
        {cat && (
          <>
            <div class="seg levels" role="tablist" aria-label={t('catalog.levelAria')}>
              {cat.levels.map((l) => (
                <button key={l} role="tab" aria-selected={l === level} class={l === level ? 'on' : ''} onClick={() => pick(l)}>
                  {l} <span class="count">{cat.books.filter((b) => b.level === l).length}</span>
                </button>
              ))}
            </div>
            <h2 class="level-title">{t(`catalog.level.${level}`)}</h2>
            <p class="muted small">{tt(`catalog.hint.${level}`)}</p>
            {list.map((b) => {
              const mine = imported?.get(b.id);
              return (
                <div class="card cat-book" key={b.id}>
                  <div class="info">
                    <div class="title" lang={target}>{b.title}</div>
                    <div class="author" lang={target}>{b.author}{b.translator ? ` · ${tt('catalog.translator')} ${b.translator}` : ''}</div>
                    {b.original && <div class="small muted">{b.original}</div>}
                    <div class="row small muted" style={{ marginTop: 4 }}>
                      <span>{t(`catalog.kind.${b.kind}`)}</span>
                      <span>· {readingTime(b.words, locale())}</span>
                      <span>· {t('catalog.chapters', { n: b.chapters })}</span>
                      {b.year && <span>· {b.year}</span>}
                      {b.archaic && <span class="pill hard" title={tt('catalog.archaicTip')}>{tt('catalog.archaic')}</span>}
                    </div>
                    <div class="row tiny muted" style={{ marginTop: 2 }}>
                      <span title={tt('catalog.top3kTip')}>{t('catalog.top3k', { pct: Math.round(b.top3k) })}</span>
                      <span>·</span>
                      <a href={b.source.url} target="_blank" rel="noopener" class="muted">{b.source.name} <IconExternal width={12} height={12} /></a>
                    </div>
                  </div>
                  {mine ? (
                    <a class="btn small" href={`#/leer/${mine}`}>{t('catalog.read')}</a>
                  ) : (
                    <button class="btn small primary" disabled={!!busy} onClick={() => add(b)} aria-label={t('catalog.addAria', { title: b.title })}>
                      <IconDownload width={16} /> {busy === b.id ? '…' : t('catalog.add')}
                    </button>
                  )}
                </div>
              );
            })}
            <p class="muted tiny">{t('catalog.footer')}</p>
          </>
        )}
      </main>
    </>
  );
}
