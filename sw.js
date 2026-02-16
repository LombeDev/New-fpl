const CACHE_NAME = 'kopala-fpl-v6'; 
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
  '/deadline.js',
  '/transfers.js',
  '/manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap'
];

// 1. INSTALL: Save the shell to the phone
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// 2. ACTIVATE: Clean old versions
self.addEventListener('activate', (event) => {
  event.waitUntil(
    Promise.all([
      caches.keys().then((keys) => {
        return Promise.all(
          keys.filter(key => key !== CACHE_NAME && key !== JERSEY_CACHE)
              .map(key => caches.delete(key))
        );
      }),
      self.registration.navigationPreload ? self.registration.navigationPreload.enable() : Promise.resolve()
    ]).then(() => self.clients.claim())
  );
});

// 3. FETCH: The "Instant Load" Logic
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests like analytics if you have any
  if (!event.request.url.startsWith(self.location.origin) && !event.request.url.includes('cdnjs')) {
    return;
  }

  event.respondWith(
    (async () => {
      // THE KEY FIX: Try to find a match ignoring URL parameters (?from=pwa)
      const cachedResponse = await caches.match(event.request, { ignoreSearch: true });
      
      // If it's in the cache, return it INSTANTLY (This kills the loading bar)
      if (cachedResponse) {
        return cachedResponse;
      }

      // If not in cache (like FPL API data), try the network
      try {
        const preloadResponse = await event.preloadResponse;
        if (preloadResponse) return preloadResponse;

        return await fetch(event.request);
      } catch (err) {
        // Fallback for when there's no internet
        return new Response("Offline - Check your connection", { status: 503 });
      }
    })()
  );
});