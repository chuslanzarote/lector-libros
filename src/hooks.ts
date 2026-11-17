import { useEffect, useState, useCallback } from 'preact/hooks';
import { liveQuery } from 'dexie';
import { db } from './db.ts';
import { translators } from './lib/platform.ts';
import { profile } from './profile.ts';

/** Consulta reactiva de Dexie: se actualiza sola cuando cambian las tablas implicadas. */
export function useLive<T>(fn: () => Promise<T> | T, deps: unknown[] = []): T | undefined {
  const [v, setV] = useState<T | undefined>(undefined);
  useEffect(() => {
    const sub = liveQuery(fn).subscribe({ next: setV, error: (e) => console.error(e) });
    return () => sub.unsubscribe();
  }, deps);
  return v;
}

// ---------------------------------------------------------------- enrutado por hash
export function parseRoute(hash: string): { name: string; params: string[] } {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean).map(decodeURIComponent);
  return { name: parts[0] ?? '', params: parts.slice(1) };
}

export function useRoute() {
  const [route, setRoute] = useState(() => parseRoute(location.hash));
  useEffect(() => {
    const on = () => setRoute(parseRoute(location.hash));
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  }, []);
  return route;
}

export function go(path: string) {
  location.hash = path.startsWith('#') ? path : '#/' + path.replace(/^\//, '');
}

// ---------------------------------------------------------------- ajustes
export interface Settings {
  theme: 'auto' | 'light' | 'dark';
  fontSize: number;
  lineHeight: number;
  translatorUrl: string;
  showOriginal: boolean;
  colorNew: boolean;
  autoSpeak: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'auto',
  fontSize: 20,
  lineHeight: 1.65,
  translatorUrl: translators(profile).google,
  showOriginal: false,
  colorNew: true,
  autoSpeak: false,
};

export function useSettings(): [Settings, <K extends keyof Settings>(k: K, v: Settings[K]) => Promise<void>] {
  const rows = useLive(() => db.settings.toArray(), []);
  const s: Settings = { ...DEFAULT_SETTINGS };
  for (const r of rows ?? []) if (r.key in s) (s as unknown as Record<string, unknown>)[r.key] = r.value;
  const set = useCallback(async <K extends keyof Settings>(k: K, v: Settings[K]) => {
    await db.settings.put({ key: k, value: v, updatedAt: Date.now() });
  }, []);
  return [s, set];
}

// ---------------------------------------------------------------- avisos
type ToastListener = (msg: string | null) => void;
const toastListeners = new Set<ToastListener>();
let toastTimer: ReturnType<typeof setTimeout> | undefined;

export function toast(msg: string, ms = 2600) {
  toastListeners.forEach((l) => l(msg));
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastListeners.forEach((l) => l(null)), ms);
}

export function useToast(): string | null {
  const [m, setM] = useState<string | null>(null);
  useEffect(() => {
    toastListeners.add(setM);
    return () => void toastListeners.delete(setM);
  }, []);
  return m;
}
