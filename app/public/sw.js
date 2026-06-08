// Service worker mínimo — satisfaz o critério de instalabilidade PWA.
// O app é SSR puro (Node.js), então não há cache offline intencional;
// todas as requisições passam pela rede normalmente.
const CACHE_NAME = 'unafit-shell-v1';
const OFFLINE_ASSETS = ['/icon-unafit-192x192.png', '/icon-unafit-512x512.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(OFFLINE_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  // Passa tudo pela rede — app SSR não tem rota offline
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});
