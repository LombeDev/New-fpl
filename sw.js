const CACHE_NAME = 'kopala-fpl-v1';
// Only include files you are 100% sure exist in your folder
const STATIC_ASSETS = [
  '/',
  'index.html',
  'style.css',
  'script.js' 
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // We use a map to catch errors on individual files 
      // so one missing file doesn't break the whole app
      return Promise.allSettled(
        STATIC_ASSETS.map(asset => cache.add(asset))
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Standard fetch logic...
  event.respondWith(
    caches.match(event.request).then((res) => res || fetch(event.request))
  );
});
