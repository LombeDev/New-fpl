/* ============================================================
   KOPALA FPL — SERVICE WORKER
   Strategy: Network-first for everything.
   Falls back to cache when offline.
   ============================================================ */

const CACHE_NAME    = 'kopala-fpl-v11';
const RUNTIME_CACHE = 'kopala-runtime-v10';

// Static assets only — NO HTML files.
const PRECACHE_URLS = [
  '/style.css',
  '/nav.css',
  '/nav.js',
  '/nav-bottom.css',
  '/nav-bottom.js',
  '/footer.css',
  '/footer.js',
  '/kopala-notify.js',
  '/transfers.js',
  '/badge.js',
  '/logo.png',
  '/manifest.json',
  '/android-chrome-192x192.png',
  '/android-chrome-512x512.png',
  'https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600&display=swap',
  'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.2/css/all.min.css',
];

const BOOTSTRAP_URL = '/.netlify/functions/fpl-proxy?endpoint=bootstrap-static/';

const PBS_BOOTSTRAP = 'fpl-bootstrap-sync';
const PBS_PRICE     = 'fpl-price-sync';
const PBS_DEADLINE  = 'fpl-deadline-check';

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
    })
    .then(() => self.skipWaiting()) // Activate immediately, don't wait for old tabs
  );
});

/* ── ACTIVATE — delete ALL old caches, claim clients immediately ── */
self.addEventListener('activate', event => {
  const CURRENT = [CACHE_NAME, RUNTIME_CACHE];
  event.waitUntil(
    caches.keys()
      .then(names =>
        Promise.all(
          names
            .filter(n => !CURRENT.includes(n))
            .map(n => {
              console.log('[SW] Deleting old cache:', n);
              return caches.delete(n);
            })
        )
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
              .map(req => {
                console.log('[SW] Purging HTML from cache:', req.url);
                return cache.delete(req);
              })
          );
        }
      })
      .then(() => self.clients.claim())
      .then(() => console.log('[SW] Active and controlling all clients'))
  );
});

/* ── FETCH ───────────────────────────────────────────────── */
self.addEventListener('fetch', event => {
  const { request } = event;
  const url = new URL(request.url);

  // Never intercept sw.js or pwa.js — always fresh
  if (url.pathname === '/sw.js' || url.pathname === '/pwa.js') return;

  // Let pwa.js manage its own no-store requests
  if (request.cache === 'no-store') return;

  // Cache API only supports GET
  if (request.method !== 'GET') return;

  // HTML documents — NEVER cache, always network
  if (
    request.destination === 'document' ||
    url.pathname === '/' ||
    url.pathname.endsWith('.html')
  ) return;

  // bootstrap-static: stale-while-revalidate for instant loads
  if (request.url.includes('bootstrap-static')) {
    event.respondWith(staleWhileRevalidate(request, RUNTIME_CACHE, BOOTSTRAP_TTL_MS));
    return;
  }

  // Everything else: network-first, cache fallback when offline
  event.respondWith(networkFirst(request, RUNTIME_CACHE));
});

/* ── STRATEGIES ──────────────────────────────────────────── */

