/* Smart auto-caching service worker for FitnessMate PWA */
const CACHE_NAME = 'fitnessmate-auto-v4';

self.addEventListener('install', (event) => {
  // Activate immediately after install
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  // Remove old caches
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // Skip non-GET requests (like form posts)
  if (req.method !== 'GET') return;

  event.respondWith(
    caches.open(CACHE_NAME).then(async (cache) => {
      try {
        // Try network first
        const fresh = await fetch(req);
        // Cache a copy of successful responses (CSS/JS/images)
        if (fresh.ok && (fresh.type === 'basic' || fresh.type === 'cors')) {
          cache.put(req, fresh.clone());
        }
        return fresh;
      } catch (err) {
        // Fallback: use cache if offline
        const cached = await cache.match(req);
        if (cached) return cached;

        // Last resort: serve cached homepage
        if (req.mode === 'navigate') return cache.match('/');
        throw err;
      }
    })
  );
});
