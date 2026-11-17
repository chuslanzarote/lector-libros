// VOC-3 — Vocabulario a CSV importable en Anki (cabeceras de Anki ≥ 2.1.55).
import type { Lexeme } from '../db.ts';

function cell(v: string | undefined): string {
  const s = (v ?? '').replace(/\r?\n/g, ' ');
  return /[",\n;]/.test(s) || s.startsWith(' ') ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Resalta la palabra dentro de la frase de contexto (Anki acepta HTML). */
function highlight(sentence: string, form?: string): string {
  const esc = sentence.replace(/&/g, '&amp;').replace(/</g, '&lt;');
  if (!form) return esc;
  const i = esc.toLowerCase().indexOf(form.toLowerCase());
  return i < 0 ? esc : `${esc.slice(0, i)}<b>${esc.slice(i, i + form.length)}</b>${esc.slice(i + form.length)}`;
}

/** `deck`: etiqueta común de todas las notas (p. ej. «elliniko» o «espanol», IDI-3) */
export function vocabToCsv(items: Lexeme[], opts: { states?: Lexeme['state'][]; deck?: string } = {}): string {
  const states = new Set(opts.states ?? ['learning', 'known']);
  const lines = [
    '#separator:Comma',
    '#html:true',
    '#notetype:Basic',
    '#columns:Front,Back,Tags',
  ];
  for (const x of items) {
    if (!states.has(x.state)) continue;
    const front = x.sourceSentence ? `${x.lemma}<br><small>${highlight(x.sourceSentence, x.sourceForm)}</small>` : x.lemma;
    const back = [x.translation ?? '', x.notes ? `<br><i>${x.notes}</i>` : ''].join('');
    const tags = [opts.deck ?? 'elliniko', x.state, x.isExpression ? 'expression' : ''].filter(Boolean).join(' ');
    lines.push([cell(front), cell(back), cell(tags)].join(','));
  }
  return lines.join('\n') + '\n';
}
