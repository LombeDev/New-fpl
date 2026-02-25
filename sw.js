/* ============================================================
   KOPALA FPL — SERVICE WORKER
   Strategy: Network-first for HTML, cache-first for assets
   ============================================================ */

const CACHE_NAME    = 'kopala-fpl-v2';
const RUNTIME_CACHE = 'kopala-runtime-v2';

// App shell — everything needed to render offline
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/leagues.html',
  '/prices.html',
  '/games.html',
  '/style.css',
  '/nav.css',
  '/nav.js',
  '/footer.css',
  '/footer.js',
  '/deadline.js',
  '/transfers.js',
  '/logo.png',
  '/manifest.json',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css',
];

/* ── INSTALL: precache app shell ─────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      // Cache each URL individually so one 404 never aborts the whole install
      const attempts = PRECACHE_URLS.map(url =>
        fetch(url, { cache: 'reload' })
          .then(res => {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return cache.put(url, res);
          })
          .catch(err => console.warn('[SW] Skipped:', url, '-', err.message))
      );
      return Promise.allSettled(attempts);
    }).then(() => self.skipWaiting())
  );
});

/* ── ACTIVATE: clean old caches ──────────────────────────── */
self.addEventListener('activate', event => {
  const CURRENT = [CACHE_NAME, RUNTIME_CACHE];
  event.waitUntil(
    caches.keys().then(names =>
      Promise.all(names.filter(n => !CURRENT.includes(n)).map(n => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

/* ── FETCH: tiered caching strategy ─────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;

  // ── BYPASS: let pwa.js manage its own requests ──────────
  // Requests with cache:'no-store' come from pwa.js's prefetch
  // and kflNavigate. Don't intercept — let them go straight to
  // the network so we don't interfere or cause Cache.put errors.
  if (request.cache === 'no-store') return;

  // ── BYPASS: only handle GET — Cache API rejects everything else ──
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // FPL API / Netlify functions → network-first, short cache
  if (url.pathname.includes('/.netlify/functions/') ||
      url.hostname.includes('fantasy.premierleague.com')) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE, 90));
    return;
  }

  // Google Fonts / FA CDN → cache-first (long lived)
  if (url.hostname.includes('fonts.gstatic') ||
      url.hostname.includes('cdnjs.cloudflare')) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  // FPL shirt images → cache-first
  if (url.hostname.includes('premierleague.com') ||
      url.pathname.includes('/img/shirts/')) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  // HTML documents → network-first (matches pwa.js intent)
  // Falls back to cache when offline so the app still works.
  if (request.destination === 'document') {
    event.respondWith(networkFirst(request, CACHE_NAME, 300));
    return;
  }

  // CSS / JS / images / other same-origin assets → cache-first
  // These are versioned/hashed by Netlify, so stale = correct.
  if (request.destination === 'script' ||
      request.destination === 'style'  ||
      request.destination === 'image'  ||
      url.origin === self.location.origin) {
    event.respondWith(cacheFirst(request, CACHE_NAME));
    return;
  }

  // Everything else → network with cache fallback
  event.respondWith(networkFirst(request, RUNTIME_CACHE, 60));
});

/* ── STRATEGIES ───────────────────────────────────────────── */

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response('', { status: 503 });
  }
}

async function networkFirst(request, cacheName, ttlSeconds = 60) {
  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      // Tag with timestamp for TTL checks
      const headers = new Headers(response.headers);
      headers.set('sw-cached-at', Date.now().toString());
      const tagged = new Response(await response.clone().arrayBuffer(), {
        status:     response.status,
        statusText: response.statusText,
        headers,
      });
      cache.put(request, tagged);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached; // serve stale when offline
    // Offline fallback for navigation
    if (request.destination === 'document') {
      return caches.match('/index.html');
    }
    return new Response(JSON.stringify({ error: 'offline' }), {
      status:  503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/* ── BACKGROUND SYNC for live data ───────────────────────── */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-live') {
    event.waitUntil(doBackgroundSync());
  }
});

async function doBackgroundSync() {
  const cache    = await caches.open(RUNTIME_CACHE);
  const keys     = await cache.keys();
  const liveKeys = keys.filter(k =>
    k.url.includes('event/') && k.url.includes('/live/')
  );
  await Promise.all(liveKeys.map(k => cache.delete(k)));
}

/* ── PUSH NOTIFICATIONS (future-ready) ───────────────────── */
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Kopala FPL', {
      body:    data.body    || '',
      icon:    '/android-chrome-192x192.png',
      badge:   '/android-chrome-192x192.png',
      vibrate: [200, 100, 200],
      data:    { url: data.url || '/' },
    })
  );
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(clientList => {
      const url = event.notification.data?.url || '/';
      for (const client of clientList) {
        if (client.url === url && 'focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
