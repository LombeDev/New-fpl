const CACHE_NAME = 'kopala-fpl-v1';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/app.js',
  '/manifest.json',
  '/icon-192.png'
];

// 1. Install Event: Pre-cache static UI files
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

// 2. Fetch Event: Smart Caching
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strategy A: Static Assets (Cache-First)
  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(event.request).then((res) => res || fetch(event.request))
    );
    return;
  }

  // Strategy B: FPL API Proxy (Stale-While-Revalidate)
  if (url.pathname.includes('fpl-proxy')) {
    event.respondWith(
      caches.open('fpl-api-cache').then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          const fetchPromise = fetch(event.request).then((networkResponse) => {
            // Update the cache with new data for next time
            if (networkResponse.ok) {
              cache.put(event.request, networkResponse.clone());
            }
            return networkResponse;
          });
          // Return cached data immediately, or wait for network if nothing is cached
          return cachedResponse || fetchPromise;
        });
      })
    );
  }
});
