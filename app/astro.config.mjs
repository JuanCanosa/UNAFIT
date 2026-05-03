// @ts-check
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  output: 'server',
  site: 'https://unafit.com.br',
  security: {
    checkOrigin: false,
  },
  adapter: node({
    mode: 'standalone',
  }),
  vite: {
    plugins: [
      VitePWA({
        registerType: 'autoUpdate',
        // Em SSR com Node adapter, o service worker gerencia apenas assets estáticos
        // (rotas são sempre server-side — sem navigateFallback)
        injectRegister: 'script',
        strategies: 'generateSW',
        workbox: {
          // Cacheia apenas assets estáticos — JS, CSS, imagens, fontes
          globPatterns: ['**/*.{js,css,html,ico,png,svg,webp,woff,woff2}'],
          // Não tenta servir rotas SSR pelo SW
          navigateFallback: null,
          // Desabilita pre-caching de navegação para evitar conflito com SSR
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              // Cache de fontes do Google
              urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
              handler: 'CacheFirst',
              options: {
                cacheName: 'google-fonts-cache',
                expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
                cacheableResponse: { statuses: [0, 200] },
              },
            },
            {
              // Cache de imagens do Supabase Storage
              urlPattern: /^https:\/\/.*\.supabase\.co\/storage\/.*/i,
              handler: 'StaleWhileRevalidate',
              options: {
                cacheName: 'supabase-storage-cache',
                expiration: { maxEntries: 50, maxAgeSeconds: 60 * 60 * 24 * 7 },
              },
            },
          ],
        },
        manifest: {
          name: 'UNAFIT - Gestão de Academias',
          short_name: 'UNAFIT',
          description: 'Sistema de gestão para academias de CrossFit e modalidades funcionais.',
          theme_color: '#000000',
          background_color: '#000000',
          display: 'standalone',
          orientation: 'portrait-primary',
          scope: '/',
          start_url: '/dashboard',
          lang: 'pt-BR',
          icons: [
            {
              src: '/icon-unafit-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any maskable',
            },
            {
              src: '/icon-unafit-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any maskable',
            },
          ],
        },
        devOptions: {
          enabled: false, // ativa em dev se quiser testar SW localmente
        },
      }),
    ],
  },
});
