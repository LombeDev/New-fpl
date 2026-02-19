/**
 * deadline.js — Kopala FPL
 * Live countdown to next FPL deadline + collapsible upcoming deadlines table.
 *
 * Visual states:
 *  loading  → shimmer bar
 *  normal   → dark banner with ticking countdown
 *  imminent → < 1 hour, red pulsing numbers
 *  passed   → green ✓ (no jarring location.reload())
 *  error    → quiet fallback
 */

(function () {
  'use strict';

  const PROXY = '/.netlify/functions/fpl-proxy?endpoint=bootstrap-static/';
  const container = document.getElementById('deadline-container');
  if (!container) return;

  let tickInterval = null;

  /* ============================================
     INJECT STYLES
     ============================================ */
  const style = document.createElement('style');
  style.textContent = `
    /* ---- Shimmer ---- */
    .dl-shimmer {
      height: 52px;
      background: linear-gradient(90deg, #1a1a1a 25%, #242424 50%, #1a1a1a 75%);
      background-size: 400% 100%;
      animation: dl-shimmer 1.6s ease infinite;
    }
    @keyframes dl-shimmer {
      from { background-position: -200% 0; }
      to   { background-position:  200% 0; }
    }

    /* ---- Outer wrapper ---- */
    .dl-wrap {
      border-bottom: 1px solid rgba(255,255,255,0.06);
      overflow: hidden;
    }

    /* ---- Top banner ---- */
    .dl-banner {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      background: linear-gradient(90deg, #1a0d1c 0%, #111 100%);
      min-height: 52px;
      gap: 12px;
      overflow: hidden;
      cursor: pointer;
      -webkit-tap-highlight-color: transparent;
      transition: background 0.4s ease;
      user-select: none;
    }

    /* Ambient sweep */
    .dl-banner::before {
      content: '';
      position: absolute;
      inset: 0;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.025), transparent);
      background-size: 200% 100%;
      animation: dl-sweep 5s linear infinite;
      pointer-events: none;
    }
    @keyframes dl-sweep {
      from { background-position: -200% 0; }
      to   { background-position:  200% 0; }
    }

    .dl-banner.imminent {
      background: linear-gradient(90deg, #3b0000 0%, #1a0000 100%);
    }
    .dl-banner.passed {
      background: linear-gradient(90deg, #001a0d 0%, #111 100%);
    }

    /* ---- Left ---- */
    .dl-left {
      display: flex;
      flex-direction: column;
      gap: 3px;
      position: relative;
      z-index: 1;
      flex-shrink: 0;
    }

    .dl-eyebrow {
      font-size: 0.56rem;
      font-weight: 700;
      letter-spacing: 1.4px;
      text-transform: uppercase;
      color: rgba(255,255,255,0.38);
      line-height: 1;
      transition: color 0.3s;
    }
    .dl-banner.imminent .dl-eyebrow { color: rgba(239,68,68,0.65); }
    .dl-banner.passed   .dl-eyebrow { color: rgba(0,232,122,0.5); }

    .dl-gw-name {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 0.9rem;
      font-weight: 800;
      color: rgba(255,255,255,0.8);
      line-height: 1;
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .dl-gw-name i { color: #00e87a; font-size: 0.65rem; }

    /* ---- Right ---- */
    .dl-right {
      display: flex;
      align-items: center;
      gap: 10px;
      position: relative;
      z-index: 1;
    }

    .dl-countdown {
      display: flex;
      align-items: baseline;
      gap: 1px;
    }

    .dl-unit {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 30px;
    }

    .dl-unit__val {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 1.45rem;
      font-weight: 900;
      line-height: 1;
      color: #fff;
      font-variant-numeric: tabular-nums;
      letter-spacing: -0.5px;
      transition: color 0.3s;
    }

    .dl-unit__lbl {
      font-size: 0.45rem;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: rgba(255,255,255,0.28);
      line-height: 1;
      margin-top: 2px;
    }

    .dl-sep {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 1.2rem;
      font-weight: 900;
      color: rgba(255,255,255,0.2);
      line-height: 1;
      margin-bottom: 8px;
      padding: 0 1px;
    }

    /* Days unit hidden when < 1 day remaining */
    #dl-days-unit { display: none; }
    #dl-days-sep  { display: none; }
    #dl-days-unit.show { display: flex; }
    #dl-days-sep.show  { display: inline; }

    /* Imminent: pulse red */
    .dl-banner.imminent .dl-unit__val {
      color: #ef4444;
      animation: dl-pulse 0.9s ease-in-out infinite;
    }
    .dl-banner.imminent .dl-sep { color: rgba(239,68,68,0.3); }

    @keyframes dl-pulse {
      0%, 100% { opacity: 1; }
      50%       { opacity: 0.5; }
    }

    /* Passed */
    .dl-passed-msg {
      display: none;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 1rem;
      font-weight: 800;
      color: #00e87a;
      align-items: center;
      gap: 6px;
    }
    .dl-banner.passed .dl-countdown   { display: none; }
    .dl-banner.passed .dl-passed-msg  { display: flex; }

    /* Expand chevron */
    .dl-chevron {
      font-size: 0.7rem;
      color: rgba(255,255,255,0.22);
      transition: transform 0.25s ease, color 0.2s;
      flex-shrink: 0;
    }
    .dl-wrap.open .dl-chevron {
      transform: rotate(180deg);
      color: rgba(255,255,255,0.5);
    }

    /* ---- Collapsible upcoming table ---- */
    .dl-upcoming {
      max-height: 0;
      overflow: hidden;
      transition: max-height 0.35s cubic-bezier(0.4,0,0.2,1);
      background: #0d0d0d;
    }
    .dl-wrap.open .dl-upcoming {
      max-height: 320px;
    }

    .dl-upcoming-inner {
      padding: 0 16px 14px;
    }

    .dl-table-header {
      display: flex;
      justify-content: space-between;
      padding: 11px 0 8px;
      border-bottom: 1px solid rgba(255,255,255,0.07);
      margin-bottom: 2px;
      font-size: 0.56rem;
      font-weight: 700;
      letter-spacing: 1.3px;
      text-transform: uppercase;
      color: rgba(255,255,255,0.28);
    }

    .dl-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 9px 0;
      border-bottom: 1px solid rgba(255,255,255,0.04);
    }
    .dl-row:last-child { border-bottom: none; }

    .dl-row__gw {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 0.88rem;
      font-weight: 800;
      color: rgba(255,255,255,0.72);
    }

    .dl-row__date {
      font-size: 0.73rem;
      font-weight: 500;
      color: rgba(255,255,255,0.38);
    }

    /* Error */
    .dl-error {
      height: 52px;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
      font-size: 0.72rem;
      color: rgba(255,255,255,0.25);
      background: #111;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
  `;
  document.head.appendChild(style);

  /* ============================================
     RENDER HELPERS
     ============================================ */
  function renderLoading() {
    container.innerHTML = `<div class="dl-shimmer"></div>`;
  }

  function renderError() {
    container.innerHTML = `
      <div class="dl-error">
        <i class="fa-solid fa-triangle-exclamation" style="opacity:0.4"></i>
        Deadline data unavailable
      </div>`;
  }

  function fmtDate(iso) {
    return new Date(iso).toLocaleDateString('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
    }).replace(',', '');
  }

  function renderUI(nextEvent, upcoming) {
    const upcomingRows = upcoming.slice(1, 5).map(e => `
      <div class="dl-row">
        <span class="dl-row__gw">${e.name}</span>
        <span class="dl-row__date">${fmtDate(e.deadline_time)}</span>
      </div>
    `).join('') || `
      <div class="dl-row">
        <span class="dl-row__date" style="width:100%;text-align:center;opacity:0.5">
          No further deadlines this season
        </span>
      </div>`;

    container.innerHTML = `
      <div class="dl-wrap" id="dl-wrap">

        <div class="dl-banner" id="dl-banner" role="button" aria-expanded="false" aria-label="Toggle upcoming deadlines">
          <div class="dl-left">
            <div class="dl-eyebrow">Next Deadline</div>
            <div class="dl-gw-name">
              <i class="fa-solid fa-calendar-check"></i>
              ${nextEvent.name}
            </div>
          </div>

          <div class="dl-right">
            <div class="dl-countdown" id="dl-countdown">
              <div class="dl-unit" id="dl-days-unit">
                <span class="dl-unit__val" id="dl-days">00</span>
                <span class="dl-unit__lbl">days</span>
              </div>
              <span class="dl-sep" id="dl-days-sep">:</span>
              <div class="dl-unit">
                <span class="dl-unit__val" id="dl-hours">00</span>
                <span class="dl-unit__lbl">hrs</span>
              </div>
              <span class="dl-sep">:</span>
              <div class="dl-unit">
                <span class="dl-unit__val" id="dl-mins">00</span>
                <span class="dl-unit__lbl">min</span>
              </div>
              <span class="dl-sep">:</span>
              <div class="dl-unit">
                <span class="dl-unit__val" id="dl-secs">00</span>
                <span class="dl-unit__lbl">sec</span>
              </div>
            </div>
            <div class="dl-passed-msg" id="dl-passed-msg">
              <i class="fa-solid fa-circle-check"></i> Passed
            </div>
            <i class="fa-solid fa-chevron-down dl-chevron" id="dl-chevron" aria-hidden="true"></i>
          </div>
        </div>

        <div class="dl-upcoming" id="dl-upcoming" aria-hidden="true">
          <div class="dl-upcoming-inner">
            <div class="dl-table-header">
              <span>Gameweek</span>
              <span>Deadline</span>
            </div>
            ${upcomingRows}
          </div>
        </div>

      </div>
    `;

    // Toggle on banner click
    const wrap   = document.getElementById('dl-wrap');
    const banner = document.getElementById('dl-banner');
    const panel  = document.getElementById('dl-upcoming');

    banner.addEventListener('click', () => {
      const isOpen = wrap.classList.toggle('open');
      banner.setAttribute('aria-expanded', isOpen);
      panel.setAttribute('aria-hidden', !isOpen);
    });
  }

  /* ============================================
     TICK
     ============================================ */
  function startTick(deadlineIso) {
    const target = new Date(deadlineIso).getTime();

    function tick() {
      const diff   = target - Date.now();
      const banner = document.getElementById('dl-banner');
      if (!banner) { clearInterval(tickInterval); return; }

      if (diff <= 0) {
        clearInterval(tickInterval);
        banner.classList.add('passed');
        banner.classList.remove('imminent');
        return;
      }

      const s    = Math.floor(diff / 1000);
      const days = Math.floor(s / 86400);
      const hrs  = Math.floor((s % 86400) / 3600);
      const mins = Math.floor((s % 3600) / 60);
      const secs = s % 60;

      // Days column visibility
      document.getElementById('dl-days-unit')?.classList.toggle('show', days > 0);
      document.getElementById('dl-days-sep')?.classList.toggle('show', days > 0);

      set('dl-days',  pad(days));
      set('dl-hours', pad(hrs));
      set('dl-mins',  pad(mins));
      set('dl-secs',  pad(secs));

      banner.classList.toggle('imminent', s < 3600);
    }

    tick();
    tickInterval = setInterval(tick, 1000);
  }

  const pad = n => String(n).padStart(2, '0');
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };

  /* ============================================
     FETCH & BOOT
     ============================================ */
  async function init() {
    renderLoading();
    try {
      const res  = await fetch(PROXY);
      const data = await res.json();

      const now      = Date.now();
      const upcoming = data.events.filter(e => new Date(e.deadline_time).getTime() > now);
      const next     = upcoming[0];

      if (!next) { container.innerHTML = ''; return; }

      renderUI(next, upcoming);
      startTick(next.deadline_time);

    } catch (err) {
      console.error('[Deadline]', err);
      renderError();
    }
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();

  window.addEventListener('pagehide', () => clearInterval(tickInterval));

})();
