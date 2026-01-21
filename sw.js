const CACHE_NAME = 'kopala-fpl-v2'; // Incremented version
const PLAYER_IMG_CACHE = 'fpl-player-photos-v1';

const STATIC_ASSETS = [
  '/',
  'index.html',
  'leagues.html',
  'prices.html',
  'games.html',
  'members.html',
  'manifest.json',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css'
];

// 1. Install - Cache all app pages and UI assets
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

// 2. Activate - Clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME && key !== PLAYER_IMG_CACHE)
            .map(key => caches.delete(key))
      );
    })
  );
});

// 3. Fetch Logic
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // STRATEGY FOR PLAYER PHOTOS & SHIRTS (Cache First)
  if (url.href.includes('premierleague/photos') || url.href.includes('dist/img/shirts')) {
    event.respondWith(
      caches.open(PLAYER_IMG_CACHE).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) return cachedResponse;
          return fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
  } 
  
  // STRATEGY FOR APP PAGES (Stale-While-Revalidate)
  // Loads from cache instantly, updates in background
  else if (STATIC_ASSETS.some(asset => url.pathname.endsWith(asset) || url.pathname === '/')) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        const fetchPromise = fetch(event.request).then((networkResponse) => {
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, networkResponse.clone());
          });
          return networkResponse;
        });
        return cachedResponse || fetchPromise;
      })
    );
  }

  // DEFAULT LOGIC (Network First for API/Proxy calls)
  else {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});
