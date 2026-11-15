// LEC-1…LEC-7, KIN-1 — Lector: scroll, colores por estado, toque, pulsación larga, expresiones.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { memo, Fragment } from 'preact/compat';
import { db, type Chapter, type WordState } from '../db.ts';
import { go, toast, useLive, useSettings } from '../hooks.ts';
import { source } from '../dict.ts';
import { tokenize, type Sentence } from '../lib/text.ts';
import { formKey, isGreek } from '../lib/normalize.ts';
import { countForms, resolveLemmas } from '../lib/importer.ts';
import { markChapterRead, saveLookup, setUserTranslation } from '../lib/vocab.ts';
import { openExternal, shareOrDownload, translatorUrl } from '../lib/platform.ts';
import { buildKindleEpub, type Gloss } from '../lib/kindle.ts';
import { bestTranslation } from '../lib/lookup.ts';
import { WordCard } from '../components/WordCard.tsx';
import { useLexemeStates } from './Library.tsx';
import { IconBack, IconBracket, IconCheck, IconKindle, IconMinus, IconMoon, IconMore, IconPlus, IconToc } from '../components/icons.tsx';

interface Selected { sid: string; ti: number; text: string }
interface Active { token: string; key: string; sentence: Sentence; sid: string; ti: number }

const LONG_PRESS_MS = 550;

