// IDI-1 — Perfil de idiomas guardado en el dispositivo. Al cambiarlo, la app se recarga y abre
// la base de datos del otro idioma (IDI-3).
import { isValidProfile, TARGET_INFO, type Lang, type Profile, type TargetLang } from './lib/langs.ts';

const KEY = 'elliniko.profile';

export function loadProfile(): Profile | null {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? 'null');
    return isValidProfile(v) ? v : null;
  } catch {
    return null;
  }
}

export function saveProfile(p: Profile, reload = true) {
  try {
    localStorage.setItem(KEY, JSON.stringify(p));
  } catch { /* sin almacenamiento: dura lo que la pestaña */ }
  if (reload) {
    location.hash = '#/';
    location.reload();
  }
}

/** Vuelve a la pantalla de inicio para elegir idiomas. */
export function resetProfile() {
  try {
    localStorage.removeItem(KEY);
  } catch { /* nada */ }
  location.hash = '#/';
  location.reload();
}

/** Idioma de interfaz probable antes de elegir (para la pantalla de inicio). */
export function browserLang(): Lang {
  const l = (typeof navigator !== 'undefined' ? navigator.language : 'es').slice(0, 2);
  return l === 'el' || l === 'en' ? l : l === 'es' ? 'es' : 'en';
}

/** Perfil activo. Sin perfil (pantalla de inicio, tests) se asume el original: griego para hispanohablantes. */
export const profile: Profile = loadProfile() ?? { target: 'el', ui: 'es' };
export const hasProfile = loadProfile() !== null;

export function target(): TargetLang {
  return profile.target;
}

export function dbNameFor(t: TargetLang): string {
  return TARGET_INFO[t].dbName;
}
