/**
 * badge.js — Kopala FPL
 * ─────────────────────────────────────────────────────────────
 * Shows a red badge count on the Home nav icon with the number
 * of players in the user's squad that have an injury flag
 * (chance_of_playing_next_round <= 25).
 *
 * Clears automatically when the user is on index.html / home.
 *
 * Reuses the bootstrap-static response already fetched by
 * deadline.js — no extra API cost if called after it.
 *
 * Usage: <script src="badge.js"></script>  (after nav.js)
 */

(function () {
  'use strict';

  const PROXY_BOOTSTRAP = '/.netlify/functions/fpl-proxy?endpoint=bootstrap-static/';
  const STORAGE_KEY_ID  = 'kopala_id';
  const CACHE_KEY       = 'kopala_badge_data';
  const CACHE_TTL_MS    = 20 * 60 * 1000; // 20 minutes

  /* ── Is this the home page? ──────────────────────────────── */

  function isHomePage() {
    const page = window.location.pathname.split('/').pop() || 'index.html';
    return page === 'index.html' || page === '' || page === '/';
  }

  /* ── Session cache ───────────────────────────────────────── */

  function getCached() {
    try {
      const raw = sessionStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      const { ts, data } = JSON.parse(raw);
      if (Date.now() - ts < CACHE_TTL_MS) return data;
    } catch (_) {}
    return null;
  }

  function setCache(data) {
    try {
      sessionStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), data }));
    } catch (_) {}
  }

  /* ── Inject styles ───────────────────────────────────────── */

  (function injectStyles() {
    if (document.getElementById('kfl-badge-styles')) return;
    const style = document.createElement('style');
    style.id = 'kfl-badge-styles';
    style.textContent = `
      .kfl-app-badge {
        position: absolute;
        top: -4px;
        right: -4px;
        min-width: 16px;
        height: 16px;
        padding: 0 4px;
        border-radius: 100px;
        background: #ef4444;
        color: #fff;
        font-family: 'DM Sans', system-ui, sans-serif;
        font-size: 9px;
        font-weight: 800;
        line-height: 16px;
        text-align: center;
        white-space: nowrap;
        box-shadow: 0 0 0 2px var(--kfl-surface, #141e2d);
        pointer-events: none;
        z-index: 10;
        animation: kfl-badge-pop 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both;
      }

      @keyframes kfl-badge-pop {
        from { transform: scale(0); opacity: 0; }
        to   { transform: scale(1); opacity: 1; }
      }
    `;
    document.head.appendChild(style);
  })();

  /* ── Render / clear in-app badge ─────────────────────────── */

  function renderBadge(count) {
    // Always remove existing first
    document.querySelectorAll('.kfl-app-badge').forEach(el => el.remove());

    if (count <= 0) return;

    // Attach to the Home nav icon wrapper
    const homeWrapper = document.querySelector(
      '.kfl-bottom-nav__item[href="index.html"] .kfl-bottom-nav__icon-wrapper'
    );
    if (!homeWrapper) return;

    const badge = document.createElement('span');
    badge.className   = 'kfl-app-badge';
    badge.textContent = count > 99 ? '99+' : String(count);
    badge.setAttribute('aria-label', `${count} injured player${count !== 1 ? 's' : ''} in your squad`);
    homeWrapper.appendChild(badge);
  }

  /* ── Fetch injury count ──────────────────────────────────── */

  async function getInjuryCount() {
    const cached = getCached();
    if (cached !== null) return cached;

    const teamId = localStorage.getItem(STORAGE_KEY_ID);
    if (!teamId) return 0;

    // 1. Get bootstrap (players list)
    const res       = await fetch(PROXY_BOOTSTRAP);
    const bootstrap = await res.json();
    const elements  = bootstrap.elements;

    // 2. Find current GW
    const currentEvent = bootstrap.events.find(e => e.is_current)
                      || bootstrap.events.find(e => !e.finished);
    if (!currentEvent) return 0;
    const gwId = currentEvent.id;

    // 3. Fetch user's picks for this GW
    const picksRes  = await fetch(
      `/.netlify/functions/fpl-proxy?endpoint=entry/${teamId}/event/${gwId}/picks/`
    );
    const picksData = await picksRes.json();
    const picks     = picksData.picks || [];

    if (!picks.length) return 0;

    // 4. Build player lookup
    const playerMap = {};
    elements.forEach(p => { playerMap[p.id] = p; });

    // 5. Count squad players with red/amber injury flag
    let count = 0;
    picks.forEach(pick => {
      const player = playerMap[pick.element];
      if (!player) return;
      const chance = player.chance_of_playing_next_round;
      if (chance !== null && chance <= 25) count++;
    });

    setCache(count);
    return count;
  }

  /* ── Main ────────────────────────────────────────────────── */

  async function init() {
    // If home page — clear badge and stop
    if (isHomePage()) {
      renderBadge(0);
      sessionStorage.removeItem(CACHE_KEY);
      return;
    }

    try {
      const count = await getInjuryCount();

      // Wait for nav to be in the DOM before painting the badge
      function paint() { renderBadge(count); }

      const homeWrapper = document.querySelector(
        '.kfl-bottom-nav__item[href="index.html"] .kfl-bottom-nav__icon-wrapper'
      );

      if (homeWrapper) {
        paint();
      } else {
        // Nav rendered after this script — observe
        const observer = new MutationObserver((_, obs) => {
          const el = document.querySelector(
            '.kfl-bottom-nav__item[href="index.html"] .kfl-bottom-nav__icon-wrapper'
          );
          if (el) { obs.disconnect(); paint(); }
        });
        observer.observe(document.body, { childList: true, subtree: true });
      }

    } catch (err) {
      console.warn('[Badge] Could not compute badge:', err);
    }
  }

  // Public API — call after a transfer to force a refresh
  window.KopalaBadge = {
    refresh() {
      sessionStorage.removeItem(CACHE_KEY);
      return init();
    },
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
