/* ============================================================
   KOPALA FPL — SERVICE WORKER  v12
   Changes from v11:
   - Removed non-existent files from PRECACHE_URLS
     (/nav-bottom.css, /nav-bottom.js, /transfers.js)
   - Added kopala-worker-client.js to precache
   - Added kopala-worker.js to precache
   - HTML pages explicitly excluded from all caching strategies
   - Turbo-swap friendly: never caches navigations
   ============================================================ */

const CACHE_NAME    = 'kopala-fpl-v12';
const RUNTIME_CACHE = 'kopala-runtime-v11';

/* ── Only list files that ACTUALLY exist in your deploy ───── */
const PRECACHE_URLS = [
  '/style.css',
  '/nav.css',
  '/nav.js',
  '/footer.css',
  '/footer.js',
  '/kopala-worker.js',
  '/kopala-worker-client.js',
  '/kopala-idb.js',
  '/kopala-notify.js',
  '/badge.js',
  '/pwa.js',
  '/logo.png',
  '/manifest.json',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  /* Self-hosted fonts — add these once you have the woff2 files */
  /* '/fonts/dm-sans.woff2', */
  /* '/fonts/barlow-condensed.woff2', */
  /* '/fonts/space-grotesk.woff2', */
  /* '/fonts/material-symbols-rounded.woff2', */
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css',
];

/* ── Files that are safe to serve stale from cache ─────────
   (revalidated in the background after serving)
─────────────────────────────────────────────────────────── */
const STALE_PATTERNS = [
  /bootstrap-static/,
  /fonts\.googleapis\.com/,
  /fonts\.gstatic\.com/,
  /cdnjs\.cloudflare\.com/,
];

const BOOTSTRAP_URL     = '/.netlify/functions/fpl-proxy?endpoint=bootstrap-static/';
const BOOTSTRAP_TTL_MS  = 60 * 60 * 1000; // 1 hour

const PBS_BOOTSTRAP      = 'fpl-bootstrap-sync';
const PBS_PRICE          = 'fpl-price-sync';
const PBS_DEADLINE       = 'fpl-deadline-check';
const PBS_MIN_INTERVAL   = 3  * 60 * 60 * 1000;
const PBS_PRICE_INTERVAL = 12 * 60 * 60 * 1000;
const PBS_DL_INTERVAL    =  1 * 60 * 60 * 1000;

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
          .catch(err => {
            // Log but don't abort install — missing optional asset is non-fatal
            console.warn('[SW v12] Precache skipped:', url, '—', err.message);
          })
      );
      return Promise.allSettled(attempts);
    })
    .then(() => {
      console.log('[SW v12] Install complete');
      return self.skipWaiting();
    })
  );
});

/* ── ACTIVATE — purge old caches ─────────────────────────── */
self.addEventListener('activate', event => {
  const CURRENT = [CACHE_NAME, RUNTIME_CACHE];
  event.waitUntil(
    caches.keys()
      .then(names =>
        Promise.all(
          names
            .filter(n => !CURRENT.includes(n))
            .map(n => {
              console.log('[SW v12] Deleting old cache:', n);
              return caches.delete(n);
            })
        )
      )
      .then(async () => {
        // Purge any HTML pages that leaked into previous caches
        for (const name of [CACHE_NAME, RUNTIME_CACHE]) {
          const cache = await caches.open(name);
          const keys  = await cache.keys();
          await Promise.all(
            keys
              .filter(req => _isHTMLRequest(req))
              .map(req => {
                console.log('[SW v12] Purging stale HTML:', req.url);
                return cache.delete(req);
              })
          );
        }
      })
      .then(() => self.clients.claim())
      .then(() => console.log('[SW v12] Active — controlling all clients'))
  );
});

