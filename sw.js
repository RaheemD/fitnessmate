// Simple, safe Service Worker for FitnessMate
const CACHE_NAME = 'fitnessmate-static-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icon-192.png',
  '/icon-512.png',
  '/sw.js'
];

// Install - cache essential static files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// Activate - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.map(k => (k !== CACHE_NAME ? caches.delete(k) : null)))
    )
  );
  self.clients.claim();
});

// Helper: network-first for HTML navigation & API; cache-first for static assets
self.addEventListener('fetch', event => {
  const req = event.request;
  const url = new URL(req.url);

  // Network-first for navigation (single page app) and for requests to /api/
  if (req.mode === 'navigate' || req.headers.get('accept')?.includes('text/html') || url.pathname.startsWith('/api/')) {
    event.respondWith(
      fetch(req)
        .then(res => {
          // Put a copy in cache for offline fallback — only cache full 200 responses
          try {
            if (
              req.method === 'GET' &&
              !req.headers.get('range') &&
              res && res.ok && res.status === 200 &&
              (res.type === 'basic' || res.type === 'cors')
            ) {
              const copy = res.clone();
              caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
            }
          } catch (_) {
            // Ignore caching errors (e.g., 206 partial content)
          }
          return res;
        })
        .catch(() =>
          caches.match(req).then(found => found || caches.match('/index.html'))
        )
    );
    return;
  }

  // For other same-origin requests: try cache then network
  if (url.origin === location.origin) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        // optionally cache fetched static files — only cache full 200 responses, skip Range
        try {
          if (
            req.method === 'GET' &&
            req.destination !== 'document' &&
            !req.headers.get('range') &&
            res && res.ok && res.status === 200 &&
            (res.type === 'basic' || res.type === 'cors')
          ) {
            const copy = res.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(req, copy)).catch(() => {});
          }
        } catch (_) {
          // Ignore caching errors
        }
        return res;
      }).catch(() => cached))
    );
  }
  // Let cross-origin requests go to network (no interference)
});
