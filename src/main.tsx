import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app.tsx';
import { Welcome } from './screens/Welcome.tsx';
import { hasProfile } from './profile.ts';
import { uiLang } from './i18n/index.ts';
// MAR-2: fuentes de la marca servidas por la propia app (offline)
import '@fontsource-variable/source-serif-4/opsz.css';
import '@fontsource/fira-sans/400.css';
import '@fontsource/fira-sans/400-italic.css';
import '@fontsource/fira-sans/500.css';
import './styles.css';

registerSW({ immediate: true });
// Pide almacenamiento persistente para que el navegador no borre libros ni vocabulario
navigator.storage?.persist?.().catch(() => {});

document.documentElement.lang = uiLang();
// IDI-1: la primera vez se eligen los idiomas; después se abre la base de datos de ese idioma
render(hasProfile ? <App /> : <Welcome />, document.getElementById('app')!);
