import { render } from 'preact';
import { registerSW } from 'virtual:pwa-register';
import { App } from './app.tsx';
import './styles.css';

registerSW({ immediate: true });
// Pide almacenamiento persistente para que el navegador no borre libros ni vocabulario
navigator.storage?.persist?.().catch(() => {});

render(<App />, document.getElementById('app')!);
