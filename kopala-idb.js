/**
 * kopala-idb.js  v3
 * ─────────────────────────────────────────────────────────────
 * Full local database for Kopala FPL.
 * Philosophy: NEVER show a skeleton if any cached data exists.
 * Paint stale data instantly. Revalidate silently in background.
 *
 * STORES & TTLs
 *   bootstrap      FPL bootstrap-static JSON          1 hour
 *   squad          entry info + GW picks               15 min
 *   live           live GW scores                      60 sec
 *   price_history  nightly confirmed changes            30 days
 *   snapshots      player progress velocity samples     48 hours
 *   watchlist      starred player IDs                   permanent
 *   fixtures       GW fixture list + FDR                6 hours
 *   ownership      daily selected_by_percent samples    7 days
 *   render_cache   last rendered list HTML per page     5 min
 *   meta           internal flags                       permanent
 *
 * QUOTA GUARD: hard cap 25 MB. Evicts render_cache → snapshots
 * → old ownership → old price history when usage > 22 MB.
 *
 * PUBLIC API
 *   KopalaDB.bootstrap.get(proxy)          → data (stale-while-revalidate)
 *   KopalaDB.bootstrap.fresh(proxy)        → data (bypass TTL)
 *   KopalaDB.squad.get(id, gw, proxy)      → {entry, picks} | null
 *   KopalaDB.live.get(gw, proxy)           → live data
 *   KopalaDB.prices.log(hits, playerMap)   → void
 *   KopalaDB.prices.getLast(n)             → [{date,rises,falls}]
 *   KopalaDB.prices.getDay(dateStr)        → day | null
 *   KopalaDB.snapshots.save(id, prog)      → void (batched, idle)
 *   KopalaDB.snapshots.get(id)             → {id,prog,ts} | null
 *   KopalaDB.snapshots.getAll()            → {id: {prog,ts}}
 *   KopalaDB.watchlist.get()               → number[]
 *   KopalaDB.watchlist.toggle(id)          → number[]
 *   KopalaDB.fixtures.get(proxy)           → fixture array
 *   KopalaDB.ownership.snap(elements)      → void (idle)
 *   KopalaDB.ownership.trend(id)           → [{date,pct}]
 *   KopalaDB.render.save(page, html)       → void (idle)
 *   KopalaDB.render.get(page)              → html | null
 *   KopalaDB.quota.check()                 → {used,quota,pct}
 *   KopalaDB.quota.evict()                 → void
 *   KopalaDB.on(event, fn)                 → subscribe
 *   KopalaDB.off(event, fn)                → unsubscribe
 *
 * EVENTS (KopalaDB.on)
 *   'bootstrap'   fresh data arrived in background
 *   'squad'       squad data refreshed
 *   'live'        live scores updated
 * ─────────────────────────────────────────────────────────────
 */

