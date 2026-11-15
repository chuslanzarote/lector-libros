// Utilidades de navegador: TTS (LEC-5), traductor externo (LEC-4), descargas y archivos.

// ---------------------------------------------------------------- LEC-5 audio
let greekVoice: SpeechSynthesisVoice | null | undefined;

function pickVoice(): SpeechSynthesisVoice | null {
  if (typeof speechSynthesis === 'undefined') return null;
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => v.lang === 'el-GR') ?? voices.find((v) => v.lang.toLowerCase().startsWith('el')) ?? null;
}

export function ttsAvailable(): boolean {
  return typeof speechSynthesis !== 'undefined';
}

export function speak(text: string, rate = 0.9) {
  if (!ttsAvailable()) return;
  if (greekVoice === undefined || greekVoice === null) greekVoice = pickVoice();
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'el-GR';
  u.rate = rate;
  if (greekVoice) u.voice = greekVoice;
  speechSynthesis.speak(u);
}

if (typeof speechSynthesis !== 'undefined') {
  speechSynthesis.addEventListener?.('voiceschanged', () => (greekVoice = pickVoice()));
}

// ---------------------------------------------------------------- LEC-4 traductor
export const TRANSLATORS = {
  google: 'https://translate.google.com/?sl=el&tl=es&text={q}&op=translate',
  deepl: 'https://www.deepl.com/translator#el/es/{q}',
} as const;

export function translatorUrl(template: string, text: string): string {
  const q = encodeURIComponent(text);
  return template.includes('{q}') ? template.replaceAll('{q}', q) : template + q;
}

export function openExternal(url: string) {
  window.open(url, '_blank', 'noopener,noreferrer');
}

export function wiktionaryUrl(lemma: string): string {
  return `https://en.wiktionary.org/wiki/${encodeURIComponent(lemma)}#Greek`;
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
