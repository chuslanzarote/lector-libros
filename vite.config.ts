import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import { VitePWA } from 'vite-plugin-pwa';

// base relativa: funciona en GitHub Pages bajo cualquier nombre de repo (enrutado por hash)
export default defineConfig({
  base: './',
  plugins: [
    preact(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'eglosa — lector de griego y español',
        short_name: 'eglosa',
        description: 'Lector de griego moderno y de español con traducción al tocar. Offline.',
        lang: 'es',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#FAFAF7',
        theme_color: '#FAFAF7',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,json,gz,woff2}'],
        // Los diccionarios (5 y 7 MB, IDI) se descargan sólo para el idioma elegido y se guardan en
        // IndexedDB, que es lo que funciona sin conexión; precachearlos bajaría los dos a todo el mundo.
        // Los libros del catálogo (IMP-5) se descargan al añadirlos y también pasan a IndexedDB.
        // MAR-2: de las fuentes sólo se precachean latín, latín extendido y griego
        globIgnores: ['**/catalog/*/books/**', '**/dict/*/dict.json.gz', '**/*cyrillic*.woff2', '**/*vietnamese*.woff2'],
        maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  worker: { format: 'es' },
});