/* ── FETCH ───────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // 1. Never intercept the SW or PWA bootstrap files themselves
  if (url.pathname === '/sw.js' || url.pathname === '/pwa.js') return;

  // 2. Honour explicit no-store (pwa.js manages these)
  if (request.cache === 'no-store') return;

  // 3. Only cache GET
  if (request.method !== 'GET') return;

  // 4. HTML navigations — ALWAYS go to network, never cache
  //    This keeps Turbo-swap fresh and avoids stale shell bugs
  if (_isHTMLRequest(request)) return;

  // 5. bootstrap-static — stale-while-revalidate for instant repeat loads
  if (url.href.includes('bootstrap-static')) {
    event.respondWith(
      _staleWhileRevalidate(request, RUNTIME_CACHE, BOOTSTRAP_TTL_MS)
    );
    return;
  }

  // 6. Known stale-safe external resources (fonts, CDN)
  if (STALE_PATTERNS.some(p => p.test(url.href))) {
    event.respondWith(
      _staleWhileRevalidate(request, RUNTIME_CACHE, 7 * 24 * 60 * 60 * 1000)
    );
    return;
  }

  // 7. Everything else — network-first, cache as offline fallback
  event.respondWith(_networkFirst(request, RUNTIME_CACHE));
});

/* ── HELPERS ─────────────────────────────────────────────── */
function _isHTMLRequest(request) {
  // Accept header check (navigation requests)
  if (request.destination === 'document') return true;
  const url = new URL(request.url);
  // Pathname patterns
  return (
    url.pathname === '/' ||
    url.pathname.endsWith('.html') ||
    url.pathname.endsWith('/')
  );
}

async function _networkFirst(request, cacheName) {
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
    if (cached) {
      console.log('[SW v12] Offline fallback:', request.url);
      return cached;
    }
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function _staleWhileRevalidate(request, cacheName, ttlMs) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

  const revalidate = fetch(request)
    .then(async res => {
      if (!res.ok) return res;
      const headers = new Headers(res.headers);
      headers.set('sw-cached-at', Date.now().toString());
      const tagged = new Response(await res.clone().arrayBuffer(), {
        status: res.status, statusText: res.statusText, headers,
      });
      await cache.put(request, tagged);
      if (request.url.includes('bootstrap-static')) {
        _notifyClients({ type: 'BOOTSTRAP_UPDATED', ts: Date.now() });
      }
      return res;
    })
    .catch(() => null);

  // Serve stale immediately if we have it; otherwise wait for network
  return cached || revalidate;
}

async function _notifyClients(message) {
  const all = await self.clients.matchAll({ includeUncontrolled: true });
  all.forEach(c => c.postMessage(message));
}

