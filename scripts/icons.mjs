// MAR-1 — genera los iconos de la PWA a partir del símbolo de eglosa (el bocadillo que habla).
// Uso: node scripts/icons.mjs   (necesita Playwright, ya instalado para los tests e2e)
import { chromium } from 'playwright';
import { writeFileSync } from 'node:fs';

const BUBBLE = '#2A47A6', MOUTH = '#141518', TONGUE = '#F5DF4D', BG = '#F5DF4D';
const symbol = (b = BUBBLE) =>
  `<path d="M26 66 L12 92 L42 78 Z" fill="${b}" stroke="${b}" stroke-width="4" stroke-linejoin="round"/>` +
  `<circle cx="50" cy="44" r="38" fill="${b}"/>` +
  `<path d="M31 33 H69 Q69 65 50 65 Q31 65 31 33 Z" fill="${MOUTH}"/>` +
  `<path d="M39 57 Q50 47 61 57 Q56 65 50 65 Q44 65 39 57 Z" fill="${TONGUE}"/>`;

// El símbolo ocupa x 10…88, y 6…94 (centro 49, 50). scale = fracción del lado.
const icon = ({ rx, scale }) => {
  const tx = 50 - 49 * scale, ty = 50 - 50 * scale;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100">` +
    `<rect width="100" height="100" rx="${rx}" fill="${BG}"/>` +
    `<g transform="translate(${tx.toFixed(2)} ${ty.toFixed(2)}) scale(${scale})">${symbol()}</g></svg>`;
};

// favicon: el símbolo solo, sin fondo
writeFileSync('public/icons/icon.svg', `<svg xmlns="http://www.w3.org/2000/svg" viewBox="3 4 92 92">${symbol()}</svg>\n`);

const targets = [
  { file: 'icon-192.png', size: 192, svg: icon({ rx: 22.5, scale: 0.74 }) },
  { file: 'icon-512.png', size: 512, svg: icon({ rx: 22.5, scale: 0.74 }) },
  // maskable: a sangre, con el símbolo dentro de la zona segura (círculo del 80 %)
  { file: 'icon-512-maskable.png', size: 512, svg: icon({ rx: 0, scale: 0.6 }) },
  // Apple redondea las esquinas por su cuenta
  { file: 'apple-touch-icon.png', size: 180, svg: icon({ rx: 0, scale: 0.74 }) },
];

const browser = await chromium.launch();
const page = await browser.newPage();
for (const t of targets) {
  await page.setViewportSize({ width: t.size, height: t.size });
  await page.setContent(`<style>html,body{margin:0;background:transparent}svg{display:block;width:${t.size}px;height:${t.size}px}</style>${t.svg}`);
  await page.screenshot({ path: `public/icons/${t.file}`, omitBackground: true });
  console.log('public/icons/' + t.file);
}
await browser.close();
