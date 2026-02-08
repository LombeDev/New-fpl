const CACHE_NAME = 'kopala-fpl-v5'; // Increment this to force updates
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

// 1. INSTALL: Pre-cache the App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        STATIC_ASSETS.map(asset => cache.add(asset))
      );
    })
  );
  self.skipWaiting();
});

// 2. ACTIVATE: Cleanup old caches & Enable Navigation Preload
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Cleanup old versions
      caches.keys().then((keys) => {
        return Promise.all(
          keys.filter(key => key !== CACHE_NAME && key !== JERSEY_CACHE)
              .map(key => caches.delete(key))
        );
      }),
      // Enable Navigation Preload to kill the startup delay
      self.registration.navigationPreload ? self.registration.navigationPreload.enable() : Promise.resolve()
    ]).then(() => self.clients.claim())
  );
});

// 3. FETCH: Smart Caching Strategies
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // A. JERSEY CACHING (Cache-First)
  if (url.hostname.includes('premierleague.com') && url.pathname.includes('shirts')) {
    event.respondWith(
      caches.open(JERSEY_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        return cachedResponse || fetch(event.request).then((networkResponse) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
    );
  } 
  
  // B. APP SHELL (Cache-First - THIS KILLS THE LOADING BAR)
  // We serve local files immediately so Chrome doesn't show a progress bar.
  else if (STATIC_ASSETS.some(asset => url.pathname.endsWith(asset) || url.pathname === '/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || fetch(event.request);
      })
    );
  }

  // C. LIVE DATA & NAVIGATION (Network-First with Preload)
  else {
    event.respondWith(
      (async () => {
        // Try the preloaded response first
        const preloadResponse = await event.preloadResponse;
        if (preloadResponse) return preloadResponse;

        // Otherwise, try network, fallback to cache
        try {
          return await fetch(event.request);
        } catch (err) {
          return caches.match(event.request);
        }
      })()
    );
  }
});