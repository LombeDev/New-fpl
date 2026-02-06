const CACHE_NAME = 'kopala-fpl-v4'; 
const JERSEY_CACHE = 'fpl-jerseys-v1';

const STATIC_ASSETS = [
  '/',
  'index.html',
  'leagues.html',
  'prices.html',
  'games.html',
  'prizes.html', // Added prizes
  'style.css',
  'nav.css',
  'footer.css',
  'nav.js',
  'footer.js',
  'manifest.json',
  // External Dependencies
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css',
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // mapping assets to ensure one failure doesn't stop the whole cache
      return Promise.allSettled(
        STATIC_ASSETS.map(asset => cache.add(asset))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== JERSEY_CACHE)
            .map(key => caches.delete(key))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // 1. JERSEY CACHING (Cache-First)
  // Targets the specific FPL jersey image paths
  if (url.hostname.includes('premierleague.com') && url.pathname.includes('shirts')) {
    event.respondWith(
      caches.open(JERSEY_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        if (cachedResponse) return cachedResponse;

        return fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            cache.put(event.request, networkResponse.clone());
          }
          return networkResponse;
        });
      })
    );
  } 
  
  // 2. APP SHELL (Stale-While-Revalidate)
  // Serves CSS/JS/HTML from cache immediately, then updates in background
  else if (STATIC_ASSETS.some(asset => url.pathname.endsWith(asset) || url.pathname === '/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          if (networkResponse.status === 200) {
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(event.request, networkResponse.clone());
            });
          }
          return networkResponse;
        });
        return cachedResponse || fetchPromise;
      })
    );
  }

  // 3. LIVE DATA (Network-First)
  // Points, leagues, and prices should always try the network first
  else {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});