/* ── PERIODIC BACKGROUND SYNC ────────────────────────────── */
self.addEventListener('periodicsync', event => {

  if (event.tag === PBS_BOOTSTRAP) {
    event.waitUntil((async () => {
      try {
        const res     = await fetch(BOOTSTRAP_URL);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const cache   = await caches.open(RUNTIME_CACHE);
        const headers = new Headers(res.headers);
        headers.set('sw-cached-at', Date.now().toString());
        const tagged  = new Response(await res.arrayBuffer(), {
          status: res.status, statusText: res.statusText, headers,
        });
        await cache.put(BOOTSTRAP_URL, tagged);
        console.log('[SW v12] Bootstrap prefetched');
        _notifyClients({ type: 'BOOTSTRAP_UPDATED', ts: Date.now() });
      } catch (err) {
        console.warn('[SW v12] Bootstrap sync failed:', err.message);
      }
    })());
    return;
  }

  if (event.tag === PBS_PRICE) {
    event.waitUntil((async () => {
      try {
        const res = await fetch(BOOTSTRAP_URL);
        if (!res.ok) return;
        const cache   = await caches.open(RUNTIME_CACHE);
        const headers = new Headers(res.headers);
        headers.set('sw-cached-at', Date.now().toString());
        const tagged  = new Response(await res.arrayBuffer(), {
          status: res.status, statusText: res.statusText, headers,
        });
        await cache.put(BOOTSTRAP_URL, tagged);
      } catch (_) {}
      _notifyClients({ type: 'RUN_PRICE_CHECK', ts: Date.now() });
    })());
    return;
  }

  if (event.tag === PBS_DEADLINE) {
    event.waitUntil((async () => {
      try {
        const res  = await fetch(BOOTSTRAP_URL);
        if (!res.ok) return;
        const data = await res.clone().json();
        const now  = Date.now();
        const next = data.events
          .filter(e => new Date(e.deadline_time).getTime() > now)
          .sort((a, b) => new Date(a.deadline_time) - new Date(b.deadline_time))[0];

        if (!next) return;
        const deadline  = new Date(next.deadline_time).getTime();
        const minsToGo  = (deadline - now) / 60000;
        if (minsToGo > 120 || minsToGo < 30) return;

        const cache       = await caches.open(RUNTIME_CACHE);
        const sentKey     = `kfl-deadline-sent-gw${next.id}`;
        const alreadySent = await cache.match(new Request(sentKey));
        if (alreadySent) return;

        const dlStr = new Intl.DateTimeFormat('en-GB', {
          weekday: 'short', day: 'numeric', month: 'short',
          hour: '2-digit', minute: '2-digit',
        }).format(new Date(deadline));

        await self.registration.showNotification(
          '⏰ 2 hours to ' + next.name + ' deadline!',
          {
            body:     'Lock in your captain and transfers before ' + dlStr,
            icon:     '/android-chrome-192x192.png',
            badge:    '/android-chrome-96x96.png',
            vibrate:  [200, 80, 200, 80, 200],
            tag:      'kfl-deadline-2h',
            group:    'kfl-deadline',
            renotify: true,
            data:     { url: '/', group: 'kfl-deadline' },
            actions:  [
              { action: 'open',    title: '📋 Open App' },
              { action: 'dismiss', title: 'Dismiss' },
            ],
          }
        );

        await cache.put(
          new Request(sentKey),
          new Response('sent', { headers: { 'sw-deadline-sent-at': String(now) } })
        );
        _notifyClients({
          type: 'DEADLINE_APPROACHING',
          gwName: next.name, dlStr, deadline,
        });
      } catch (err) {
        console.warn('[SW v12] Deadline check failed:', err.message);
      }
    })());
    return;
  }
});

/* ── BACKGROUND SYNC (one-off, for live data) ────────────── */
self.addEventListener('sync', event => {
  if (event.tag === 'sync-live') event.waitUntil(_clearLiveCache());
});
async function _clearLiveCache() {
  const cache = await caches.open(RUNTIME_CACHE);
  const keys  = await cache.keys();
  await Promise.all(
    keys
      .filter(k => k.url.includes('event/') && k.url.includes('/live/'))
      .map(k => cache.delete(k))
  );
}

/* ── PUSH NOTIFICATIONS ──────────────────────────────────── */
self.addEventListener('push', event => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch (_) { return; }

  const group   = data.group || null;
  const urlMap  = {
    'kfl-deadline': '/',
    'kfl-goals':    '/games.html',
    'kfl-prices':   '/prices.html',
  };
  const options = {
    body:     data.body    || '',
    icon:     '/android-chrome-192x192.png',
    badge:    '/android-chrome-96x96.png',
    vibrate:  data.vibrate || [100, 50, 100],
    tag:      data.tag     || 'kfl-push',
    renotify: data.renotify !== false,
    data:     { url: data.url || urlMap[group] || '/', group },
    actions:  data.actions || [],
  };
  if (group) options.group = group;
  event.waitUntil(
    self.registration.showNotification(data.title || 'Kopala FPL', options)
  );
});

/* ── NOTIFICATION CLICK ──────────────────────────────────── */
self.addEventListener('notificationclick', event => {
  event.notification.close();
  if (event.action === 'dismiss') return;
  const url = event.notification.data?.url || '/';
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        try {
          if (new URL(c.url).origin === self.location.origin) return c.focus();
        } catch (_) {}
      }
      return clients.openWindow(url);
    })
  );
});
