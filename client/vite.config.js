import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Habit Tracker',
        short_name: 'Habit Tracker',
        description: 'Track daily habits and challenges with friends',
        start_url: '/',
        display: 'standalone',
        background_color: '#0d0b0a',
        theme_color: '#ff8c42',
        orientation: 'portrait',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }
        ]
      },
      workbox: {
        // App shell (JS/CSS/HTML/icons) is precached for instant loads + offline access.
        // /api/* is deliberately left uncached (NetworkOnly, the Workbox default for
        // anything not matched by a runtime rule) — habit progress, leaderboards, and
        // challenge state must always be live, never served stale from cache.
        globPatterns: ['**/*.{js,css,html,svg,png,ico}']
      }
    })
  ],
  server: {
    port: 5183,
    strictPort: false,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  },
  preview: {
    port: 5183,
    proxy: {
      '/api': 'http://localhost:3000'
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false
  }
});