async function networkFirst(request, cacheName) {
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
      console.log('[SW] Offline fallback served:', request.url);
      return cached;
    }
    return new Response(JSON.stringify({ error: 'offline' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

async function staleWhileRevalidate(request, cacheName, ttlMs) {
  const cache  = await caches.open(cacheName);
  const cached = await cache.match(request);

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

  if (cached) return cached;
  return revalidate;
}

/* ── NOTIFY CLIENTS ──────────────────────────────────────── */

async function notifyClients(message) {
  const allClients = await self.clients.matchAll({ includeUncontrolled: true });
  allClients.forEach(client => client.postMessage(message));
}

/* ── PERIODIC BACKGROUND SYNC ────────────────────────────── */

self.addEventListener('periodicsync', event => {

  if (event.tag === PBS_BOOTSTRAP) {
    console.log('[SW] Bootstrap sync fired');
    event.waitUntil((async () => {
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
        console.warn('[SW] Bootstrap sync failed:', err.message);
      }
    })());
    return;
  }

  if (event.tag === PBS_PRICE) {
    console.log('[SW] Price sync fired — waking client');
    event.waitUntil((async () => {
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
      } catch (_) { /* carry on regardless */ }
      notifyClients({ type: 'RUN_PRICE_CHECK', ts: Date.now() });
    })());
    return;
  }

  /* ── Deadline check — fires every hour via periodic sync ──
     Fetches bootstrap, finds next deadline, fires a notification
     if it is within 2 hours and we haven't already notified for
     this exact GW. Works even when the app is fully closed.    */
  if (event.tag === PBS_DEADLINE) {
    console.log('[SW] Deadline check fired');
    event.waitUntil((async () => {
      try {
        const res = await fetch(BOOTSTRAP_URL);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const data = await res.clone().json();

        const now  = Date.now();
        const next = data.events
          .filter(e => new Date(e.deadline_time).getTime() > now)
          .sort((a, b) => new Date(a.deadline_time) - new Date(b.deadline_time))[0];

        if (!next) return;

        const deadline   = new Date(next.deadline_time).getTime();
        const minsToGo   = (deadline - now) / 60000;

        /* Only fire in the 2h window (120 mins → 90 mins before deadline).
           The 30-min lower bound stops it re-firing on the next sync cycle
           if the user hasn't dismissed the notification yet. */
        if (minsToGo > 120 || minsToGo < 30) return;

        /* Check we haven't already notified for this GW */
        const cache      = await caches.open(RUNTIME_CACHE);
        const sentKey    = `kfl-deadline-sent-gw${next.id}`;
        const alreadySent = await cache.match(new Request(sentKey));
        if (alreadySent) return;

        /* Format deadline string */
        const dlStr = new Intl.DateTimeFormat('en-GB', {
          weekday: 'short', day: 'numeric', month: 'short',
          hour: '2-digit', minute: '2-digit',
        }).format(new Date(deadline));

        /* Fire the notification */
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
            silent:   false,
            data:     { url: '/transfers.html', group: 'kfl-deadline' },
            actions:  [
              { action: 'open',    title: '📋 Transfers' },
              { action: 'dismiss', title: 'Dismiss' },
            ],
          }
        );

        /* Mark as sent so we don't fire again this GW */
        await cache.put(
          new Request(sentKey),
          new Response('sent', { headers: { 'sw-deadline-sent-at': String(now) } })
        );

        console.log('[SW] Deadline notification fired for', next.name);

        /* Also wake any open clients so the in-app banner shows */
        notifyClients({ type: 'DEADLINE_APPROACHING', gwName: next.name, dlStr, deadline });

      } catch (err) {
        console.warn('[SW] Deadline check failed:', err.message);
      }
    })());
    return;
  }
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
/* Handles server-sent push payloads (future use).
   Client-side notifications are fired directly by kopala-notify.js. */

self.addEventListener('push', event => {
  if (!event.data) return;
  let data;
  try { data = event.data.json(); } catch (_) { return; }

  const group = data.group || null;

  /* Route to correct page based on group */
  const urlMap = {
    'kfl-deadline': '/transfers.html',
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
    silent:   false,
    data:     { url: data.url || urlMap[group] || '/', group },
    actions:  data.actions || [],
  };

  if (group) options.group = group;

  event.waitUntil((async () => {
    await self.registration.showNotification(data.title || 'Kopala FPL', options);

    /* Update the group summary so Android/iOS stacks the notifications */
    if (group) {
      const existing  = await self.registration.getNotifications({ tag: group + '-summary' });
      const prevCount = existing.length > 0 ? (existing[0].data?.count || 1) : 0;
      const count     = prevCount + 1;

      const summaryTitles = {
        'kfl-deadline': 'FPL Deadline',
        'kfl-goals':    `${count} goal alert${count > 1 ? 's' : ''}`,
        'kfl-prices':   `${count} price change${count > 1 ? 's' : ''} in your squad`,
      };

      await self.registration.showNotification(
        summaryTitles[group] || `${count} Kopala FPL update${count > 1 ? 's' : ''}`,
        {
          body:     'Tap to open Kopala FPL',
          icon:     '/android-chrome-192x192.png',
          badge:    '/android-chrome-96x96.png',
          tag:      group + '-summary',
          group,
          silent:   true,
          renotify: false,
          data:     { url: urlMap[group] || '/', group, isSummary: true, count },
        }
      );
    }
  })());
});

/* ── NOTIFICATION CLICK ──────────────────────────────────── */

self.addEventListener('notificationclick', event => {
  event.notification.close();

  if (event.action === 'dismiss') return;

  const notifData = event.notification.data || {};
  const tag       = event.notification.tag  || '';
  const group     = notifData.group         || null;
  const isSummary = notifData.isSummary     || false;

  if (isSummary && group) {
    event.waitUntil((async () => {
      const grouped = await self.registration.getNotifications({ tag: group });
      grouped.forEach(n => n.close());
    })());
  }

  let url = notifData.url;
  if (!url) {
    if (tag.startsWith('kfl-deadline') || group === 'kfl-deadline') url = '/transfers.html';
    else if (tag.startsWith('kfl-price') || group === 'kfl-prices') url = '/squad.html';
    else if (tag.startsWith('kfl-goal')  || group === 'kfl-goals')  url = '/games.html';
    else url = '/';
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        try {
          if (new URL(c.url).pathname === new URL(url, self.location.origin).pathname) {
            return c.focus();
          }
        } catch (_) {}
      }
      return clients.openWindow(url);
    })
  );
});
