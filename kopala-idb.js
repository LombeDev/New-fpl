/**
 * kopala-idb.js
 * IndexedDB cache for bootstrap-static.
 * Keeps the 1MB+ FPL JSON off the SW cache and off the main thread parse path.
 *
 * Public API:
 *   KopalaIDB.getBootstrap(proxyBase)  → Promise<bootstrapData>
 *   KopalaIDB.invalidate()             → Promise<void>  (call after deadline passes)
 */

const KopalaIDB = (() => {
  const DB_NAME    = 'kopala-fpl';
  const DB_VERSION = 1;
  const STORE      = 'bootstrap';
  const KEY        = 'static';
  // Bootstrap is valid for 1 hour — FPL updates it around 06:30 and at deadline
  const TTL_MS     = 60 * 60 * 1000;

  /* ── open / upgrade ─────────────────────────────────────────── */
  function openDB() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = e => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE)) {
          db.createObjectStore(STORE);
        }
      };
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    });
  }

  /* ── read ───────────────────────────────────────────────────── */
  function idbGet(db, key) {
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readonly');
      const req = tx.objectStore(STORE).get(key);
      req.onsuccess = e => resolve(e.target.result);
      req.onerror   = e => reject(e.target.error);
    });
  }

  /* ── write ──────────────────────────────────────────────────── */
  function idbSet(db, key, value) {
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).put(value, key);
      req.onsuccess = () => resolve();
      req.onerror   = e  => reject(e.target.error);
    });
  }

  /* ── delete ─────────────────────────────────────────────────── */
  function idbDel(db, key) {
    return new Promise((resolve, reject) => {
      const tx  = db.transaction(STORE, 'readwrite');
      const req = tx.objectStore(STORE).delete(key);
      req.onsuccess = () => resolve();
      req.onerror   = e  => reject(e.target.error);
    });
  }

  /* ── public: getBootstrap ───────────────────────────────────── */
  async function getBootstrap(proxyBase) {
    let db;
    try {
      db = await openDB();
      const cached = await idbGet(db, KEY);

      // Cache hit + still fresh → return immediately (sub-10ms)
      if (cached && (Date.now() - cached.ts) < TTL_MS) {
        console.debug('[IDB] bootstrap cache hit', Math.round((Date.now() - cached.ts) / 1000) + 's old');
        return cached.data;
      }

      // Cache miss or stale → fetch from network
      console.debug('[IDB] bootstrap cache miss — fetching');
      const res  = await fetch(`${proxyBase}bootstrap-static/`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();

      // Store with timestamp — fire and forget, don't block render
      idbSet(db, KEY, { data, ts: Date.now() }).catch(err => {
        console.warn('[IDB] write failed:', err);
      });

      return data;
    } catch (err) {
      console.warn('[IDB] getBootstrap error:', err);

      // If network failed but we have stale cache, use it as fallback
      if (db) {
        const stale = await idbGet(db, KEY).catch(() => null);
        if (stale) {
          console.warn('[IDB] using stale cache as fallback');
          return stale.data;
        }
      }
      throw err; // propagate if nothing at all
    }
  }

  /* ── public: invalidate ─────────────────────────────────────── */
  async function invalidate() {
    try {
      const db = await openDB();
      await idbDel(db, KEY);
      console.debug('[IDB] bootstrap cache invalidated');
    } catch (err) {
      console.warn('[IDB] invalidate error:', err);
    }
  }

  return { getBootstrap, invalidate };
})();
