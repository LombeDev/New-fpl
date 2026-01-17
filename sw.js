const CACHE_NAME = 'kopala-fpl-v1';
const PLAYER_IMG_CACHE = 'fpl-player-photos-v1';

const STATIC_ASSETS = [
  '/',
  'index.html',
  'style.css',
  'script.js' 
];

// 1. Install - Cache local UI files
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

// 2. Fetch - Handle local files and Player Photos
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // LOGIC FOR PLAYER PHOTOS (Cache for 30 days)
  if (url.includes('premierleague/photos/players')) {
    event.respondWith(
      caches.open(PLAYER_IMG_CACHE).then((cache) => {
        return cache.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            // Check age of cached image
            const dateHeader = cachedResponse.headers.get('date');
            const age = dateHeader ? (Date.now() - new Date(dateHeader).getTime()) : 0;
            
            // If image is less than 30 days old, return it
            if (age < 2592000000) { 
              return cachedResponse;
            }
          }

          // If not in cache or too old, fetch and store
          return fetch(event.request).then((networkResponse) => {
            cache.put(event.request, networkResponse.clone());
            return networkResponse;
          });
        });
      })
    );
  } 
  
  // LOGIC FOR REGULAR FILES (index.html, etc.)
  else {
    event.respondWith(
      caches.match(event.request).then((res) => {
        return res || fetch(event.request);
      })
    );
  }
});
