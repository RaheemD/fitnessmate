/* Basic service worker for Fitmate PWA */
const CACHE_NAME = 'fitmate-cache-v1';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/workout.html',
  '/manifest.webmanifest',
  '/Gym.mp3'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(CORE_ASSETS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.map((k) => (k !== CACHE_NAME ? caches.delete(k) : null)))).then(() => self.clients.claim())
  );
});

// Network-first for HTML, cache-first for others
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const isHTML = request.headers.get('accept')?.includes('text/html');

  if (isHTML) {
    event.respondWith(
      fetch(request)
        .then((resp) => {
          const respClone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, respClone)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match(request))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request)
        .then((resp) => {
          const respClone = resp.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(request, respClone)).catch(() => {});
          return resp;
        })
        .catch(() => caches.match('/index.html'));
    })
  );
});
