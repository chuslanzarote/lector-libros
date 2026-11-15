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
        name: 'Ellinikó — lector de griego',
        short_name: 'Ellinikó',
        description: 'Lector de griego moderno con traducción al tocar. Offline.',
        lang: 'es',
        start_url: './',
        scope: './',
        display: 'standalone',
        background_color: '#f7f3ea',
        theme_color: '#1f4e79',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // El diccionario (5 MB) se guarda en IndexedDB al primer arranque; además lo
        // precacheamos para poder reinstalarlo sin red tras borrar datos.
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest,json,gz}'],
        maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
        navigateFallback: 'index.html',
      },
    }),
  ],
  worker: { format: 'es' },
});
