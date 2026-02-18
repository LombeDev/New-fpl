const CACHE_NAME = 'kopala-fpl-v7'; 
const JERSEY_CACHE = 'fpl-jerseys-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/leagues.html',
  '/prices.html',
  '/games.html',
  '/prizes.html',
  '/style.css',
  '/nav.css',
  '/footer.css',
  '/nav.js',
  '/footer.js',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // We use map to attempt to add files individually 
      // so we can see which one fails in the console.
      return Promise.all(
        STATIC_ASSETS.map(url => {
          return cache.add(url).catch(err => console.error(`Failed to cache: ${url}`, err));
        })
      );
    })
  );
  self.skipWaiting();
});


// 1. Activation - Cleanup old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== JERSEY_CACHE)
            .map(key => caches.delete(key))
      );
    })
  );
  return self.clients.claim();
});

// 2. Fetch Handler (Essential for Standalone Mode)
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Strategy for Jerseys: Cache then Network
  if (url.hostname.includes('premierleague.com')) {
    event.respondWith(
      caches.open(JERSEY_CACHE).then((cache) => {
        return cache.match(event.request).then((response) => {
          return response || fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
    return;
  }

  // General Strategy: Cache First, fallback to Network
  event.respondWith(
    caches.match(event.request).then((response) => {
      return response || fetch(event.request);
    })
  );
});
