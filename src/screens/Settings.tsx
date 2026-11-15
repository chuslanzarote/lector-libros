// Ajustes: tema, letra, traductor (LEC-4), backup (SYS-2), diccionario y créditos.
import { useState } from 'preact/hooks';
import { db } from '../db.ts';
import { toast, useLive, useSettings } from '../hooks.ts';
import { backupFileName, exportBackup, importBackup } from '../lib/backup.ts';
import { pickFile, shareOrDownload, TRANSLATORS } from '../lib/platform.ts';
import { dictMeta } from '../dict.ts';
import { IconDownload, IconUpload } from '../components/icons.tsx';

export function SettingsScreen({ dictVersion, onReinstall }: { dictVersion: string; onReinstall: () => void }) {
  const [s, set] = useSettings();
  const [withBooks, setWithBooks] = useState(true);
  const books = useLive(() => db.books.count(), []);
  const custom = s.translatorUrl !== TRANSLATORS.google && s.translatorUrl !== TRANSLATORS.deepl;
  const meta = dictMeta();

  const doExport = async () => {
    const data = await exportBackup(db, { includeBooks: withBooks });
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    await shareOrDownload(blob, backupFileName(), 'Backup de Ellinikó');
    toast('Backup exportado. Guárdalo en iCloud o Drive para pasarlo a otro dispositivo.', 4500);
  };

  const doImport = async () => {
    const f = await pickFile('.json,application/json');
    if (!f) return;
    try {
      const rep = await importBackup(db, JSON.parse(await f.text()));
      toast(`Backup fusionado: ${rep.added} nuevos, ${rep.updated} actualizados, ${rep.kept} sin cambios`, 5000);
    } catch (e) {
      toast(`No se pudo importar: ${(e as Error).message}`, 5000);
    }
  };

  return (
    <>
      <header class="topbar"><h1>Ajustes</h1></header>
      <main>
        <div class="section-title">Lectura</div>
        <div class="card">
          <div class="row">
            <span class="spacer">Tema</span>
            <div class="seg" role="radiogroup" aria-label="Tema">
              {(['auto', 'light', 'dark'] as const).map((t) => (
                <button key={t} class={s.theme === t ? 'on' : ''} role="radio" aria-checked={s.theme === t} onClick={() => set('theme', t)}>
                  {t === 'auto' ? 'Sistema' : t === 'light' ? 'Claro' : 'Oscuro'}
                </button>
              ))}
            </div>
          </div>
          <label class="field">
            <span>Tamaño de letra: {s.fontSize}px</span>
            <input type="range" min={14} max={34} value={s.fontSize} onInput={(e) => set('fontSize', Number(e.currentTarget.value))} style={{ width: '100%' }} />
          </label>
          <label class="field">
            <span>Interlineado: {s.lineHeight.toFixed(2)}</span>
            <input type="range" min={1.3} max={2.2} step={0.05} value={s.lineHeight} onInput={(e) => set('lineHeight', Number(e.currentTarget.value))} style={{ width: '100%' }} />
          </label>
          <p class="reader" lang="el" style={{ fontSize: s.fontSize, lineHeight: s.lineHeight, margin: '4px 0' }}>
            Πρώτος ο <span class="w new">Φάνης</span> την <span class="w learning">είδε</span>.
          </p>
          <label class="row" style={{ marginTop: 12 }}>
            <input type="checkbox" checked={s.autoSpeak} onChange={(e) => set('autoSpeak', e.currentTarget.checked)} />
            <span>Pronunciar la palabra al tocarla</span>
          </label>
        </div>

        <div class="section-title">Traductor externo (pulsación larga)</div>
        <div class="card">
          <div class="seg" role="radiogroup" aria-label="Traductor">
            <button class={s.translatorUrl === TRANSLATORS.google ? 'on' : ''} onClick={() => set('translatorUrl', TRANSLATORS.google)}>Google</button>
            <button class={s.translatorUrl === TRANSLATORS.deepl ? 'on' : ''} onClick={() => set('translatorUrl', TRANSLATORS.deepl)}>DeepL</button>
            <button class={custom ? 'on' : ''} onClick={() => !custom && set('translatorUrl', 'https://')}>Otro</button>
          </div>
          <label class="field">
            <span>URL ({'{q}'} se sustituye por la frase)</span>
            <input type="url" value={s.translatorUrl} onChange={(e) => set('translatorUrl', e.currentTarget.value)} />
          </label>
        </div>

        <div class="section-title">Copia de seguridad</div>
        <div class="card">
          <p class="small" style={{ marginTop: 0 }}>
            Exporta vocabulario, tarjetas, traducciones propias y ajustes{books ? ' (y, si quieres, los libros)' : ''}. Al importar se fusiona registro a registro: gana el cambio más reciente.
          </p>
          <label class="row" style={{ marginBottom: 12 }}>
            <input type="checkbox" checked={withBooks} onChange={(e) => setWithBooks(e.currentTarget.checked)} />
            <span>Incluir los libros ({books ?? 0})</span>
          </label>
          <div class="row">
            <button class="btn primary" onClick={doExport}><IconDownload width={18} /> Exportar backup</button>
            <button class="btn" onClick={doImport}><IconUpload width={18} /> Importar backup</button>
          </div>
        </div>

        <div class="section-title">Diccionario</div>
        <div class="card small">
          <div>Versión {dictVersion}{meta && ` · ${meta.counts.lemmas?.toLocaleString('es')} lemas · ${meta.counts.forms?.toLocaleString('es')} formas`}</div>
          <div class="muted">Instalado {meta ? new Date(meta.loadedAt).toLocaleString('es') : '—'}. Funciona sin conexión.</div>
          <button class="btn small" style={{ marginTop: 10 }} onClick={() => confirm('¿Reinstalar el diccionario? Tus datos no se tocan.') && onReinstall()}>Reinstalar diccionario</button>
        </div>

        <div class="section-title">Acerca de</div>
        <div class="card small">
          <p style={{ marginTop: 0 }}>Ellinikó es un lector personal y gratuito. Sin cuentas, sin servidor, sin IA: todo vive en este dispositivo.</p>
          <a class="btn small" href="#/creditos">Créditos y licencias</a>
        </div>
      </main>
    </>
  );
}
