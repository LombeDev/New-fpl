/**
 * weekly-digest.js — Kopala FPL
 * ─────────────────────────────────────────────────────────────
 * Shows a fullscreen recap card on the first app open after a
 * gameweek finalises. Dismisses with a swipe down or tap.
 * Stores last_seen_gw in localStorage so it only shows once per GW.
 *
 * Data pulled from:
 *   - bootstrap-static  → events, elements
 *   - entry/{id}/event/{gw}/picks/ → picks + entry_history
 *
 * Usage: <script src="weekly-digest.js"></script>
 */

(function () {
  'use strict';

  const PROXY       = '/.netlify/functions/fpl-proxy?endpoint=';
  const STORAGE_ID  = 'kopala_id';
  const STORAGE_GW  = 'kopala_digest_seen_gw';

  /* ── One-liner pool ──────────────────────────────────────── */
  const ONE_LINERS = {
    great:   ['Absolutely balling. \uD83D\uDD25', 'Top red arrow energy.', 'The algorithm fears you.', 'Touch grass. You peaked.', 'FPL gods are watching over you.'],
    good:    ['Solid week. Keep building.', 'Green arrow secured. Respectable.', 'Not bad at all, manager.', 'The plan is coming together.', 'Quietly impressive.'],
    average: ['Mid. But we move.', 'The template betrayed us again.', 'Horizontal arrow haver.', 'Points on the board. Barely.', 'It is what it is, chief.'],
    bad:     ['This is fine. \uD83D\uDD25\uD83D\uDD25\uD83D\uDD25', 'Wildcard szn incoming?', 'The captain pick said what it said.', 'We go again. Unfortunately.', 'Genuinely impressive how wrong that was.'],
  };

  function getOneLiner(pts, avgPts) {
    const diff = pts - avgPts;
    const pool = diff >= 15 ? ONE_LINERS.great
               : diff >= 5  ? ONE_LINERS.good
               : diff >= -5 ? ONE_LINERS.average
               :               ONE_LINERS.bad;
    return pool[Math.floor(Math.random() * pool.length)];
  }

  /* ── Inject styles ───────────────────────────────────────── */
  const style = document.createElement('style');
  style.textContent = `
    /* Use site fonts already loaded on page */
    .kfl-digest-overlay {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 20px;
      background: rgba(0,0,0,0);
      transition: background 0.3s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .kfl-digest-overlay.is-ready {
      background: rgba(0,0,0,0.55);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
    }

    /* ── Card ── */
    .kfl-digest-card {
      width: 100%;
      max-width: 300px;
      border-radius: 20px;
      background: var(--kfl-surface, #141e2d);
      border: 1px solid var(--kfl-border, rgba(255,255,255,0.07));
      box-shadow: 0 20px 60px rgba(0,0,0,0.6);
      overflow: hidden;
      position: relative;
      transform: scale(0.9) translateY(16px);
      opacity: 0;
      transition: transform 0.38s cubic-bezier(0.34,1.4,0.64,1), opacity 0.28s ease;
      will-change: transform, opacity;
      cursor: grab;
    }
    .kfl-digest-overlay.is-ready .kfl-digest-card {
      transform: scale(1) translateY(0);
      opacity: 1;
    }
    .kfl-digest-card.is-dragging { transition: none; cursor: grabbing; }

    /* green left border accent */
    .kfl-digest-card::after {
      content: '';
      position: absolute;
      top: 16px; bottom: 16px; left: 0;
      width: 3px;
      background: var(--kfl-green, #00e868);
      border-radius: 0 3px 3px 0;
      box-shadow: 0 0 8px var(--kfl-green-glow, rgba(0,232,104,0.3));
    }

    /* ── Top row: label + close ── */
    .kfl-digest-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 14px 14px 0 18px;
    }
    .kfl-digest-gw-label {
      font-family: 'Barlow Condensed', 'Syne', sans-serif;
      font-size: 0.6rem;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--kfl-green, #00e868);
      display: flex;
      align-items: center;
      gap: 5px;
    }
    .kfl-digest-chip-badge {
      background: rgba(245,158,11,0.14);
      color: #f59e0b;
      padding: 1px 6px;
      border-radius: 100px;
      font-size: 0.5rem;
      font-weight: 800;
      letter-spacing: 1px;
    }
    .kfl-digest-close {
      width: 24px; height: 24px;
      border-radius: 50%;
      background: var(--kfl-surface-2, rgba(255,255,255,0.06));
      border: 1px solid var(--kfl-border, rgba(255,255,255,0.07));
      color: var(--kfl-text-3, rgba(255,255,255,0.3));
      display: flex; align-items: center; justify-content: center;
      cursor: pointer;
      font-size: 0.6rem;
      transition: background 0.15s, color 0.15s;
      flex-shrink: 0;
    }
    .kfl-digest-close:hover {
      background: rgba(255,255,255,0.12);
      color: var(--kfl-text-1, #fff);
    }

    /* ── Score block ── */
    .kfl-digest-hero {
      text-align: center;
      padding: 8px 14px 10px;
      position: relative;
    }
    .kfl-digest-hero__glow {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%,-50%);
      width: 130px; height: 130px;
      border-radius: 50%;
      background: radial-gradient(circle, var(--digest-glow, rgba(0,232,104,0.08)) 0%, transparent 70%);
      pointer-events: none;
    }
    .kfl-digest-score {
      font-family: 'Barlow Condensed', 'Syne', sans-serif;
      font-size: 3rem;
      font-weight: 900;
      line-height: 1;
      color: var(--kfl-text-1, #fff);
      letter-spacing: -1px;
      position: relative;
    }
    .kfl-digest-score__pts {
      font-size: 0.85rem;
      font-weight: 700;
      color: var(--kfl-text-3, rgba(255,255,255,0.28));
      letter-spacing: 0;
      vertical-align: super;
      margin-left: 2px;
    }
    .kfl-digest-one-liner {
      font-family: 'DM Sans', sans-serif;
      font-size: 0.65rem;
      color: var(--kfl-text-3, rgba(255,255,255,0.35));
      margin-top: 3px;
      font-style: italic;
    }

    /* ── Rank pills ── */
    .kfl-digest-rank-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      margin-top: 7px;
    }
    .kfl-digest-rank-badge {
      font-family: 'DM Sans', sans-serif;
      font-size: 0.62rem;
      font-weight: 600;
      padding: 2px 9px;
      border-radius: 100px;
      background: var(--kfl-surface-2, rgba(255,255,255,0.05));
      color: var(--kfl-text-2, rgba(255,255,255,0.5));
      border: 1px solid var(--kfl-border, rgba(255,255,255,0.07));
    }
    .kfl-digest-rank-arrow {
      font-family: 'DM Sans', sans-serif;
      font-size: 0.62rem;
      font-weight: 700;
      padding: 2px 9px;
      border-radius: 100px;
    }
    .kfl-digest-rank-arrow.up   { background: rgba(0,232,104,0.12); color: var(--kfl-green, #00e868); }
    .kfl-digest-rank-arrow.down { background: rgba(239,68,68,0.12);  color: #ef4444; }
    .kfl-digest-rank-arrow.same { background: var(--kfl-surface-2, rgba(255,255,255,0.05)); color: var(--kfl-text-3, rgba(255,255,255,0.35)); }

    /* ── Divider ── */
    .kfl-digest-divider {
      height: 1px;
      background: var(--kfl-border, rgba(255,255,255,0.05));
      margin: 6px 14px;
    }

    /* ── Stat rows ── */
    .kfl-digest-stats {
      padding: 2px 18px 6px;
    }
    .kfl-digest-stat-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 5px 0;
      border-bottom: 1px solid var(--kfl-border, rgba(255,255,255,0.04));
    }
    .kfl-digest-stat-row:last-child { border-bottom: none; }
    .kfl-digest-stat-row__label {
      font-family: 'DM Sans', sans-serif;
      font-size: 0.68rem;
      color: var(--kfl-text-2, rgba(255,255,255,0.38));
      font-weight: 500;
    }
    .kfl-digest-stat-row__value {
      font-family: 'Barlow Condensed', 'Syne', sans-serif;
      font-size: 0.8rem;
      font-weight: 700;
      color: var(--kfl-text-1, #fff);
      letter-spacing: 0.2px;
    }
    .kfl-digest-stat-row__value.positive { color: var(--kfl-green, #00e868); }
    .kfl-digest-stat-row__value.negative { color: #ef4444; }

    /* ── Best / Worst players ── */
    .kfl-digest-players {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      padding: 0 14px 6px;
    }
    .kfl-digest-player {
      border-radius: 10px;
      padding: 8px 10px;
      border: 1px solid transparent;
    }
    .kfl-digest-player--best  {
      background: rgba(0,232,104,0.06);
      border-color: rgba(0,232,104,0.12);
    }
    .kfl-digest-player--worst {
      background: rgba(239,68,68,0.06);
      border-color: rgba(239,68,68,0.10);
    }
    .kfl-digest-player__tag {
      font-family: 'DM Sans', sans-serif;
      font-size: 0.46rem;
      font-weight: 800;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      margin-bottom: 3px;
    }
    .kfl-digest-player--best  .kfl-digest-player__tag { color: rgba(0,232,104,0.5); }
    .kfl-digest-player--worst .kfl-digest-player__tag { color: rgba(239,68,68,0.5); }
    .kfl-digest-player__name {
      font-family: 'Barlow Condensed', 'Syne', sans-serif;
      font-size: 0.82rem;
      font-weight: 700;
      color: var(--kfl-text-1, #fff);
      line-height: 1.1;
      margin-bottom: 2px;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .kfl-digest-player__pts {
      font-family: 'Barlow Condensed', 'Syne', sans-serif;
      font-size: 1rem;
      font-weight: 800;
      line-height: 1;
    }
    .kfl-digest-player--best  .kfl-digest-player__pts { color: var(--kfl-green, #00e868); }
    .kfl-digest-player--worst .kfl-digest-player__pts { color: #ef4444; }
    .kfl-digest-player__pts-label {
      font-size: 0.5rem;
      color: var(--kfl-text-3, rgba(255,255,255,0.22));
      margin-left: 1px;
    }

    /* ── Captain row ── */
    .kfl-digest-captain {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 0 14px 12px;
      background: rgba(245,158,11,0.06);
      border: 1px solid rgba(245,158,11,0.12);
      border-radius: 10px;
      padding: 8px 10px;
    }
    .kfl-digest-captain__armband {
      width: 26px; height: 26px;
      border-radius: 50%;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 0.7rem; font-weight: 900;
      color: #fff;
      flex-shrink: 0;
      box-shadow: 0 0 8px rgba(245,158,11,0.22);
    }
    .kfl-digest-captain__info { flex: 1; min-width: 0; }
    .kfl-digest-captain__label {
      font-family: 'DM Sans', sans-serif;
      font-size: 0.46rem;
      font-weight: 800;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: rgba(245,158,11,0.5);
      margin-bottom: 1px;
    }
    .kfl-digest-captain__name {
      font-family: 'Barlow Condensed', 'Syne', sans-serif;
      font-size: 0.85rem; font-weight: 700;
      color: var(--kfl-text-1, #fff);
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
    }
    .kfl-digest-captain__pts {
      font-family: 'Barlow Condensed', 'Syne', sans-serif;
      font-size: 1.05rem; font-weight: 800;
      color: #f59e0b;
      flex-shrink: 0;
      text-align: right;
      line-height: 1;
    }
    .kfl-digest-captain__pts-label {
      font-family: 'DM Sans', sans-serif;
      font-size: 0.48rem;
      color: var(--kfl-text-3, rgba(255,255,255,0.22));
      display: block;
      text-align: right;
    }

    /* ── Swipe hint ── */
    .kfl-digest-swipe-hint {
      text-align: center;
      font-family: 'DM Sans', sans-serif;
      font-size: 0.52rem;
      color: var(--kfl-text-3, rgba(255,255,255,0.13));
      padding-bottom: 10px;
      letter-spacing: 0.3px;
    }

    /* ── Stagger animations ── */
    .kfl-digest-card .kfl-digest-header,
    .kfl-digest-card .kfl-digest-hero,
    .kfl-digest-card .kfl-digest-divider,
    .kfl-digest-card .kfl-digest-stats,
    .kfl-digest-card .kfl-digest-players,
    .kfl-digest-card .kfl-digest-captain,
    .kfl-digest-card .kfl-digest-swipe-hint {
      opacity: 0;
      transform: translateY(6px);
      animation: kfl-d-up 0.3s ease forwards;
    }
    .kfl-digest-card .kfl-digest-header     { animation-delay: 0.16s; }
    .kfl-digest-card .kfl-digest-hero       { animation-delay: 0.21s; }
    .kfl-digest-card .kfl-digest-divider    { animation-delay: 0.25s; }
    .kfl-digest-card .kfl-digest-stats      { animation-delay: 0.28s; }
    .kfl-digest-card .kfl-digest-players    { animation-delay: 0.32s; }
    .kfl-digest-card .kfl-digest-captain    { animation-delay: 0.35s; }
    .kfl-digest-card .kfl-digest-swipe-hint { animation-delay: 0.38s; }

    @keyframes kfl-d-up {
      to { opacity: 1; transform: translateY(0); }
    }

    /* ── Light theme ── */
    [data-theme="light"] .kfl-digest-card            { background: #ffffff; }
    [data-theme="light"] .kfl-digest-score           { color: #0a0e1a; }
    [data-theme="light"] .kfl-digest-one-liner        { color: rgba(0,0,0,0.32); }
    [data-theme="light"] .kfl-digest-rank-badge      { background: rgba(0,0,0,0.04); border-color: rgba(0,0,0,0.07); color: rgba(0,0,0,0.42); }
    [data-theme="light"] .kfl-digest-divider         { background: rgba(0,0,0,0.05); }
    [data-theme="light"] .kfl-digest-stat-row__label { color: rgba(0,0,0,0.4); }
    [data-theme="light"] .kfl-digest-stat-row__value { color: #0a0e1a; }
    [data-theme="light"] .kfl-digest-stat-row        { border-bottom-color: rgba(0,0,0,0.05); }
    [data-theme="light"] .kfl-digest-player__name    { color: #0a0e1a; }
    [data-theme="light"] .kfl-digest-captain__name   { color: #0a0e1a; }
    [data-theme="light"] .kfl-digest-close           { background: rgba(0,0,0,0.04); color: rgba(0,0,0,0.35); }
    [data-theme="light"] .kfl-digest-swipe-hint      { color: rgba(0,0,0,0.16); }
  `;
  document.head.appendChild(style);

  /* ── Fetch helpers ───────────────────────────────────────── */
  async function fetchBootstrap() {
    const res = await fetch(PROXY + 'bootstrap-static/');
    return res.json();
  }
  async function fetchPicks(teamId, gw) {
    const res = await fetch(PROXY + `entry/${teamId}/event/${gw}/picks/`);
    return res.json();
  }
  async function fetchLive(gw) {
    const res = await fetch(PROXY + `event/${gw}/live/`);
    return res.json();
  }

  /* ── Helpers ─────────────────────────────────────────────── */
  function fmtRank(n) {
    if (!n) return '\u2014';
    return n >= 1000000 ? (n/1000000).toFixed(1)+'M'
         : n >= 1000    ? (n/1000).toFixed(0)+'k'
         : String(n);
  }
  function rankDiff(cur, prev) {
    if (!cur || !prev) return { dir: 'same', text: '\u2014' };
    const d = prev - cur;
    if (d > 0) return { dir: 'up',   text: '\u2191 ' + fmtRank(d) };
    if (d < 0) return { dir: 'down', text: '\u2193 ' + fmtRank(Math.abs(d)) };
    return { dir: 'same', text: '\u2192' };
  }

  /* ── Build compact card HTML ─────────────────────────────── */
  function buildCard(data) {
    const {
      gwName, gwPoints, totalPoints, overallRank, prevRank,
      avgPoints, bestPlayer, worstPlayer, captain, captainPts,
      transfers, transferCost, chip,
    } = data;

    const arrow    = rankDiff(overallRank, prevRank);
    const oneLiner = getOneLiner(gwPoints, avgPoints);
    const diff     = gwPoints - avgPoints;
    const glowColor = diff >= 15 ? 'rgba(0,232,104,0.13)'
                    : diff >= 0  ? 'rgba(0,232,104,0.07)'
                    :               'rgba(239,68,68,0.09)';

    const chipBadge = chip && chip !== 'n/a'
      ? '<span class="kfl-digest-chip-badge">' + chip.replace(/_/g,' ') + '</span>'
      : '';

    const vsAvg   = gwPoints - avgPoints;
    const vsClass = vsAvg >= 0 ? 'positive' : 'negative';
    const vsText  = (vsAvg >= 0 ? '+' : '') + vsAvg + ' vs avg';
    const hitText = transferCost > 0 ? transfers + ' · -' + transferCost + ' hit' : transfers + ' · no hit';
    const hitClass = transferCost > 0 ? 'negative' : '';

    return `
      <div class="kfl-digest-header">
        <span class="kfl-digest-gw-label">${gwName} Recap ${chipBadge}</span>
        <button class="kfl-digest-close" id="kfl-digest-close" aria-label="Close">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="kfl-digest-hero">
        <div class="kfl-digest-hero__glow" style="--digest-glow:${glowColor}"></div>
        <div class="kfl-digest-score">${gwPoints}<span class="kfl-digest-score__pts">pts</span></div>
        <div class="kfl-digest-one-liner">${oneLiner}</div>
        <div class="kfl-digest-rank-row">
          <span class="kfl-digest-rank-badge">
            <i class="fa-solid fa-earth-africa" style="margin-right:3px;font-size:0.58rem;opacity:0.45"></i>${fmtRank(overallRank)}
          </span>
          <span class="kfl-digest-rank-arrow ${arrow.dir}">${arrow.text}</span>
        </div>
      </div>

      <div class="kfl-digest-divider"></div>

      <div class="kfl-digest-stats">
        <div class="kfl-digest-stat-row">
          <span class="kfl-digest-stat-row__label">GW Average</span>
          <span class="kfl-digest-stat-row__value">${avgPoints} pts</span>
        </div>
        <div class="kfl-digest-stat-row">
          <span class="kfl-digest-stat-row__label">vs Average</span>
          <span class="kfl-digest-stat-row__value ${vsClass}">${vsText}</span>
        </div>
        <div class="kfl-digest-stat-row">
          <span class="kfl-digest-stat-row__label">Total</span>
          <span class="kfl-digest-stat-row__value">${totalPoints} pts</span>
        </div>
        <div class="kfl-digest-stat-row">
          <span class="kfl-digest-stat-row__label">Transfers</span>
          <span class="kfl-digest-stat-row__value ${hitClass}">${hitText}</span>
        </div>
      </div>

      <div class="kfl-digest-divider"></div>

      <div class="kfl-digest-players">
        <div class="kfl-digest-player kfl-digest-player--best">
          <div class="kfl-digest-player__tag">\u26A1 Best</div>
          <div class="kfl-digest-player__name">${bestPlayer.name}</div>
          <div class="kfl-digest-player__pts">${bestPlayer.pts}<span class="kfl-digest-player__pts-label">pts</span></div>
        </div>
        <div class="kfl-digest-player kfl-digest-player--worst">
          <div class="kfl-digest-player__tag">\uD83D\uDE2C Worst</div>
          <div class="kfl-digest-player__name">${worstPlayer.name}</div>
          <div class="kfl-digest-player__pts">${worstPlayer.pts}<span class="kfl-digest-player__pts-label">pts</span></div>
        </div>
      </div>

      <div class="kfl-digest-captain">
        <div class="kfl-digest-captain__armband">C</div>
        <div class="kfl-digest-captain__info">
          <div class="kfl-digest-captain__label">Captain</div>
          <div class="kfl-digest-captain__name">${captain}</div>
        </div>
        <div>
          <div class="kfl-digest-captain__pts">${captainPts}</div>
          <span class="kfl-digest-captain__pts-label">pts (\xD72)</span>
        </div>
      </div>

      <div class="kfl-digest-swipe-hint">Tap outside or swipe to dismiss</div>
    `;
  }

  /* ── Mount & interactions ────────────────────────────────── */
  function mount(html) {
    const overlay = document.createElement('div');
    overlay.className = 'kfl-digest-overlay';
    overlay.id        = 'kfl-digest-overlay';

    const card = document.createElement('div');
    card.className = 'kfl-digest-card';
    card.id        = 'kfl-digest-card';
    card.innerHTML = html;

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    // Animate in
    requestAnimationFrame(() => {
      requestAnimationFrame(() => overlay.classList.add('is-ready'));
    });

    // Close handlers
    function dismiss() {
      overlay.classList.remove('is-ready');
      card.style.transition = 'transform 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.22s ease';
      card.style.transform = 'scale(0.9) translateY(10px)'; card.style.opacity = '0';
      setTimeout(() => overlay.remove(), 380);
    }

    document.getElementById('kfl-digest-close')?.addEventListener('click', dismiss);
    document.getElementById('kfl-digest-cta')?.addEventListener('click', () => {
      dismiss();
      setTimeout(() => { window.location.href = 'index.html'; }, 200);
    });

    // Tap overlay background to dismiss
    overlay.addEventListener('click', e => {
      if (e.target === overlay) dismiss();
    });

    // Swipe-down to dismiss
    let startY = 0, currentY = 0, isDragging = false;

    card.addEventListener('touchstart', e => {
      startY     = e.touches[0].clientY;
      isDragging = true;
      card.classList.add('is-dragging');
    }, { passive: true });

    card.addEventListener('touchmove', e => {
      if (!isDragging) return;
      currentY = e.touches[0].clientY;
      const delta = Math.max(0, currentY - startY); // only downward
      card.style.transform = `translateY(${delta}px)`;
      overlay.style.background = `rgba(0,0,0,${Math.max(0, 0.72 - delta / 400)})`;
    }, { passive: true });

    card.addEventListener('touchend', () => {
      isDragging = false;
      card.classList.remove('is-dragging');
      const delta = currentY - startY;
      if (delta > 100) {
        dismiss();
      } else {
        // Snap back
        card.style.transition = 'transform 0.3s cubic-bezier(0.34,1.2,0.64,1), opacity 0.25s ease';
        card.style.transform  = 'translateY(0)';
        overlay.style.background = 'rgba(0,0,0,0.72)';
      }
    });
  }

  /* ── Main ────────────────────────────────────────────────── */
  async function init() {
    const teamId = localStorage.getItem(STORAGE_ID);
    if (!teamId) return;

    // Fetch bootstrap first to find last finished GW
    let bootstrap;
    try {
      bootstrap = await fetchBootstrap();
    } catch { return; }

    const lastFinished = [...bootstrap.events]
      .reverse()
      .find(e => e.finished && e.data_checked);

    if (!lastFinished) return;

    const gwId = lastFinished.id;

    // Already seen this GW's digest?
    const seenGw = localStorage.getItem(STORAGE_GW);
    if (seenGw && Number(seenGw) >= gwId) return;

    // Mark as seen immediately so a failed fetch doesn't loop
    localStorage.setItem(STORAGE_GW, String(gwId));

    // Fetch picks + live data
    let picksData, liveData;
    try {
      [picksData, liveData] = await Promise.all([
        fetchPicks(teamId, gwId),
        fetchLive(gwId),
      ]);
    } catch { return; }

    const picks   = picksData.picks || [];
    const history = picksData.entry_history;
    if (!picks.length || !history) return;

    // Build player lookup
    const playerMap = {};
    bootstrap.elements.forEach(p => { playerMap[p.id] = p; });

    // Build live points lookup
    const liveMap = {};
    (liveData.elements || []).forEach(e => {
      liveMap[e.id] = e.stats?.total_points ?? 0;
    });

    // Analyse picks
    let bestPlayer  = { name: '—', pts: 0 };
    let worstPlayer = { name: '—', pts: 99 };
    let captainName = '—';
    let captainPts  = 0;

    picks.forEach(pick => {
      const player   = playerMap[pick.element];
      if (!player) return;
      const name     = player.web_name;
      const rawPts   = liveMap[pick.element] ?? 0;
      const pts      = pick.is_captain ? rawPts * pick.multiplier : rawPts;

      if (rawPts > bestPlayer.pts)  bestPlayer  = { name, pts: rawPts };
      if (rawPts < worstPlayer.pts) worstPlayer = { name, pts: rawPts };
      if (pick.is_captain) { captainName = name; captainPts = rawPts; }
    });

    // Patch worst player edge case
    if (worstPlayer.pts === 99) worstPlayer = { name: '—', pts: 0 };

    // GW average from event data
    const eventData = bootstrap.events.find(e => e.id === gwId);
    const avgPoints = eventData?.average_entry_score ?? 0;

    const chip = history.event_transfers_cost === 0 && picksData.active_chip
      ? picksData.active_chip
      : 'n/a';

    const digestData = {
      gwName:       lastFinished.name,
      gwPoints:     history.points,
      totalPoints:  history.total_points,
      overallRank:  history.overall_rank,
      prevRank:     history.rank_sort,   // previous event rank used for delta
      avgPoints,
      bestPlayer,
      worstPlayer,
      captain:      captainName,
      captainPts,
      transfers:    history.event_transfers,
      transferCost: history.event_transfers_cost,
      chip,
    };

    // Small delay so the page loads first
    setTimeout(() => mount(buildCard(digestData)), 800);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Public API — force show for testing
  window.KopalaDigest = {
    show: () => {
      localStorage.removeItem(STORAGE_GW);
      init();
    },
  };

})();
