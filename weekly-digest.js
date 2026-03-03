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
    great:   ['Absolutely balling. 🔥', 'Top red arrow energy.', 'The algorithm fears you.', 'Touch grass, you've peaked.', 'FPL gods are watching over you.'],
    good:    ['Solid week. Keep building.', 'Green arrow secured. Respectable.', 'Not bad at all, manager.', 'The plan is coming together.', 'Quietly impressive.'],
    average: ['Mid. But we move.', 'The template betrayed us again.', 'Horizontal arrow haver.', 'Points on the board. Barely.', 'It is what it is, chief.'],
    bad:     ['This is fine. 🔥🔥🔥', 'Wildcard szn incoming?', 'The captain pick… said what it said.', 'We go again. Unfortunately.', 'Genuinely impressive how wrong that was.'],
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
    @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Sans:wght@400;500;600&display=swap');

    .kfl-digest-overlay {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      background: rgba(0, 0, 0, 0);
      transition: background 0.4s ease;
      font-family: 'DM Sans', sans-serif;
      -webkit-tap-highlight-color: transparent;
    }

    .kfl-digest-overlay.is-ready {
      background: rgba(0, 0, 0, 0.72);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
    }

    /* ── Card ── */
    .kfl-digest-card {
      width: 100%;
      max-width: 480px;
      max-height: 92vh;
      overflow-y: auto;
      scrollbar-width: none;
      border-radius: 28px 28px 0 0;
      background: var(--kfl-surface, #141e2d);
      transform: translateY(100%);
      transition: transform 0.5s cubic-bezier(0.34, 1.20, 0.64, 1);
      will-change: transform;
      position: relative;
      overflow: hidden;
    }

    .kfl-digest-card::-webkit-scrollbar { display: none; }

    .kfl-digest-overlay.is-ready .kfl-digest-card {
      transform: translateY(0);
    }

    .kfl-digest-card.is-dragging {
      transition: none;
    }

    /* ── Noise texture overlay ── */
    .kfl-digest-card::before {
      content: '';
      position: absolute;
      inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.04'/%3E%3C/svg%3E");
      pointer-events: none;
      z-index: 0;
      opacity: 0.6;
    }

    /* ── Drag handle ── */
    .kfl-digest-handle {
      width: 40px;
      height: 4px;
      border-radius: 100px;
      background: rgba(255,255,255,0.15);
      margin: 14px auto 0;
      position: relative;
      z-index: 1;
    }

    /* ── Inner content ── */
    .kfl-digest-inner {
      padding: 20px 24px 40px;
      position: relative;
      z-index: 1;
    }

    /* ── Header ── */
    .kfl-digest-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 22px;
    }

    .kfl-digest-gw-label {
      font-family: 'Syne', sans-serif;
      font-size: 0.62rem;
      font-weight: 800;
      letter-spacing: 2px;
      text-transform: uppercase;
      color: var(--kfl-green, #00e868);
    }

    .kfl-digest-close {
      width: 30px;
      height: 30px;
      border-radius: 50%;
      background: rgba(255,255,255,0.07);
      border: none;
      color: rgba(255,255,255,0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 0.75rem;
      transition: background 0.15s, color 0.15s;
    }
    .kfl-digest-close:hover { background: rgba(255,255,255,0.13); color: #fff; }

    /* ── Score hero ── */
    .kfl-digest-hero {
      text-align: center;
      padding: 10px 0 28px;
      position: relative;
    }

    .kfl-digest-hero__glow {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      width: 220px;
      height: 220px;
      border-radius: 50%;
      background: radial-gradient(circle, var(--digest-glow, rgba(0,232,104,0.12)) 0%, transparent 70%);
      pointer-events: none;
    }

    .kfl-digest-score {
      font-family: 'Syne', sans-serif;
      font-size: 5.5rem;
      font-weight: 800;
      line-height: 1;
      color: #fff;
      letter-spacing: -4px;
      position: relative;
    }

    .kfl-digest-score__pts {
      font-size: 1.4rem;
      font-weight: 700;
      color: rgba(255,255,255,0.35);
      letter-spacing: 0;
      vertical-align: super;
      margin-left: 4px;
    }

    .kfl-digest-one-liner {
      font-size: 0.82rem;
      color: rgba(255,255,255,0.45);
      margin-top: 8px;
      font-style: italic;
    }

    /* ── Rank row ── */
    .kfl-digest-rank-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin-top: 14px;
    }

    .kfl-digest-rank-badge {
      font-family: 'Syne', sans-serif;
      font-size: 0.78rem;
      font-weight: 700;
      padding: 4px 12px;
      border-radius: 100px;
      background: rgba(255,255,255,0.06);
      color: rgba(255,255,255,0.6);
      border: 1px solid rgba(255,255,255,0.08);
    }

    .kfl-digest-rank-arrow {
      font-size: 0.85rem;
      font-weight: 800;
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 12px;
      border-radius: 100px;
    }

    .kfl-digest-rank-arrow.up   { background: rgba(0,232,104,0.12); color: #00e868; }
    .kfl-digest-rank-arrow.down { background: rgba(239,68,68,0.12);  color: #ef4444; }
    .kfl-digest-rank-arrow.same { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.4); }

    /* ── Divider ── */
    .kfl-digest-divider {
      height: 1px;
      background: rgba(255,255,255,0.06);
      margin: 4px 0 20px;
    }

    /* ── Stat grid ── */
    .kfl-digest-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 20px;
    }

    .kfl-digest-stat {
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 14px;
      padding: 14px 16px;
      transition: background 0.15s;
    }

    .kfl-digest-stat__label {
      font-size: 0.58rem;
      font-weight: 700;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: rgba(255,255,255,0.28);
      margin-bottom: 6px;
    }

    .kfl-digest-stat__value {
      font-family: 'Syne', sans-serif;
      font-size: 1.3rem;
      font-weight: 800;
      color: #fff;
      line-height: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .kfl-digest-stat__sub {
      font-size: 0.68rem;
      color: rgba(255,255,255,0.28);
      margin-top: 3px;
    }

    /* Best / worst player cards */
    .kfl-digest-player-cards {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 10px;
      margin-bottom: 20px;
    }

    .kfl-digest-player {
      border-radius: 14px;
      padding: 14px 16px;
      border: 1px solid transparent;
      position: relative;
      overflow: hidden;
    }

    .kfl-digest-player--best {
      background: rgba(0,232,104,0.07);
      border-color: rgba(0,232,104,0.15);
    }

    .kfl-digest-player--worst {
      background: rgba(239,68,68,0.07);
      border-color: rgba(239,68,68,0.12);
    }

    .kfl-digest-player__tag {
      font-size: 0.55rem;
      font-weight: 800;
      letter-spacing: 1.4px;
      text-transform: uppercase;
      margin-bottom: 6px;
    }

    .kfl-digest-player--best  .kfl-digest-player__tag { color: rgba(0,232,104,0.6); }
    .kfl-digest-player--worst .kfl-digest-player__tag { color: rgba(239,68,68,0.6); }

    .kfl-digest-player__name {
      font-family: 'Syne', sans-serif;
      font-size: 0.88rem;
      font-weight: 800;
      color: #fff;
      line-height: 1.2;
      margin-bottom: 4px;
    }

    .kfl-digest-player__pts {
      font-size: 1.1rem;
      font-weight: 700;
      line-height: 1;
    }

    .kfl-digest-player--best  .kfl-digest-player__pts { color: #00e868; }
    .kfl-digest-player--worst .kfl-digest-player__pts { color: #ef4444; }

    .kfl-digest-player__pts-label {
      font-size: 0.6rem;
      color: rgba(255,255,255,0.25);
      margin-left: 2px;
    }

    /* ── Captain row ── */
    .kfl-digest-captain {
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.06);
      border-radius: 14px;
      padding: 14px 16px;
      margin-bottom: 20px;
    }

    .kfl-digest-captain__armband {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Syne', sans-serif;
      font-size: 0.85rem;
      font-weight: 800;
      color: #fff;
      flex-shrink: 0;
      box-shadow: 0 0 16px rgba(245,158,11,0.3);
    }

    .kfl-digest-captain__info { flex: 1; min-width: 0; }

    .kfl-digest-captain__label {
      font-size: 0.57rem;
      font-weight: 700;
      letter-spacing: 1.2px;
      text-transform: uppercase;
      color: rgba(255,255,255,0.28);
      margin-bottom: 3px;
    }

    .kfl-digest-captain__name {
      font-family: 'Syne', sans-serif;
      font-size: 0.92rem;
      font-weight: 800;
      color: #fff;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .kfl-digest-captain__pts {
      font-family: 'Syne', sans-serif;
      font-size: 1.4rem;
      font-weight: 800;
      color: #f59e0b;
      flex-shrink: 0;
    }

    .kfl-digest-captain__pts-label {
      font-size: 0.6rem;
      color: rgba(255,255,255,0.25);
    }

    /* ── CTA ── */
    .kfl-digest-cta {
      width: 100%;
      padding: 15px;
      border-radius: 14px;
      background: var(--kfl-green, #00e868);
      color: #021409;
      border: none;
      font-family: 'Syne', sans-serif;
      font-size: 0.88rem;
      font-weight: 800;
      letter-spacing: 0.5px;
      cursor: pointer;
      transition: opacity 0.15s, transform 0.15s;
    }
    .kfl-digest-cta:hover  { opacity: 0.9; }
    .kfl-digest-cta:active { transform: scale(0.98); }

    /* ── Swipe hint ── */
    .kfl-digest-swipe-hint {
      text-align: center;
      font-size: 0.62rem;
      color: rgba(255,255,255,0.18);
      margin-top: 12px;
      letter-spacing: 0.5px;
    }

    /* ── Shimmer loading state ── */
    .kfl-digest-shimmer {
      background: linear-gradient(90deg,
        rgba(255,255,255,0.04) 25%,
        rgba(255,255,255,0.08) 50%,
        rgba(255,255,255,0.04) 75%);
      background-size: 400% 100%;
      animation: digest-shimmer 1.6s ease infinite;
      border-radius: 8px;
    }

    @keyframes digest-shimmer {
      from { background-position: -200% 0; }
      to   { background-position:  200% 0; }
    }

    /* ── Staggered entry animations ── */
    .kfl-digest-inner > * {
      opacity: 0;
      transform: translateY(12px);
      animation: digest-fade-up 0.4s ease forwards;
    }
    .kfl-digest-inner > *:nth-child(1) { animation-delay: 0.15s; }
    .kfl-digest-inner > *:nth-child(2) { animation-delay: 0.22s; }
    .kfl-digest-inner > *:nth-child(3) { animation-delay: 0.28s; }
    .kfl-digest-inner > *:nth-child(4) { animation-delay: 0.34s; }
    .kfl-digest-inner > *:nth-child(5) { animation-delay: 0.40s; }
    .kfl-digest-inner > *:nth-child(6) { animation-delay: 0.46s; }
    .kfl-digest-inner > *:nth-child(7) { animation-delay: 0.52s; }

    @keyframes digest-fade-up {
      to { opacity: 1; transform: translateY(0); }
    }

    /* Light theme overrides */
    [data-theme="light"] .kfl-digest-card {
      background: #ffffff;
    }
    [data-theme="light"] .kfl-digest-score        { color: #0a0e1a; }
    [data-theme="light"] .kfl-digest-player__name { color: #0a0e1a; }
    [data-theme="light"] .kfl-digest-captain__name { color: #0a0e1a; }
    [data-theme="light"] .kfl-digest-stat__value  { color: #0a0e1a; }
    [data-theme="light"] .kfl-digest-handle       { background: rgba(0,0,0,0.12); }
    [data-theme="light"] .kfl-digest-one-liner     { color: rgba(0,0,0,0.4); }
    [data-theme="light"] .kfl-digest-swipe-hint   { color: rgba(0,0,0,0.2); }
    [data-theme="light"] .kfl-digest-stat         { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.06); }
    [data-theme="light"] .kfl-digest-player--best  { background: rgba(0,200,90,0.06); }
    [data-theme="light"] .kfl-digest-player--worst { background: rgba(239,68,68,0.06); }
    [data-theme="light"] .kfl-digest-captain      { background: rgba(0,0,0,0.03); border-color: rgba(0,0,0,0.06); }
    [data-theme="light"] .kfl-digest-close        { background: rgba(0,0,0,0.05); color: rgba(0,0,0,0.4); }
    [data-theme="light"] .kfl-digest-rank-badge   { background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.08); color: rgba(0,0,0,0.5); }
    [data-theme="light"] .kfl-digest-cta          { color: #fff; }
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

  /* ── Format helpers ──────────────────────────────────────── */
  function fmtRank(n) {
    if (!n) return '—';
    return n >= 1000000
      ? (n / 1000000).toFixed(1) + 'M'
      : n >= 1000
      ? (n / 1000).toFixed(0) + 'k'
      : String(n);
  }

  function rankDiff(current, previous) {
    if (!current || !previous) return { dir: 'same', text: '—' };
    const diff = previous - current; // positive = moved up
    if (diff > 0) return { dir: 'up',   text: `↑ ${fmtRank(diff)}` };
    if (diff < 0) return { dir: 'down', text: `↓ ${fmtRank(Math.abs(diff))}` };
    return { dir: 'same', text: '→' };
  }

  /* ── Build card HTML ─────────────────────────────────────── */
  function buildCard(data) {
    const {
      gwName, gwPoints, totalPoints, overallRank, prevRank,
      avgPoints, bestPlayer, worstPlayer, captain, captainPts,
      transfers, transferCost, chip,
    } = data;

    const arrow   = rankDiff(overallRank, prevRank);
    const oneLiner = getOneLiner(gwPoints, avgPoints);

    // Glow colour based on performance
    const diff = gwPoints - avgPoints;
    const glowColor = diff >= 15 ? 'rgba(0,232,104,0.15)'
                    : diff >= 0  ? 'rgba(0,232,104,0.08)'
                    :              'rgba(239,68,68,0.1)';

    const chipBadge = chip && chip !== 'n/a'
      ? `<span style="background:rgba(245,158,11,0.15);color:#f59e0b;padding:3px 10px;border-radius:100px;font-size:0.62rem;font-weight:800;letter-spacing:1px;text-transform:uppercase;margin-left:8px;">${chip.replace('_',' ')}</span>`
      : '';

    return `
      <div class="kfl-digest-handle"></div>
      <div class="kfl-digest-inner">

        <!-- Header -->
        <div class="kfl-digest-header">
          <div>
            <span class="kfl-digest-gw-label">${gwName} · Recap ${chipBadge}</span>
          </div>
          <button class="kfl-digest-close" id="kfl-digest-close" aria-label="Close recap">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Score hero -->
        <div class="kfl-digest-hero">
          <div class="kfl-digest-hero__glow" style="--digest-glow:${glowColor}"></div>
          <div class="kfl-digest-score">
            ${gwPoints}<span class="kfl-digest-score__pts">pts</span>
          </div>
          <div class="kfl-digest-one-liner">${oneLiner}</div>
          <div class="kfl-digest-rank-row">
            <div class="kfl-digest-rank-badge">
              <i class="fa-solid fa-earth-africa" style="margin-right:5px;opacity:0.5;font-size:0.7rem"></i>
              ${fmtRank(overallRank)}
            </div>
            <div class="kfl-digest-rank-arrow ${arrow.dir}">
              ${arrow.text}
            </div>
          </div>
        </div>

        <div class="kfl-digest-divider"></div>

        <!-- Stat grid -->
        <div class="kfl-digest-stats">
          <div class="kfl-digest-stat">
            <div class="kfl-digest-stat__label">GW Average</div>
            <div class="kfl-digest-stat__value">${avgPoints}<span style="font-size:0.7rem;opacity:0.4;font-family:'DM Sans',sans-serif;font-weight:500"> pts</span></div>
            <div class="kfl-digest-stat__sub">${gwPoints >= avgPoints ? '+' : ''}${gwPoints - avgPoints} vs avg</div>
          </div>
          <div class="kfl-digest-stat">
            <div class="kfl-digest-stat__label">Total Points</div>
            <div class="kfl-digest-stat__value">${totalPoints}<span style="font-size:0.7rem;opacity:0.4;font-family:'DM Sans',sans-serif;font-weight:500"> pts</span></div>
            <div class="kfl-digest-stat__sub">Overall</div>
          </div>
          <div class="kfl-digest-stat">
            <div class="kfl-digest-stat__label">Transfers</div>
            <div class="kfl-digest-stat__value">${transfers}</div>
            <div class="kfl-digest-stat__sub">${transferCost > 0 ? `-${transferCost} pt hit` : 'No hit'}</div>
          </div>
          <div class="kfl-digest-stat">
            <div class="kfl-digest-stat__label">Net Points</div>
            <div class="kfl-digest-stat__value">${gwPoints - transferCost}</div>
            <div class="kfl-digest-stat__sub">After hit</div>
          </div>
        </div>

        <!-- Best / Worst players -->
        <div class="kfl-digest-player-cards">
          <div class="kfl-digest-player kfl-digest-player--best">
            <div class="kfl-digest-player__tag">⚡ Best Player</div>
            <div class="kfl-digest-player__name">${bestPlayer.name}</div>
            <div class="kfl-digest-player__pts">
              ${bestPlayer.pts}<span class="kfl-digest-player__pts-label">pts</span>
            </div>
          </div>
          <div class="kfl-digest-player kfl-digest-player--worst">
            <div class="kfl-digest-player__tag">😬 Worst Player</div>
            <div class="kfl-digest-player__name">${worstPlayer.name}</div>
            <div class="kfl-digest-player__pts">
              ${worstPlayer.pts}<span class="kfl-digest-player__pts-label">pts</span>
            </div>
          </div>
        </div>

        <!-- Captain -->
        <div class="kfl-digest-captain">
          <div class="kfl-digest-captain__armband">C</div>
          <div class="kfl-digest-captain__info">
            <div class="kfl-digest-captain__label">Captain Pick</div>
            <div class="kfl-digest-captain__name">${captain}</div>
          </div>
          <div style="text-align:right;flex-shrink:0">
            <div class="kfl-digest-captain__pts">${captainPts}</div>
            <div class="kfl-digest-captain__pts-label">pts (×2)</div>
          </div>
        </div>

        <!-- CTA -->
        <button class="kfl-digest-cta" id="kfl-digest-cta">
          View My Team →
        </button>
        <div class="kfl-digest-swipe-hint">Swipe down to dismiss</div>

      </div>
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
      card.style.transition = 'transform 0.35s cubic-bezier(0.4,0,0.2,1)';
      card.style.transform  = 'translateY(100%)';
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
        card.style.transition = 'transform 0.3s cubic-bezier(0.34,1.2,0.64,1)';
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
