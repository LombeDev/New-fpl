/* ============================================================
   KOPALA FPL — SERVICE WORKER
   Strategy: Network-first for everything.
   Falls back to cache when offline.
   ============================================================ */

const CACHE_NAME    = 'kopala-fpl-v7';
const RUNTIME_CACHE = 'kopala-runtime-v7';

// Static assets only — NO HTML files.
const PRECACHE_URLS = [
  '/style.css',
  '/nav.css',
  '/nav.js',
  '/nav-bottom.css',
  '/nav-bottom.js',
  '/footer.css',
  '/footer.js',
  '/deadline.js',
  '/transfers.js',
  '/badge.js',
  '/logo.png',
  '/manifest.json',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css',
];

// The FPL endpoint we want to keep warm in the background
const BOOTSTRAP_URL = '/.netlify/functions/fpl-proxy?endpoint=bootstrap-static/';

// Periodic sync tag — must match what pwa.js registers
const PBS_TAG = 'fpl-bootstrap-sync';

// How long a cached bootstrap response is considered fresh (1 hour)
const BOOTSTRAP_TTL_MS = 60 * 60 * 1000;

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

  // Never intercept sw.js or pwa.js — always fresh
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

  // bootstrap-static: serve from cache instantly, revalidate in background
  if (request.url.includes('bootstrap-static')) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE, BOOTSTRAP_TTL_MS));
    return;
  }

  // Everything else: network-first, falls back to cache when offline
  event.respondWith(networkFirst(request, RUNTIME_CACHE, 60));
});

/* ── STRATEGIES ───────────────────────────────────────────── */

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

/**
 * staleWhileRevalidate — used exclusively for bootstrap-static.
 *
 * 1. Returns the cached copy INSTANTLY (zero perceived load time).
 * 2. Always fires a background fetch to refresh the cache.
 * 3. If no cache exists yet, waits for the network (first visit).
 * 4. Notifies all open tabs when fresh data lands.
 */
async function staleWhileRevalidate(request, cacheName, ttlMs) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  // Fire revalidation in background regardless of staleness
  const revalidate = fetch(request).then(async res => {
    if (!res.ok) return res;
    const headers = new Headers(res.headers);
    headers.set('sw-cached-at', Date.now().toString());
    const tagged = new Response(await res.clone().arrayBuffer(), {
      status: res.status, statusText: res.statusText, headers,
    });
    await cache.put(request, tagged);
    notifyClients({ type: 'BOOTSTRAP_UPDATED', ts: Date.now() });
    return res;
  }).catch(() => null);

  // Serve cache immediately if available
  if (cached) return cached;

  // First visit — no cache yet, wait for network
  return revalidate;
}

/* ── NOTIFY CLIENTS ──────────────────────────────────────── */

async function notifyClients(message) {
  const allClients = await self.clients.matchAll({ includeUncontrolled: true });
  allClients.forEach(client => client.postMessage(message));
}

/* ── PERIODIC BACKGROUND SYNC ────────────────────────────── */
/**
 * The browser fires this automatically in the background
 * (typically every few hours on Wi-Fi + charging, per browser policy).
 *
 * It prefetches bootstrap-static so that when the user opens the app
 * next morning, prices + player stats are already in cache — zero wait.
 *
 * Registration happens in pwa.js after SW is ready.
 * Min interval we request: 3 hours (browser may enforce longer).
 */
self.addEventListener('periodicsync', event => {
  if (event.tag !== PBS_TAG) return;

  console.log('[SW] Periodic background sync fired — prefetching bootstrap-static');

  event.waitUntil(
    (async () => {
      try {
        const res = await fetch(BOOTSTRAP_URL);
        if (!res.ok) throw new Error('HTTP ' + res.status);

        const cache   = await caches.open(RUNTIME_CACHE);
        const headers = new Headers(res.headers);
        headers.set('sw-cached-at', Date.now().toString());
        const tagged  = new Response(await res.arrayBuffer(), {
          status: res.status, statusText: res.statusText, headers,
        });
        await cache.put(BOOTSTRAP_URL, tagged);

        console.log('[SW] bootstrap-static prefetched at', new Date().toISOString());
        notifyClients({ type: 'BOOTSTRAP_UPDATED', ts: Date.now() });

      } catch (err) {
        console.warn('[SW] Periodic sync failed:', err.message);
        // Browser will retry automatically on next opportunity
      }
    })()
  );
});

/* ── BACKGROUND SYNC (one-off, for live data) ────────────── */
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
      body:     data.body || '',
      icon:     '/android-chrome-192x192.png',
      badge:    '/android-chrome-192x192.png',
      vibrate:  [200, 100, 200],
      data:     { url: data.url || '/' },
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
