import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  base: '/word-search/',
  plugins: [
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Word Search',
        short_name: 'Word Search',
        description: 'A touch-friendly word search puzzle game by Vic Lee',
        theme_color: '#4a6cf7',
        background_color: '#f6f4ef',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/word-search/',
        start_url: '/word-search/',
        icons: [
          { src: 'pwa-64x64.png',            sizes: '64x64',   type: 'image/png' },
          { src: 'pwa-192x192.png',           sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png',           sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,json,mp3}'],
      },
    }),
  ],
});
