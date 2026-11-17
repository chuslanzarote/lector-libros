import { Wordmark } from './components/Logo.tsx';
import { useEffect, useState } from 'preact/hooks';
import { db } from './db.ts';
import { useLive, useRoute, useSettings, useToast } from './hooks.ts';
import { fetchManifest, installInWorker, loadSource } from './dict.ts';
import { Library } from './screens/Library.tsx';
import { Reader } from './screens/Reader.tsx';
import { Vocab } from './screens/Vocab.tsx';
import { Review } from './screens/Review.tsx';
import { Progress } from './screens/Progress.tsx';
import { SettingsScreen } from './screens/Settings.tsx';
import { Credits } from './screens/Credits.tsx';
import { Catalog } from './screens/Catalog.tsx';
import { Welcome } from './screens/Welcome.tsx';
import { profile } from './profile.ts';
import { t, type MsgKey } from './i18n/index.ts';
import { IconBook, IconChart, IconList, IconRepeat, IconSettings } from './components/icons.tsx';

/** Tamaño aproximado de cada diccionario comprimido, para el aviso de descarga */
const DICT_MB = { el: 5, es: 7 } as const;

type DictState =
  | { s: 'checking' }
  | { s: 'installing'; phase: string; p: number }
  | { s: 'ready'; version: string; update?: string }
  | { s: 'error'; message: string };

export function App() {
  const route = useRoute();
  const [settings] = useSettings();
  const [dict, setDict] = useState<DictState>({ s: 'checking' });
  const msg = useToast();

  useEffect(() => {
    document.documentElement.dataset.theme = settings.theme === 'auto' ? '' : settings.theme;
    if (settings.theme === 'auto') delete document.documentElement.dataset.theme;
  }, [settings.theme]);

  const install = async () => {
    setDict({ s: 'installing', phase: 'download', p: 0 });
    try {
      await installInWorker((phase, p) => setDict({ s: 'installing', phase, p }));
      const cur = await loadSource();
      setDict({ s: 'ready', version: cur!.meta.version });
    } catch (e) {
      setDict({ s: 'error', message: (e as Error).message });
    }
  };

  useEffect(() => {
    (async () => {
      const cur = await loadSource();
      if (!cur) return install();
      setDict({ s: 'ready', version: cur.meta.version });
      // ¿Hay un diccionario más nuevo publicado? (sólo si hay red)
      const m = await fetchManifest();
      if (m && m.version !== cur.meta.version) setDict({ s: 'ready', version: cur.meta.version, update: m.version });
    })();
  }, []);

  if (route.name === 'idiomas') return <Welcome current={profile} />;
  if (dict.s !== 'ready') return <DictSplash state={dict} retry={install} />;

  let screen;
  switch (route.name) {
    case 'leer': screen = <Reader bookId={route.params[0]} chapterParam={route.params[1]} />; break;
    case 'vocabulario': screen = <Vocab />; break;
    case 'repaso': screen = <Review />; break;
    case 'progreso': screen = <Progress />; break;
    case 'ajustes': screen = <SettingsScreen dictVersion={dict.version} onReinstall={install} />; break;
    case 'creditos': screen = <Credits />; break;
    case 'catalogo': screen = <Catalog />; break;
    default: screen = <Library update={dict.update} onUpdate={install} />;
  }

  return (
    <div class="app">
      {screen}
      {route.name !== 'leer' && <TabBar current={route.name} />}
      {msg && <div class="toast" role="status">{msg}</div>}
    </div>
  );
}

function TabBar({ current }: { current: string }) {
  const due = useLive(() => db.cards.where('dueAt').belowOrEqual(Date.now()).count(), []);
  const tabs: { href: string; name: string; label: MsgKey; Icon: typeof IconBook; badge?: number }[] = [
    { href: '#/', name: '', label: 'tab.library', Icon: IconBook },
    { href: '#/vocabulario', name: 'vocabulario', label: 'tab.vocab', Icon: IconList },
    { href: '#/repaso', name: 'repaso', label: 'tab.review', Icon: IconRepeat, badge: due },
    { href: '#/progreso', name: 'progreso', label: 'tab.progress', Icon: IconChart },
    { href: '#/ajustes', name: 'ajustes', label: 'tab.settings', Icon: IconSettings },
  ];
  return (
    <nav class="tabbar" aria-label={t('tab.sections')}>
      {tabs.map((tab) => (
        <a key={tab.name} href={tab.href} class={current === tab.name || (tab.name === 'ajustes' && current === 'creditos') || (tab.name === '' && current === 'catalogo') ? 'on' : ''}>
          <tab.Icon />
          <span>
            {t(tab.label)}
            {tab.badge ? <span class="badge">{tab.badge}</span> : null}
          </span>
        </a>
      ))}
    </nav>
  );
}

function DictSplash({ state, retry }: { state: DictState; retry: () => void }) {
  const pct = state.s === 'installing' ? Math.round(state.p * 100) : 0;
  const phase =
    state.s === 'installing'
      ? state.phase === 'download' ? t('splash.download', { mb: DICT_MB[profile.target] })
      : state.phase === 'parse' ? t('splash.parse')
      : t('splash.install', { pct })
      : t('splash.opening');
  return (
    <div class="splash">
      <Wordmark size={40} />
      {state.s === 'error' ? (
        <>
          <p>{t('splash.error', { msg: state.message })}</p>
          <p class="muted small">{t('splash.needsNet')}</p>
          <button class="btn primary" onClick={retry}>{t('splash.retry')}</button>
        </>
      ) : (
        <>
          <p class="muted">{phase}</p>
          {state.s === 'installing' && (
            <div class="progress" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
              <i style={{ width: `${state.phase === 'install' ? pct : 4}%` }} />
            </div>
          )}
          {state.s === 'installing' && <p class="muted tiny">{t('splash.firstTime')}</p>}
        </>
      )}
    </div>
  );
}
