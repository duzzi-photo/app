/* ============================================================
   duzzi photo — Service Worker
   ============================================================ */

const CACHE_NAME = 'duzzi-photo-v1';

// Recursos que serão cacheados na instalação (shell do app)
const SHELL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Recursos externos que serão cacheados no primeiro uso
const RUNTIME_CACHE_PATTERNS = [
  'fonts.googleapis.com',
  'fonts.gstatic.com',
  'cdn.tailwindcss.com',
  'unpkg.com'
];

/* ── Instalação: cacheia o shell do app ── */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(SHELL_ASSETS);
    }).then(() => self.skipWaiting())
  );
});

/* ── Ativação: remove caches antigos ── */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

/* ── Fetch: Cache First para shell, Network First para o resto ── */
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Ignora requests que não sejam GET
  if (request.method !== 'GET') return;

  // Ignora requests de extensões do browser
  if (url.protocol === 'chrome-extension:') return;

  const isExternalLibrary = RUNTIME_CACHE_PATTERNS.some((pattern) =>
    url.hostname.includes(pattern)
  );

  if (isExternalLibrary) {
    // Cache First para bibliotecas externas (CDN)
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
  } else {
    // Network First para o app shell — com fallback para cache
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => caches.match(request))
    );
  }
});
