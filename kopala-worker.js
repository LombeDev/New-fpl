/* ============================================================
   KOPALA FPL — WORKER CLIENT  v1
   Single shared module that replaces the three copies of the
   bootstrap-worker pattern scattered across index.html,
   leagues.html, and prices.html.

   Usage (add ONE <script> tag before your page script):
     <script src="kopala-worker-client.js"></script>

   Then call:
     const result = await KopalaWorker.run(rawBootstrapData);

   The worker is created once, kept alive across calls, and
   automatically falls back to an inline blob if /kopala-worker.js
   fails to load (e.g. offline or 404).
   ============================================================ */

(function (global) {
  'use strict';

  /* ── Inline blob fallback source ───────────────────────────
     Mirrors the PROCESS_BOOTSTRAP handler in /kopala-worker.js.
     Used when the real worker file can't be loaded.
  ─────────────────────────────────────────────────────────── */
  const FALLBACK_SRC = `
self.onmessage = function(e) {
  const { type, payload: d, _id } = e.data;
  if (type !== 'PROCESS_BOOTSTRAP') return;
  try {
    const tM = {}, TMAP = {}, TCODES = {};
    d.teams.forEach(t => {
      tM[t.id] = { code: t.code, name: t.name, short: t.short_name };
      TMAP[t.id]   = t.short_name;
      TCODES[t.id] = t.code;
    });
    const teamList = d.teams.map(t => ({
      id: t.id, name: t.name, short: t.short_name, code: t.code
    }));
    const pM = {}, eD = {};
    d.elements.forEach(p => {
      pM[p.id] = {
        name:          p.web_name,
        fullName:      p.first_name + ' ' + p.second_name,
        teamCode:      tM[p.team]?.code  || 1,
        teamShort:     tM[p.team]?.short || '?',
        pos:           p.element_type,
        team:          p.team,
        ownership:     parseFloat(p.selected_by_percent) || 0,
        nowCost:       p.now_cost,
        costChangeEvent:  p.cost_change_event    || 0,
        transfersIn:      p.transfers_in_event   || 0,
        transfersOut:     p.transfers_out_event  || 0,
      };
      eD[p.id] = p;
    });
    const priceRisers  = d.elements
      .filter(e => e.cost_change_event > 0)
      .sort((a, b) => b.cost_change_event - a.cost_change_event)
      .slice(0, 25).map(e => e.id);
    const priceFallers = d.elements
      .filter(e => e.cost_change_event < 0)
      .sort((a, b) => a.cost_change_event - b.cost_change_event)
      .slice(0, 25).map(e => e.id);
    const top30 = d.elements
      .slice()
      .sort((a, b) => b.selected_by_percent - a.selected_by_percent)
      .slice(0, 30).map(e => e.id);
    const ev = d.events.find(e => e.is_current)
            || d.events.find(e => e.is_next)
            || d.events[0];
    const now = Date.now();
    const nx  = d.events
      .filter(e => new Date(e.deadline_time).getTime() > now)
      .sort((a, b) => new Date(a.deadline_time) - new Date(b.deadline_time))[0];
    const out = {
      playerMap:    pM,
      teamMap:      tM,
      elementData:  eD,
      allElements:  d.elements,
      priceRisers,
      priceFallers,
      top30,
      totalPlayers: d.total_players || 0,
      currentGW:    ev ? ev.id : 1,
      gwAvg:        ev ? ev.average_entry_score || 0 : 0,
      gwHigh:       ev ? ev.highest_score       || 0 : 0,
      TMAP, TCODES, teamList,
      gwNum:        ev ? ev.id : 1,
      maxGW:        d.events.length,
      nextDeadline: nx ? new Date(nx.deadline_time).getTime() : null,
      nextGWName:   nx ? nx.name : null,
    };
    const r = { type: 'BOOTSTRAP_READY', payload: out };
    if (_id !== undefined) r._id = _id;
    self.postMessage(r);
  } catch (err) {
    self.postMessage({ type: 'ERROR', payload: err.message, _id });
  }
};`;

  /* ── Module state ─────────────────────────────────────── */
  let   _worker  = null;
  let   _cbs     = {};
  let   _cid     = 0;
  const TIMEOUT  = 10000; // ms before a pending call rejects

  /* ── Internal: create (or recreate) the worker ────────── */
  function _getWorker() {
    if (_worker) return _worker;

    // Try the real file first; fall back to blob on any error
    try {
      _worker = new Worker('/kopala-worker.js');
    } catch (_) {
      _worker = _makeBlobWorker();
    }

    // CRITICAL: wire onmessage BEFORE any postMessage so fast
    // (blob) workers don't fire before the handler is attached.
    _worker.onmessage = function (e) {
      const { type, payload, _id } = e.data;
      if (_id !== undefined && _cbs[_id]) {
        const { resolve, reject } = _cbs[_id];
        delete _cbs[_id];
        type === 'ERROR'
          ? reject(new Error(payload))
          : resolve(payload);
      }
    };

    _worker.onerror = function (err) {
      console.warn('[KopalaWorker] Worker error — recreating:', err);
      // Reject all pending so they don't hang
      Object.values(_cbs).forEach(({ reject }) =>
        reject(new Error('Worker crashed'))
      );
      _cbs    = {};
      _worker = null; // allow recreation on next call
    };

    return _worker;
  }

  function _makeBlobWorker() {
    const blob = new Blob([FALLBACK_SRC], { type: 'application/javascript' });
    return new Worker(URL.createObjectURL(blob));
  }

  /* ── Public API ───────────────────────────────────────── */
  const KopalaWorker = {

    /**
     * Process raw bootstrap-static JSON off the main thread.
     *
     * @param  {Object} rawBootstrap  — direct response from bootstrap-static/
     * @returns {Promise<Object>}     — processed result (playerMap, teamMap, …)
     */
    run(rawBootstrap) {
      return new Promise((resolve, reject) => {
        const id = ++_cid;
        _cbs[id]  = { resolve, reject };

        // Auto-reject after TIMEOUT ms
        const timer = setTimeout(() => {
          if (_cbs[id]) {
            delete _cbs[id];
            reject(new Error('KopalaWorker: timed out after ' + TIMEOUT + 'ms'));
          }
        }, TIMEOUT);

        // Wrap resolve/reject to always clear the timer
        _cbs[id] = {
          resolve(v) { clearTimeout(timer); resolve(v); },
          reject(e)  { clearTimeout(timer); reject(e);  },
        };

        try {
          _getWorker().postMessage({
            type:    'PROCESS_BOOTSTRAP',
            payload: rawBootstrap,
            _id:     id,
          });
        } catch (err) {
          // postMessage itself failed (e.g. structured-clone error)
          delete _cbs[id];
          clearTimeout(timer);
          reject(err);
        }
      });
    },

    /**
     * Terminate the worker and free memory.
     * The next call to run() will create a fresh worker automatically.
     */
    terminate() {
      if (_worker) { _worker.terminate(); _worker = null; }
      _cbs = {};
    },
  };

  /* Expose as a global (matches existing usage pattern) */
  global.KopalaWorker = KopalaWorker;

})(window);
