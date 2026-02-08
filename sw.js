lconst CACHE_NAME = 'kopala-fpl-v5'; // Update this to v6 when you change your CSS
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

// 1. INSTALL: Force-cache the App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // addAll is strict; use map with settled if you have unstable assets
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 2. ACTIVATE: Enable Navigation Preload
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      // Clean up old caches
      caches.keys().then((keys) => {
        return Promise.all(
          keys.filter(key => key !== CACHE_NAME && key !== JERSEY_CACHE)
              .map(key => caches.delete(key))
        );
      }),
      // Tells the browser to start fetching data parallel to SW boot
      self.registration.navigationPreload ? self.registration.navigationPreload.enable() : Promise.resolve()
    ]).then(() => self.clients.claim())
  );
});

// 3. FETCH: The Logic that Kills the Loading Bar
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // A. STATIC FILES (Cache-First)
  // If the file is in our shell list, return it from disk immediately.
  // This is what prevents the Chrome progress bar.
  if (STATIC_ASSETS.some(asset => url.pathname.endsWith(asset) || url.pathname === '/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        return cachedResponse || fetch(event.request);
      })
    );
  } 

  // B. LIVE DATA (Network-First with Preload)
  // For FPL data, we want fresh info, but use Preload for speed.
  else {
    event.respondWith(
      (async () => {
        const cachedResponse = await caches.match(event.request);
        
        // Try the navigation preload response first (fastest for 2026 browsers)
        const preloadResponse = await event.preloadResponse;
        if (preloadResponse) return preloadResponse;

        try {
          const networkResponse = await fetch(event.request);
          return networkResponse;
        } catch (err) {
          // Fallback to cache if the user is in a lift or basement
          return cachedResponse;
        }
      })()
    );
  }
});