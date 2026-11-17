// Utilidades de navegador: TTS (LEC-5), traductor externo (LEC-4), descargas y archivos.
// Todo depende del par de idiomas del perfil (IDI-4).
import { TARGET_INFO, type Profile, type TargetLang } from './langs.ts';

// ---------------------------------------------------------------- LEC-5 / IDI-4 audio

const voices = new Map<string, SpeechSynthesisVoice | null>();

function pickVoice(bcp47: string): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null;
  const all = speechSynthesis.getVoices();
  const short = bcp47.slice(0, 2);
  return all.find((v) => v.lang === bcp47) ?? all.find((v) => v.lang.toLowerCase().startsWith(short)) ?? null;
}

export function ttsAvailable(): boolean {
  return typeof speechSynthesis !== 'undefined';
}

/** Lee en voz alta un texto del idioma que se aprende */
export function speak(text: string, lang: TargetLang, rate = 0.9) {
  if (!ttsAvailable()) return;
  const bcp47 = TARGET_INFO[lang].tts;
  if (!voices.get(bcp47)) voices.set(bcp47, pickVoice(bcp47));
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = bcp47;
  u.rate = rate;
  const v = voices.get(bcp47);
  if (v) u.voice = v;
  speechSynthesis.speak(u);
}

if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.addEventListener?.('voiceschanged', () => voices.clear());
}

// ---------------------------------------------------------------- LEC-4 / IDI-4 traductor
/** Traductores externos para el par de idiomas: del que se aprende al del usuario */
export function translators(p: Profile): { google: string; deepl: string } {
  return {
    google: `https://translate.google.com/?sl=${p.target}&tl=${p.ui}&text={q}&op=translate`,
    deepl: `https://www.deepl.com/translator#${p.target}/${p.ui}/{q}`,
  };
}

export function translatorUrl(template: string, text: string): string {
  const q = encodeURIComponent(text);
  return template.includes('{q}') ? template.replaceAll('{q}', q) : template + q;
}

export function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function wiktionaryUrl(lemma: string, lang: TargetLang): string {
  return `https://en.wiktionary.org/wiki/${encodeURIComponent(lemma)}#${TARGET_INFO[lang].wiktionary}`;
}

// ---------------------------------------------------------------- archivos
export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/** Comparte el archivo con la hoja nativa (iOS/Android: iCloud, Drive, Kindle…) o lo descarga. */
export async function shareOrDownload(blob: Blob, filename: string, title?: string) {
  const file = new File([blob], filename, { type: blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: title ?? filename });
      return;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
  }
  download(blob, filename);
}

export function pickFile(accept: string): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.addEventListener('cancel', () => resolve(null));
    input.click();
  });
}
