const CACHE_NAME = 'kopala-fpl-v2'; 
const PLAYER_IMG_CACHE = 'fpl-player-photos-v1';
const MONTH_IN_MS = 30 * 24 * 60 * 60 * 1000; // 30 Days

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

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // UPDATED STRATEGY: SHIRTS & PHOTOS
  // Now specifically checks for the 'draft.premierleague' or 'shirts' path
  if (url.href.includes('premierleague/photos') || url.href.includes('shirts/standard')) {
    event.respondWith(
      caches.open(PLAYER_IMG_CACHE).then(async (cache) => {
        const cachedResponse = await cache.match(event.request);
        const now = Date.now();

        if (cachedResponse) {
          // Check if cached item is older than 30 days
          const dateHeader = cachedResponse.headers.get('date');
          const fetchedDate = dateHeader ? new Date(dateHeader).getTime() : 0;
          
          if (now - fetchedDate < MONTH_IN_MS) {
            return cachedResponse;
          }
        }

        // Fetch new and cache
        return fetch(event.request).then((networkResponse) => {
          cache.put(event.request, networkResponse.clone());
          return networkResponse;
        });
      })
    );
  } 
  
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

  else {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
  }
});