export function Reader({ bookId, chapterParam }: { bookId: string; chapterParam?: string }) {
  const [settings, setSetting] = useSettings();
  const book = useLive(() => db.books.get(bookId), [bookId]);
  const chapters = useLive(() => db.chapters.where('bookId').equals(bookId).sortBy('index'), [bookId]);
  const choicesRows = useLive(() => db.formChoices.toArray(), []);
  const states = useLexemeStates();

  const [chIdx, setChIdx] = useState<number | null>(null);
  const [lemmaOf, setLemmaOfRaw] = useState<Map<string, string>>(new Map());
  const [lemmaVer, setLemmaVer] = useState(0);
  const setLemmaOf = (m: Map<string, string>) => { setLemmaOfRaw(m); setLemmaVer((v) => v + 1); };
  const [active, setActive] = useState<Active | null>(null);
  const [exprMode, setExprMode] = useState(false);
  const [selected, setSelected] = useState<Selected[]>([]);
  const [exprDialog, setExprDialog] = useState(false);
  const [menu, setMenu] = useState(false);
  const [toc, setToc] = useState(false);
  const [scrollPct, setScrollPct] = useState(0);
  const restored = useRef(false);
  const textRef = useRef<HTMLDivElement>(null);

  // Capítulo inicial: el de la URL o la posición guardada
  useEffect(() => {
    if (book && chIdx === null) {
      const p = chapterParam !== undefined ? Number(chapterParam) : book.pos.chapter;
      setChIdx(Math.min(Math.max(0, p || 0), book.chapterCount - 1));
    }
  }, [book?.id]);

  const chapter: Chapter | undefined = chIdx !== null ? chapters?.[chIdx] : undefined;

  // Lema principal de cada forma del capítulo (para colorear)
  useEffect(() => {
    if (!chapter || !choicesRows) return;
    let alive = true;
    const keys = [...countForms(chapter.sentences).keys()];
    const choices = new Map(choicesRows.map((c) => [c.form, c.lemma]));
    resolveLemmas(keys, source(), choices).then((m) => alive && setLemmaOf(m));
    return () => { alive = false; };
  }, [chapter?.id, choicesRows]);

  // LEC-1: restaurar la posición y guardarla al hacer scroll
  useEffect(() => {
    if (!chapter || !book || !textRef.current) return;
    if (!restored.current) {
      restored.current = true;
      if (book.pos.chapter === chapter.index && book.pos.sentence > 0) {
        const el = textRef.current.querySelector(`[data-sid="${CSS.escape(chapter.sentences[book.pos.sentence]?.id ?? '')}"]`);
        el?.scrollIntoView({ block: 'start' });
        return;
      }
    }
    window.scrollTo(0, 0);
  }, [chapter?.id, !!textRef.current]);

  useEffect(() => {
    if (!chapter || !book) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      const els = textRef.current?.querySelectorAll<HTMLElement>('[data-sid]');
      if (!els) return;
      let idx = 0;
      for (let i = 0; i < els.length; i++) {
        if (els[i].getBoundingClientRect().bottom > 70) { idx = i; break; }
      }
      db.books.update(book.id, { pos: { chapter: chapter.index, sentence: idx }, updatedAt: Date.now() });
    };
    const onScroll = () => {
      const h = document.documentElement.scrollHeight - innerHeight;
      setScrollPct(h > 0 ? Math.min(1, scrollY / h) : 1);
      clearTimeout(timer);
      timer = setTimeout(save, 400);
    };
    addEventListener('scroll', onScroll, { passive: true });
    if (book.pos.chapter !== chapter.index) save();
    return () => { removeEventListener('scroll', onScroll); clearTimeout(timer); };
  }, [chapter?.id, book?.id]);

  const stateOf = (key: string): WordState => {
    const l = lemmaOf.get(key) || key;
    return states?.get(l) ?? 'new';
  };

  // ------------------------------------------------------------ interacción
  const press = useRef<{ timer?: ReturnType<typeof setTimeout>; x: number; y: number; long: boolean; el?: HTMLElement }>({ x: 0, y: 0, long: false });

  const onPointerDown = (e: PointerEvent) => {
    const sEl = (e.target as HTMLElement).closest<HTMLElement>('[data-sid]');
    if (!sEl || !chapter) return;
    press.current = { x: e.clientX, y: e.clientY, long: false, el: sEl };
    press.current.timer = setTimeout(() => {
      // LEC-4: pulsación larga → frase en el traductor externo
      press.current.long = true;
      const s = chapter.sentences.find((x) => x.id === sEl.dataset.sid);
      sEl.classList.add('flash');
      setTimeout(() => sEl.classList.remove('flash'), 600);
      if (s) openExternal(translatorUrl(settings.translatorUrl, s.text));
    }, LONG_PRESS_MS);
  };
  const cancelPress = (e?: PointerEvent) => {
    if (e && Math.hypot(e.clientX - press.current.x, e.clientY - press.current.y) < 10 && e.type === 'pointermove') return;
    clearTimeout(press.current.timer);
  };

  const onClick = (e: MouseEvent) => {
    if (press.current.long) { press.current.long = false; return; }
    const wEl = (e.target as HTMLElement).closest<HTMLElement>('[data-ti]');
    const sEl = (e.target as HTMLElement).closest<HTMLElement>('[data-sid]');
    if (!wEl || !sEl || !chapter) return;
    const sentence = chapter.sentences.find((x) => x.id === sEl.dataset.sid)!;
    const ti = Number(wEl.dataset.ti);
    const token = wEl.textContent ?? '';
    if (exprMode) {
      setSelected((cur) => {
        const exists = cur.findIndex((s) => s.sid === sentence.id && s.ti === ti);
        if (exists >= 0) return cur.filter((_, i) => i !== exists);
        if (cur.length && cur[0].sid !== sentence.id) return [{ sid: sentence.id, ti, text: token }];
        return [...cur, { sid: sentence.id, ti, text: token }].sort((a, b) => a.ti - b.ti);
      });
      return;
    }
    setActive({ token, key: formKey(token), sentence, sid: sentence.id, ti });
  };

  const exprText = useMemo(() => {
    if (!selected.length || !chapter) return '';
    const s = chapter.sentences.find((x) => x.id === selected[0].sid)!;
    const toks = tokenize(s.text);
    const first = selected[0].ti, last = selected[selected.length - 1].ti;
    return toks.slice(first, last + 1).map((t) => t.t).join('').trim();
  }, [selected, chapter?.id]);

  // ------------------------------------------------------------ acciones del menú
  const doMarkRead = async (andNext: boolean) => {
    if (!chapter) return;
    const n = await markChapterRead(db, chapter, source());
    toast(n ? `${n} palabras nuevas pasan a conocidas` : 'Capítulo marcado como leído');
    if (andNext && book && chapter.index < book.chapterCount - 1) goChapter(chapter.index + 1);
  };

  const exportKindle = async () => {
    if (!chapter || !book) return;
    setMenu(false);
    toast('Preparando EPUB…');
    const keys = [...countForms(chapter.sentences).keys()];
    const lemmas = [...new Set(keys.map((k) => lemmaOf.get(k) || k))];
    const [lexs, recs, user] = await Promise.all([db.lexemes.bulkGet(lemmas), db.dictLemmas.bulkGet(lemmas), db.userDict.bulkGet(lemmas)]);
    const glossByLemma = new Map<string, Gloss>();
    lemmas.forEach((l, i) => {
      const st = lexs[i]?.state ?? 'new';
      if (st !== 'new' && st !== 'learning') return;
      const tr = lexs[i]?.translation ?? bestTranslation({ user: user[i]?.translation, es: recs[i]?.es ?? [], en: recs[i]?.en ?? [] })?.text;
      if (tr) glossByLemma.set(l, { lemma: l, translation: shortGloss(tr) });
    });
    const bytes = await buildKindleEpub({
      bookTitle: book.title,
      author: book.author,
      chapterTitle: chapter.title,
      sentences: chapter.sentences,
      glossFor: (k) => glossByLemma.get(lemmaOf.get(k) || k),
    });
    const name = `${book.title} - ${chapter.index + 1}`.replace(/[\\/:*?"<>|]+/g, '').slice(0, 80) + '.epub';
    await shareOrDownload(new Blob([bytes as BlobPart], { type: 'application/epub+zip' }), name, chapter.title);
    toast('EPUB listo: envíalo con Send-to-Kindle (app o amazon.com/sendtokindle)', 5000);
  };

  const goChapter = (i: number) => {
    setActive(null);
    setSelected([]);
    setToc(false);
    setChIdx(i);
    if (book) db.books.update(book.id, { pos: { chapter: i, sentence: 0 }, updatedAt: Date.now() });
    window.scrollTo(0, 0);
  };

  if (book === undefined || chapters === undefined) return <main class="muted">Cargando…</main>;
  if (!book) return <main><p>Libro no encontrado.</p><a href="#/">Volver</a></main>;

  const fs = settings.fontSize;
  return (
    <>
      <div class="reader-progress" style={{ width: `${scrollPct * 100}%` }} />
      <header class="topbar">
        <button class="icon-btn" aria-label="Biblioteca" onClick={() => go('/')}><IconBack /></button>
        <h1 class="small" title={book.title}>{chapter?.title ?? book.title}</h1>
        <button class="icon-btn" aria-label="Capítulos" onClick={() => setToc(true)}><IconToc /></button>
        <button class={`icon-btn ${exprMode ? 'on' : ''}`} aria-label="Seleccionar expresión" aria-pressed={exprMode} onClick={() => { setExprMode(!exprMode); setSelected([]); }}><IconBracket /></button>
        <button class="icon-btn" aria-label="Más opciones" onClick={() => setMenu(!menu)}><IconMore /></button>
        {menu && (
          <div class="menu" onClick={(e) => e.stopPropagation()}>
            <div class="row" style={{ padding: '6px 8px' }}>
              <span class="small spacer">Tamaño</span>
              <button class="icon-btn" aria-label="Letra más pequeña" onClick={() => setSetting('fontSize', Math.max(14, fs - 1))}><IconMinus /></button>
              <span class="small" style={{ width: 28, textAlign: 'center' }}>{fs}</span>
              <button class="icon-btn" aria-label="Letra más grande" onClick={() => setSetting('fontSize', Math.min(34, fs + 1))}><IconPlus /></button>
            </div>
            <button onClick={() => setSetting('theme', document.documentElement.dataset.theme === 'dark' || (!document.documentElement.dataset.theme && matchMedia('(prefers-color-scheme: dark)').matches) ? 'light' : 'dark')}>
              <IconMoon width={18} /> Modo claro / oscuro
            </button>
            <button onClick={() => setSetting('showOriginal', !settings.showOriginal)}>
              <span style={{ width: 18 }}>{settings.showOriginal ? '✓' : ''}</span> Mostrar texto original
            </button>
            <button onClick={() => setSetting('colorNew', !settings.colorNew)}>
              <span style={{ width: 18 }}>{settings.colorNew ? '✓' : ''}</span> Resaltar palabras nuevas
            </button>
            <hr />
            <button onClick={() => { setMenu(false); doMarkRead(false); }}><IconCheck width={18} /> Marcar capítulo leído</button>
            <button onClick={exportKindle}><IconKindle width={18} /> Enviar capítulo a Kindle (EPUB)</button>
          </div>
        )}
      </header>
      <main onClick={() => menu && setMenu(false)}>
        <div class="legend" style={{ marginBottom: 12 }}>
          <span><i class="w new">λέξη</i> nueva</span>
          <span><i class="w learning">λέξη</i> aprendiendo</span>
          <span class="muted">Toca una palabra · mantén pulsada una frase para traducirla</span>
        </div>
        {chapter && (
          <div
            ref={textRef}
            class={`reader ${settings.colorNew ? '' : 'plain'}`}
            lang="el"
            style={{ '--reader-size': `${fs}px`, '--reader-line': String(settings.lineHeight) }}
            onPointerDown={onPointerDown as any}
            onPointerUp={() => cancelPress()}
            onPointerCancel={() => cancelPress()}
            onPointerMove={cancelPress as any}
            onClick={onClick as any}
            onContextMenu={(e) => e.preventDefault()}
          >
            <h2 class="ch-title">{chapter.title}</h2>
            <ChapterText
              sentences={chapter.sentences}
              stateOf={stateOf}
              version={`${lemmaVer}:${states?.size}:${states ? hashStates(states) : ''}`}
              active={active ? `${active.sid}:${active.ti}` : ''}
              selected={selected.map((s) => `${s.sid}:${s.ti}`).join(',')}
              showOriginal={settings.showOriginal}
            />
            <div class="ch-nav">
              <button class="btn" disabled={chapter.index === 0} onClick={() => goChapter(chapter.index - 1)}>← Anterior</button>
              {chapter.index < book.chapterCount - 1 ? (
                <>
                  <button class="btn" onClick={() => doMarkRead(true)}><IconCheck width={18} /> Leído y siguiente</button>
                  <button class="btn primary" onClick={() => goChapter(chapter.index + 1)}>Siguiente →</button>
                </>
              ) : (
                <button class="btn primary" onClick={() => doMarkRead(false)}><IconCheck width={18} /> Marcar leído</button>
              )}
            </div>
          </div>
        )}
      </main>

      {exprMode && (
        <div class="selbar">
          <span class="expr" lang="el">{exprText || <span class="muted small">Toca las palabras de la expresión</span>}</span>
          <button class="btn small" onClick={() => { setExprMode(false); setSelected([]); }}>Cancelar</button>
          <button class="btn small primary" disabled={selected.length < 1} onClick={() => setExprDialog(true)}>Guardar</button>
        </div>
      )}

      {active && (
        <WordCard
          key={`${active.sid}:${active.ti}`}
          token={active.token}
          formKey={active.key}
          sentence={{ id: active.sentence.id, text: active.sentence.text }}
          bookId={book.id}
          onClose={() => setActive(null)}
        />
      )}

      {exprDialog && chapter && (
        <ExpressionDialog
          text={exprText}
          sentence={chapter.sentences.find((s) => s.id === selected[0]?.sid)!}
          bookId={book.id}
          translator={settings.translatorUrl}
          onClose={(saved) => {
            setExprDialog(false);
            if (saved) { setExprMode(false); setSelected([]); toast('Expresión guardada'); }
          }}
        />
      )}

      {toc && chapters && (
        <div class="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && setToc(false)}>
          <div class="dialog" role="dialog" aria-label="Capítulos">
            <h2>Capítulos</h2>
            {chapters.map((c) => (
              <button key={c.id} class={`btn ghost`} style={{ width: '100%', justifyContent: 'flex-start', fontWeight: c.index === chIdx ? 700 : 400 }} onClick={() => goChapter(c.index)}>
                <span class="muted" style={{ width: 28 }}>{c.index + 1}</span>
                <span lang="el" style={{ flex: 1, textAlign: 'left' }}>{c.title}</span>
                {c.readAt && <IconCheck width={16} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function shortGloss(t: string): string {
  const first = t.split(/[;]/)[0].replace(/\(.*?\)/g, '').trim();
  return first.length > 40 ? first.slice(0, 38).trimEnd() + '…' : first;
}

function hashStates(m: Map<string, WordState>): number {
  let h = 0;
  for (const [k, v] of m) h = (h * 31 + k.length * 7 + v.charCodeAt(0)) | 0;
  return h;
}

interface TextProps {
  sentences: Sentence[];
  stateOf: (key: string) => WordState;
  version: string;
  active: string;
  selected: string;
  showOriginal: boolean;
}

/** Texto del capítulo; sólo se vuelve a pintar cuando cambian estados, selección u opciones. */
const ChapterText = memo(
  function ChapterText({ sentences, stateOf, active, selected, showOriginal }: TextProps) {
    const sel = new Set(selected.split(',').filter(Boolean));
    const paras: Sentence[][] = [];
    for (const s of sentences) {
      if (s.para || !paras.length) paras.push([]);
      paras[paras.length - 1].push(s);
    }
    return (
      <>
        {paras.map((p) => (
          <p key={p[0].id}>
            {p.map((s) => (
              <Fragment key={s.id}>
                <span class="s" data-sid={s.id}>
                  {tokenize(s.text).map((t, ti) => {
                    if (!t.w) return t.t;
                    const id = `${s.id}:${ti}`;
                    if (!isGreek(t.t)) return <span class="w nogreek">{t.t}</span>;
                    const cls = `w ${stateOf(formKey(t.t))}${active === id ? ' active' : ''}${sel.has(id) ? ' sel' : ''}`;
                    return <span class={cls} data-ti={ti}>{t.t}</span>;
                  })}
                </span>{' '}
                {showOriginal && s.original !== s.text && <span class="original">{s.original}</span>}
              </Fragment>
            ))}
          </p>
        ))}
      </>
    );
  },
  (a, b) => a.sentences === b.sentences && a.version === b.version && a.active === b.active && a.selected === b.selected && a.showOriginal === b.showOriginal,
);

function ExpressionDialog({ text, sentence, bookId, translator, onClose }: { text: string; sentence: Sentence; bookId: string; translator: string; onClose: (saved: boolean) => void }) {
  const [expr, setExpr] = useState(text);
  const [tr, setTr] = useState('');
  const save = async () => {
    const key = expr.trim();
    if (!key || !tr.trim()) return;
    await setUserTranslation(db, key, tr.trim(), true);
    await saveLookup(db, { lemma: key, form: key, translation: tr.trim(), translationLang: 'user', isExpression: true, sentence: { id: sentence.id, text: sentence.text, bookId } });
    onClose(true);
  };
  return (
    <div class="dialog-backdrop" onClick={(e) => e.target === e.currentTarget && onClose(false)}>
      <div class="dialog" role="dialog" aria-label="Guardar expresión">
        <h2>Guardar expresión</h2>
        <label class="field"><span>Expresión</span><input type="text" lang="el" value={expr} onInput={(e) => setExpr(e.currentTarget.value)} /></label>
        <label class="field"><span>Tu traducción</span><input type="text" value={tr} onInput={(e) => setTr(e.currentTarget.value)} onKeyDown={(e) => e.key === 'Enter' && save()} autoFocus /></label>
        <p class="small muted" lang="el">{sentence.text}</p>
        <div class="row">
          <button class="btn ghost" onClick={() => openExternal(translatorUrl(translator, expr))}>Consultar en traductor</button>
          <span class="spacer" />
          <button class="btn ghost" onClick={() => onClose(false)}>Cancelar</button>
          <button class="btn primary" disabled={!tr.trim()} onClick={save}>Guardar</button>
        </div>
      </div>
    </div>
  );
}
