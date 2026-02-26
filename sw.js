/* ============================================================
   KOPALA FPL — SERVICE WORKER
   Strategy: Cache-first for static assets ONLY.
   HTML is never cached — always fetched fresh from network.
   ============================================================ */

const CACHE_NAME    = 'kopala-fpl-v5';
const RUNTIME_CACHE = 'kopala-runtime-v5';

// Static assets only — NO HTML files.
const PRECACHE_URLS = [
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

/* ── INSTALL ─────────────────────────────────────────────── */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
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

/* ── ACTIVATE: delete old caches + purge any stale HTML ──── */
self.addEventListener('activate', event => {
  const CURRENT = [CACHE_NAME, RUNTIME_CACHE];
  event.waitUntil(
    caches.keys()
      .then(names =>
        Promise.all(names.filter(n => !CURRENT.includes(n)).map(n => caches.delete(n)))
      )
      .then(async () => {
        // Purge any HTML that snuck in from previous SW versions
        for (const name of [CACHE_NAME, RUNTIME_CACHE]) {
          const cache = await caches.open(name);
          const keys  = await cache.keys();
          await Promise.all(
            keys
              .filter(req => {
                const p = new URL(req.url).pathname;
                return p === '/' || p.endsWith('.html') || p.endsWith('/');
              })
              .map(req => cache.delete(req))
          );
        }
      })
      .then(() => self.clients.claim())
  );
});

/* ── FETCH ───────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;

  // Never cache sw.js or pwa.js — must always be fetched fresh
  // so updates deploy instantly without users getting stale script logic
  const url = new URL(request.url);
  if (url.pathname === '/sw.js' || url.pathname === '/pwa.js') return;

  // Let pwa.js manage its own no-store requests
  if (request.cache === 'no-store') return;

  // Cache API only supports GET
  if (request.method !== 'GET') return;

  // HTML documents — NEVER intercept, always go straight to network
  if (request.destination === 'document' ||
      url.pathname === '/' ||
      url.pathname.endsWith('.html')) return;

  // Netlify functions / FPL API → network-first
  if (url.pathname.includes('/.netlify/functions/') ||
      url.hostname.includes('fantasy.premierleague.com')) {
    event.respondWith(networkFirst(request, RUNTIME_CACHE, 90));
    return;
  }

  // Google Fonts / FA CDN / jerseys → cache-first (immutable)
  if (url.hostname.includes('fonts.gstatic')     ||
      url.hostname.includes('cdnjs.cloudflare')  ||
      url.hostname.includes('premierleague.com') ||
      url.pathname.includes('/img/shirts/')) {
    event.respondWith(cacheFirst(request, RUNTIME_CACHE));
    return;
  }

  // CSS / JS / images / same-origin assets → cache-first
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
      const cache   = await caches.open(cacheName);
      const headers = new Headers(response.headers);
      headers.set('sw-cached-at', Date.now().toString());
      const tagged  = new Response(await response.clone().arrayBuffer(), {
        status: response.status, statusText: response.statusText, headers,
      });
      cache.put(request, tagged);
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }
}

/* ── BACKGROUND SYNC ─────────────────────────────────────── */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-live') event.waitUntil(doBackgroundSync());
});

async function doBackgroundSync() {
  const cache    = await caches.open(RUNTIME_CACHE);
  const keys     = await cache.keys();
  const liveKeys = keys.filter(k => k.url.includes('event/') && k.url.includes('/live/'));
  await Promise.all(liveKeys.map(k => cache.delete(k)));
}

/* ── PUSH NOTIFICATIONS ──────────────────────────────────── */
self.addEventListener('push', event => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || 'Kopala FPL', {
      body: data.body || '', icon: '/android-chrome-192x192.png',
      badge: '/android-chrome-192x192.png', vibrate: [200, 100, 200],
      data: { url: data.url || '/' },
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
