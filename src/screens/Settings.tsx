// Ajustes: idiomas (IDI-1), tema, letra, traductor (LEC-4, IDI-4), backup (SYS-2), diccionario y créditos.
import { useState } from 'preact/hooks';
import { db } from '../db.ts';
import { toast, useLive, useSettings } from '../hooks.ts';
import { BackupLangError, backupFileName, exportBackup, importBackup } from '../lib/backup.ts';
import { pickFile, shareOrDownload, translators } from '../lib/platform.ts';
import { ENDONYM } from '../lib/langs.ts';
import { profile } from '../profile.ts';
import { fmtDate, fmtNum, t } from '../i18n/index.ts';
import { dictMeta } from '../dict.ts';
import { IconDownload, IconUpload } from '../components/icons.tsx';

export function SettingsScreen({ dictVersion, onReinstall }: { dictVersion: string; onReinstall: () => void }) {
  const [s, set] = useSettings();
  const [withBooks, setWithBooks] = useState(true);
  const books = useLive(() => db.books.count(), []);
  const TR = translators(profile);
  const custom = s.translatorUrl !== TR.google && s.translatorUrl !== TR.deepl;
  const meta = dictMeta();

  const doExport = async () => {
    const data = await exportBackup(db, { includeBooks: withBooks, lang: profile.target });
    const blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    await shareOrDownload(blob, backupFileName(new Date(), profile.target), t('settings.shareTitle', { app: 'Ellinikó' }));
    toast(t('settings.exported'), 4500);
  };

  const doImport = async () => {
    const f = await pickFile('.json,application/json');
    if (!f) return;
    try {
      const rep = await importBackup(db, JSON.parse(await f.text()), profile.target);
      toast(t('settings.merged', { added: rep.added, updated: rep.updated, kept: rep.kept }), 5000);
    } catch (e) {
      toast(
        e instanceof BackupLangError ? t('settings.importOtherLang', { lang: ENDONYM[e.lang] }) : t('settings.importError', { msg: (e as Error).message }),
        5000,
      );
    }
  };

  return (
    <>
      <header class="topbar"><h1>{t('tab.settings')}</h1></header>
      <main>
        <div class="section-title">{t('settings.languages')}</div>
        <div class="card">
          <div class="row">
            <span class="spacer">{t('settings.learning')}</span>
            <strong lang={profile.target}>{ENDONYM[profile.target]}</strong>
          </div>
          <div class="row" style={{ marginTop: 6 }}>
            <span class="spacer">{t('settings.yourLang')}</span>
            <strong lang={profile.ui}>{ENDONYM[profile.ui]}</strong>
          </div>
          <p class="small muted">{t('settings.langNote')}</p>
          <a class="btn small" href="#/idiomas">{t('settings.changeLang')}</a>
        </div>

        <div class="section-title">{t('settings.reading')}</div>
        <div class="card">
          <div class="row">
            <span class="spacer">{t('settings.theme')}</span>
            <div class="seg" role="radiogroup" aria-label={t('settings.theme')}>
              {(['auto', 'light', 'dark'] as const).map((th) => (
                <button key={th} class={s.theme === th ? 'on' : ''} role="radio" aria-checked={s.theme === th} onClick={() => set('theme', th)}>
                  {t(`settings.theme.${th}`)}
                </button>
              ))}
            </div>
          </div>
          <label class="field">
            <span>{t('settings.fontSize', { px: s.fontSize })}</span>
            <input type="range" min={14} max={34} value={s.fontSize} onInput={(e) => set('fontSize', Number(e.currentTarget.value))} style={{ width: '100%' }} />
          </label>
          <label class="field">
            <span>{t('settings.lineHeight', { lh: fmtNum(s.lineHeight, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) })}</span>
            <input type="range" min={1.3} max={2.2} step={0.05} value={s.lineHeight} onInput={(e) => set('lineHeight', Number(e.currentTarget.value))} style={{ width: '100%' }} />
          </label>
          <p class="reader" lang={profile.target} style={{ fontSize: s.fontSize, lineHeight: s.lineHeight, margin: '4px 0' }}>
            {profile.target === 'es' ? (
              <>En un <span class="w new">lugar</span> de la Mancha, de cuyo nombre no quiero <span class="w learning">acordarme</span>…</>
            ) : (
              <>Πρώτος ο <span class="w new">Φάνης</span> την <span class="w learning">είδε</span>.</>
            )}
          </p>
          <label class="row" style={{ marginTop: 12 }}>
            <input type="checkbox" checked={s.autoSpeak} onChange={(e) => set('autoSpeak', e.currentTarget.checked)} />
            <span>{t('settings.autoSpeak')}</span>
          </label>
        </div>

        <div class="section-title">{t('settings.translator')}</div>
        <div class="card">
          <div class="seg" role="radiogroup" aria-label={t('settings.translatorAria')}>
            <button class={s.translatorUrl === TR.google ? 'on' : ''} onClick={() => set('translatorUrl', TR.google)}>Google</button>
            <button class={s.translatorUrl === TR.deepl ? 'on' : ''} onClick={() => set('translatorUrl', TR.deepl)}>DeepL</button>
            <button class={custom ? 'on' : ''} onClick={() => !custom && set('translatorUrl', 'https://')}>{t('settings.translatorOther')}</button>
          </div>
          <label class="field">
            <span>{t('settings.translatorUrl')}</span>
            <input type="url" value={s.translatorUrl} onChange={(e) => set('translatorUrl', e.currentTarget.value)} />
          </label>
        </div>

        <div class="section-title">{t('settings.backup')}</div>
        <div class="card">
          <p class="small" style={{ marginTop: 0 }}>
            {t('settings.backupIntro', { books: books ? t('settings.backupIntroBooks') : '' })}
          </p>
          <label class="row" style={{ marginBottom: 12 }}>
            <input type="checkbox" checked={withBooks} onChange={(e) => setWithBooks(e.currentTarget.checked)} />
            <span>{t('settings.includeBooks', { n: books ?? 0 })}</span>
          </label>
          <div class="row">
            <button class="btn primary" onClick={doExport}><IconDownload width={18} /> {t('settings.export')}</button>
            <button class="btn" onClick={doImport}><IconUpload width={18} /> {t('settings.import')}</button>
          </div>
        </div>

        <div class="section-title">{t('settings.dictionary')}</div>
        <div class="card small">
          <div>
            {t('settings.dictVersion', { v: dictVersion })}
            {meta && t('settings.dictCounts', { lemmas: meta.counts.lemmas ?? 0, forms: meta.counts.forms ?? 0 })}
          </div>
          <div class="muted">{t('settings.installed', { date: meta ? fmtDate(meta.loadedAt) : '—' })}</div>
          <button class="btn small" style={{ marginTop: 10 }} onClick={() => confirm(t('settings.reinstallConfirm')) && onReinstall()}>{t('settings.reinstall')}</button>
        </div>

        <div class="section-title">{t('settings.about')}</div>
        <div class="card small">
          <p style={{ marginTop: 0 }}>{t('settings.aboutText')}</p>
          <a class="btn small" href="#/creditos">{t('settings.credits')}</a>
        </div>
      </main>
    </>
  );
}
