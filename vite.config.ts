import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  // A relative base means the built app runs from any sub-path,
  // e.g. GitHub Pages /wanderlog/, Netlify, Vercel or a local preview server.
  base: './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      includeAssets: ['icons/favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        id: './',
        name: 'Wanderlog — Travel Journal',
        short_name: 'Wanderlog',
        description:
          'An offline-first travel journal. Pin the places you visit, keep the photos and stories, and see your journey on a map.',
        lang: 'en-GB',
        dir: 'ltr',
        theme_color: '#0e5c4a',
        background_color: '#f5efe2',
        display: 'standalone',
        orientation: 'portrait',
        scope: './',
        start_url: '.',
        categories: ['travel', 'lifestyle', 'photo'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: 'icons/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,jpg,jpeg,webp,woff2}'],
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Map tiles are cached as they are viewed, so places you have
            // already explored still render when you are offline.
            urlPattern: /^https:\/\/[abc]\.tile\.openstreetmap\.org\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'osm-tiles',
              expiration: { maxEntries: 600, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Reverse geocoding results are also cached by the app itself
            // (see src/lib/geocode.ts); this is a second safety net.
            urlPattern: /^https:\/\/nominatim\.openstreetmap\.org\/.*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'geocoding',
              networkTimeoutSeconds: 6,
              expiration: { maxEntries: 80, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
})