const KopalaDB = (() => {
  'use strict';

  /* ── Constants ─────────────────────────────────────────── */
  const DB_NAME    = 'kopala-fpl';
  const DB_VERSION = 3;
  const QUOTA_MAX  = 25 * 1024 * 1024;  // 25 MB
  const QUOTA_WARN = 22 * 1024 * 1024;  // evict at 22 MB

  const TTL = {
    bootstrap: 60 * 60 * 1000,
    squad:     15 * 60 * 1000,
    live:           60 * 1000,
    fixtures:   6 * 60 * 60 * 1000,
    snapshots: 48 * 60 * 60 * 1000,
    ownership: 24 * 60 * 60 * 1000,
    render:     5 * 60 * 1000,
  };

  const S = {
    BOOTSTRAP:     'bootstrap',
    SQUAD:         'squad',
    LIVE:          'live',
    PRICE_HISTORY: 'price_history',
    SNAPSHOTS:     'snapshots',
    WATCHLIST:     'watchlist',
    FIXTURES:      'fixtures',
    OWNERSHIP:     'ownership',
    RENDER:        'render_cache',
    META:          'meta',
  };

  /* ── DB open ───────────────────────────────────────────── */
  let _dbp = null;
  function openDB() {
    if (_dbp) return _dbp;
    _dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        const ensure = (name, opts) => {
          if (!db.objectStoreNames.contains(name)) db.createObjectStore(name, opts || {});
        };
        ensure(S.BOOTSTRAP);
        ensure(S.SQUAD);
        ensure(S.LIVE);
        ensure(S.WATCHLIST);
        ensure(S.META);
        if (!db.objectStoreNames.contains(S.PRICE_HISTORY)) {
          db.createObjectStore(S.PRICE_HISTORY, { keyPath: 'date' });
        }
        if (!db.objectStoreNames.contains(S.SNAPSHOTS)) {
          const ss = db.createObjectStore(S.SNAPSHOTS, { keyPath: 'id' });
          ss.createIndex('ts', 'ts');
        }
        ensure(S.FIXTURES);
        if (!db.objectStoreNames.contains(S.OWNERSHIP)) {
          const os = db.createObjectStore(S.OWNERSHIP, { keyPath: ['id', 'date'] });
          os.createIndex('id', 'id');
        }
        if (!db.objectStoreNames.contains(S.RENDER)) {
          const rs = db.createObjectStore(S.RENDER, { keyPath: 'page' });
          rs.createIndex('ts', 'ts');
        }
      };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    });
    return _dbp;
  }

  /* ── Low-level ops ─────────────────────────────────────── */
  function iget(db, store, key) {
    return new Promise((res, rej) => {
      const r = db.transaction(store, 'readonly').objectStore(store).get(key);
      r.onsuccess = e => res(e.target.result ?? null);
      r.onerror   = e => rej(e.target.error);
    });
  }
  function iput(db, store, value, key) {
    return new Promise((res, rej) => {
      const t = db.transaction(store, 'readwrite').objectStore(store);
      const r = key !== undefined ? t.put(value, key) : t.put(value);
      r.onsuccess = () => res();
      r.onerror   = e  => rej(e.target.error);
    });
  }
  function idel(db, store, key) {
    return new Promise((res, rej) => {
      const r = db.transaction(store, 'readwrite').objectStore(store).delete(key);
      r.onsuccess = () => res();
      r.onerror   = e  => rej(e.target.error);
    });
  }
  function igetAll(db, store) {
    return new Promise((res, rej) => {
      const r = db.transaction(store, 'readonly').objectStore(store).getAll();
      r.onsuccess = e => res(e.target.result ?? []);
      r.onerror   = e => rej(e.target.error);
    });
  }
  function igetByIndex(db, store, idx, query) {
    return new Promise((res, rej) => {
      const r = db.transaction(store, 'readonly').objectStore(store).index(idx).getAll(query);
      r.onsuccess = e => res(e.target.result ?? []);
      r.onerror   = e => rej(e.target.error);
    });
  }

  /* Run during browser idle time — never block the main thread */
  function idle(fn) {
    'requestIdleCallback' in window
      ? requestIdleCallback(fn, { timeout: 4000 })
      : setTimeout(fn, 200);
  }

  /* ── Event bus ─────────────────────────────────────────── */
  const _ev = {};
  function emit(e, d) { (_ev[e] || []).forEach(f => { try { f(d); } catch {} }); }
  function on(e, f)   { (_ev[e] || (_ev[e] = [])).push(f); }
  function off(e, f)  { if (_ev[e]) _ev[e] = _ev[e].filter(x => x !== f); }

  /* ── Date helpers ──────────────────────────────────────── */
  function dateKey(offset = 0) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + offset);
    return d.toISOString().slice(0, 10);
  }
  function fplDateKey() {
    const now = new Date(), h = now.getUTCHours(), m = now.getUTCMinutes();
    const d = new Date(now);
    if (h < 1 || (h === 1 && m < 30)) d.setUTCDate(d.getUTCDate() - 1);
    return d.toISOString().slice(0, 10);
  }

  /* ═══════════════════════════════════════════════════════
     QUOTA GUARD
  ═══════════════════════════════════════════════════════ */
  const quota = {
    async check() {
      if (!navigator.storage?.estimate) return { used: 0, quota: QUOTA_MAX, pct: 0 };
      try {
        const { usage, quota: q } = await navigator.storage.estimate();
        return { used: usage || 0, quota: q || QUOTA_MAX, pct: Math.round(((usage || 0) / QUOTA_MAX) * 100) };
      } catch { return { used: 0, quota: QUOTA_MAX, pct: 0 }; }
    },
    async guard() {
      const { used } = await this.check();
      if (used > QUOTA_WARN) await this.evict();
    },
    async evict() {
      try {
        const db = await openDB();
        // 1. Render cache — always first (most temporary)
        const renders = await igetAll(db, S.RENDER);
        for (const r of renders) await idel(db, S.RENDER, r.page);
        // 2. Snapshots older than 12h
        const snaps = await igetAll(db, S.SNAPSHOTS);
        const sc = Date.now() - 12 * 3600000;
        for (const s of snaps) if (s.ts < sc) await idel(db, S.SNAPSHOTS, s.id);
        // 3. Ownership older than 3 days
        const own = await igetAll(db, S.OWNERSHIP);
        const oc = dateKey(-3);
        for (const o of own) if (o.date < oc) await idel(db, S.OWNERSHIP, [o.id, o.date]);
        // 4. Trim price history to 14 days
        const ph = await igetAll(db, S.PRICE_HISTORY);
        ph.sort((a, b) => a.date.localeCompare(b.date));
        for (const p of ph.slice(0, Math.max(0, ph.length - 14))) await idel(db, S.PRICE_HISTORY, p.date);
        console.log('[KopalaDB] eviction complete');
      } catch (err) { console.warn('[KopalaDB] evict error:', err); }
    },
  };

  /* ═══════════════════════════════════════════════════════
     BOOTSTRAP  (stale-while-revalidate)
  ═══════════════════════════════════════════════════════ */
  const bootstrap = {
    async get(proxy) {
      const db     = await openDB();
      const cached = await iget(db, S.BOOTSTRAP, 'static');
      if (cached) {
        if (Date.now() - cached.ts > TTL.bootstrap) {
          // Return stale IMMEDIATELY, revalidate behind the scenes
          this._revalidate(proxy, db);
        }
        return cached.data;
      }
      return this._fetch(proxy, db);
    },
    async fresh(proxy) {
      const db = await openDB();
      return this._fetch(proxy, db);
    },
    async _fetch(proxy, db) {
      const res = await fetch(`${proxy}bootstrap-static/`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      idle(async () => {
        try {
          await quota.guard();
          await iput(db, S.BOOTSTRAP, { data, ts: Date.now() }, 'static');
        } catch {}
      });
      return data;
    },
    async _revalidate(proxy, db) {
      try {
        const res = await fetch(`${proxy}bootstrap-static/`);
        if (!res.ok) return;
        const data = await res.json();
        await iput(db, S.BOOTSTRAP, { data, ts: Date.now() }, 'static');
        emit('bootstrap', data);
      } catch {}
    },
  };

  /* ═══════════════════════════════════════════════════════
     SQUAD  (15-min TTL, stale-while-revalidate)
  ═══════════════════════════════════════════════════════ */
  const squad = {
    _key: (id, gw) => `${id}_gw${gw}`,
    async get(fplId, gw, proxy) {
      if (!fplId) return null;
      const db  = await openDB();
      const key = this._key(fplId, gw);
      const c   = await iget(db, S.SQUAD, key);
      if (c) {
        if (Date.now() - c.ts > TTL.squad) this._fetch(fplId, gw, proxy, db, key);
        return c.data;
      }
      return this._fetch(fplId, gw, proxy, db, key);
    },
    async _fetch(fplId, gw, proxy, db, key) {
      try {
        const [er, pr] = await Promise.all([
          fetch(`${proxy}entry/${fplId}/`),
          fetch(`${proxy}entry/${fplId}/event/${gw}/picks/`),
        ]);
        if (!er.ok || !pr.ok) return null;
        const [entry, picks] = await Promise.all([er.json(), pr.json()]);
        const data = { entry, picks };
        idle(async () => {
          await quota.guard();
          await iput(db, S.SQUAD, { data, ts: Date.now() }, key);
        });
        emit('squad', data);
        return data;
      } catch { return null; }
    },
  };

  /* ═══════════════════════════════════════════════════════
     LIVE  (60-sec TTL)
  ═══════════════════════════════════════════════════════ */
  const live = {
    async get(gw, proxy) {
      const db = await openDB();
      const c  = await iget(db, S.LIVE, gw);
      if (c) {
        if (Date.now() - c.ts > TTL.live) this._fetch(gw, proxy, db);
        return c.data;
      }
      return this._fetch(gw, proxy, db);
    },
    async _fetch(gw, proxy, db) {
      const res = await fetch(`${proxy}event/${gw}/live/`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      idle(() => iput(db, S.LIVE, { data, ts: Date.now() }, gw).catch(() => {}));
      emit('live', { gw, data });
      return data;
    },
  };

  /* ═══════════════════════════════════════════════════════
     PRICE HISTORY  (30-day log, permanent per entry)
  ═══════════════════════════════════════════════════════ */
  const prices = {
    async log(hits, playerMapRef) {
      if (!hits?.length) return;
      const db  = await openDB();
      const key = fplDateKey();
      let day   = await iget(db, S.PRICE_HISTORY, key);
      if (!day) day = { date: key, rises: [], falls: [], ts: Date.now() };

      hits.forEach(c => {
        const bucket = c.type === 'rise' ? 'rises' : 'falls';
        if (!day[bucket].some(e => e.id === c.id)) {
          day[bucket].push({
            id: c.id || 0, name: c.name,
            teamCode: playerMapRef[c.id]?.team_code || 0,
            pos: playerMapRef[c.id]?.element_type || 0,
            oldPrice: parseFloat(c.old),
            newPrice: parseFloat(c.cur),
            type: c.type,
          });
        }
      });
      day.ts = Date.now();

      idle(async () => {
        try {
          await quota.guard();
          await iput(db, S.PRICE_HISTORY, day);
          // Prune to 30 days
          const all = await igetAll(db, S.PRICE_HISTORY);
          all.sort((a, b) => a.date.localeCompare(b.date));
          for (const p of all.slice(0, Math.max(0, all.length - 30))) {
            await idel(db, S.PRICE_HISTORY, p.date);
          }
        } catch {}
      });
    },
    async getLast(n = 7) {
      const db  = await openDB();
      const all = await igetAll(db, S.PRICE_HISTORY);
      return all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, n);
    },
    async getDay(dateStr) {
      const db = await openDB();
      return iget(db, S.PRICE_HISTORY, dateStr);
    },
  };

  /* ═══════════════════════════════════════════════════════
     SNAPSHOTS  (velocity data, batched writes)
  ═══════════════════════════════════════════════════════ */
  const snapshots = {
    _q: {},
    _queued: false,
    save(id, prog) {
      this._q[id] = { id, prog, ts: Date.now() };
      if (!this._queued) {
        this._queued = true;
        idle(() => this._flush());
      }
    },
    async _flush() {
      this._queued = false;
      const entries = Object.values(this._q);
      this._q = {};
      if (!entries.length) return;
      try {
        const db  = await openDB();
        const now = Date.now();
        const t   = db.transaction(S.SNAPSHOTS, 'readwrite');
        const st  = t.objectStore(S.SNAPSHOTS);
        for (const e of entries) {
          const ex = await iget(db, S.SNAPSHOTS, e.id);
          if (!ex || Math.abs(e.prog - ex.prog) > 0.5 || now - ex.ts > 30 * 60000) {
            st.put(e);
          }
        }
        // Prune expired
        const all = await igetAll(db, S.SNAPSHOTS);
        const cut = now - TTL.snapshots;
        for (const s of all) if (s.ts < cut) idel(db, S.SNAPSHOTS, s.id).catch(() => {});
      } catch {}
    },
    async get(id) {
      try { return await iget(await openDB(), S.SNAPSHOTS, id); } catch { return null; }
    },
    async getAll() {
      try {
        const all = await igetAll(await openDB(), S.SNAPSHOTS);
        const map = {};
        all.forEach(s => { map[s.id] = s; });
        return map;
      } catch { return {}; }
    },
  };

  /* ═══════════════════════════════════════════════════════
     WATCHLIST  (in-memory + IDB + localStorage triple sync)
  ═══════════════════════════════════════════════════════ */
  const watchlist = {
    _cache: null,
    async get() {
      if (this._cache) return this._cache;
      // Instant: read localStorage (sync)
      try { this._cache = JSON.parse(localStorage.getItem('kopala_watchlist') || '[]'); }
      catch { this._cache = []; }
      // Async: sync from IDB (source of truth)
      try {
        const rec = await iget(await openDB(), S.WATCHLIST, 'ids');
        if (rec) {
          this._cache = rec.ids;
          localStorage.setItem('kopala_watchlist', JSON.stringify(rec.ids));
        }
      } catch {}
      return this._cache;
    },
    async toggle(id) {
      const ids = await this.get();
      const i = ids.indexOf(id);
      if (i > -1) ids.splice(i, 1); else ids.push(id);
      this._cache = ids;
      localStorage.setItem('kopala_watchlist', JSON.stringify(ids));
      idle(async () => {
        const db = await openDB();
        await iput(db, S.WATCHLIST, { ids }, 'ids');
      });
      return ids;
    },
  };

  /* ═══════════════════════════════════════════════════════
     FIXTURES  (6-hour TTL)
  ═══════════════════════════════════════════════════════ */
  const fixtures = {
    async get(proxy) {
      const db = await openDB();
      const c  = await iget(db, S.FIXTURES, 'all');
      if (c) {
        if (Date.now() - c.ts > TTL.fixtures) this._fetch(proxy, db);
        return c.data;
      }
      return this._fetch(proxy, db);
    },
    async _fetch(proxy, db) {
      const res = await fetch(`${proxy}fixtures/`);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      idle(async () => {
        await quota.guard();
        await iput(db, S.FIXTURES, { data, ts: Date.now() }, 'all');
      });
      return data;
    },
  };

  /* ═══════════════════════════════════════════════════════
     OWNERSHIP TRENDS  (daily snapshots, 7-day history)
  ═══════════════════════════════════════════════════════ */
  const ownership = {
    snap(elements) {
      idle(async () => {
        try {
          const db   = await openDB();
          const date = dateKey();
          const t    = db.transaction(S.OWNERSHIP, 'readwrite');
          const st   = t.objectStore(S.OWNERSHIP);
          for (const p of elements) {
            const ex = await iget(db, S.OWNERSHIP, [p.id, date]);
            if (!ex) st.put({ id: p.id, date, pct: parseFloat(p.selected_by_percent) || 0 });
          }
          // Prune > 7 days
          const all = await igetAll(db, S.OWNERSHIP);
          const cut = dateKey(-7);
          for (const o of all) if (o.date < cut) idel(db, S.OWNERSHIP, [o.id, o.date]).catch(() => {});
        } catch {}
      });
    },
    async trend(id) {
      try {
        const all = await igetByIndex(await openDB(), S.OWNERSHIP, 'id', id);
        return all.sort((a, b) => a.date.localeCompare(b.date));
      } catch { return []; }
    },
  };

  /* ═══════════════════════════════════════════════════════
     RENDER CACHE  (last rendered HTML, 5-min TTL)
     Paint stale HTML instantly, patch when fresh data lands.
  ═══════════════════════════════════════════════════════ */
  const render = {
    save(page, html) {
      idle(async () => {
        try {
          const db = await openDB();
          await quota.guard();
          await iput(db, S.RENDER, { page, html, ts: Date.now() });
        } catch {}
      });
    },
    async get(page) {
      try {
        const rec = await iget(await openDB(), S.RENDER, page);
        if (!rec || Date.now() - rec.ts > TTL.render) return null;
        return rec.html;
      } catch { return null; }
    },
  };

  /* ── Eager init: open DB now so first read is instant ── */
  openDB().catch(() => {});

  /* ═══════════════════════════════════════════════════════
     LEGACY COMPAT  (KopalaIDB API still works)
  ═══════════════════════════════════════════════════════ */
  return {
    bootstrap, squad, live, prices,
    snapshots, watchlist, fixtures,
    ownership, render, quota, on, off,
    // KopalaIDB legacy
    getBootstrap: (p) => bootstrap.get(p),
    fetchFresh:   (p) => bootstrap.fresh(p),
    invalidate:   async () => { const db = await openDB(); await idel(db, S.BOOTSTRAP, 'static'); },
  };
})();
