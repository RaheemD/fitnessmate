/* Enhanced service worker for FitnessMate PWA */
const CACHE_NAME = 'fitnessmate-cache-v3';
const CORE_ASSETS = [
  '/', 
  '/index.html',
  '/workout.html',
  '/manifest.webmanifest',
  '/Gym.mp3',

  // ✅ include your actual asset paths below (adjust filenames if needed)
  '/styles.css',
  '/script.js',
  '/icons/icon-192.png',
  '/icons/icon-512.png'
];

// Install: cache core assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

// Activate: clean old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch: cache-first for static files, network-first for HTML
self.addEventListener('fetch', (event) => {
  const req = event.request;
  const isHTML = req.headers.get('accept')?.includes('text/html');

  if (isHTML) {
    // Network-first for HTML pages
    event.respondWith(
      fetch(req)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
          return res;
        })
        .catch(() => caches.match(req))
    );
  } else {
    // Cache-first for CSS, JS, images, audio, etc.
    event.respondWith(
      caches.match(req).then((cached) => {
        if (cached) return cached;
        return fetch(req)
          .then((res) => {
            const clone = res.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(req, clone));
            return res;
          })
          .catch(() => {
            // fallback to homepage if offline and asset missing
            if (req.destination === 'document') return caches.match('/');
          });
      })
    );
  }
});
