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

  const style = document.createElement('style');
  style.textContent = `
    .kfl-digest-overlay {
      position: fixed; inset: 0; z-index: 10000;
      display: flex; align-items: center; justify-content: center;
      padding: 20px;
      background: rgba(0,0,0,0);
      transition: background 0.3s ease;
      -webkit-tap-highlight-color: transparent;
    }
    .kfl-digest-overlay.is-ready {
      background: rgba(0,0,0,0.5);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
    }

    .kfl-digest-card {
      width: 100%; max-width: 300px;
      border-radius: 18px;
      background: #ffffff;
      box-shadow: 0 24px 64px rgba(0,0,0,0.35);
      overflow: hidden;
      transform: scale(0.88) translateY(14px);
      opacity: 0;
      transition: transform 0.38s cubic-bezier(0.34,1.4,0.64,1), opacity 0.28s ease;
      will-change: transform, opacity;
      cursor: grab;
    }
    .kfl-digest-overlay.is-ready .kfl-digest-card {
      transform: scale(1) translateY(0); opacity: 1;
    }
    .kfl-digest-card.is-dragging { transition: none; cursor: grabbing; }

    /* Top bar */
    .kfl-d-topbar {
      display: flex; align-items: center; justify-content: space-between;
      padding: 11px 14px 9px;
      border-bottom: 1px solid #eef0f4;
    }
    .kfl-d-gw-label {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 0.6rem; font-weight: 800;
      letter-spacing: 2px; text-transform: uppercase;
      color: #00b84a;
      display: flex; align-items: center; gap: 5px;
    }
    .kfl-d-chip {
      background: rgba(245,158,11,0.14); color: #f59e0b;
      padding: 1px 6px; border-radius: 100px;
      font-size: 0.48rem; font-weight: 800; letter-spacing: 1px;
    }
    .kfl-d-close {
      width: 22px; height: 22px; border-radius: 50%;
      background: #f0f2f5; border: none; color: #9aa5b8;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 0.58rem;
      transition: background 0.15s; flex-shrink: 0;
    }
    .kfl-d-close:hover { background: #e2e5ea; }

    /* Hero two-col */
    .kfl-d-hero {
      display: grid; grid-template-columns: 1fr 1fr;
      border-bottom: 1px solid #eef0f4;
    }
    .kfl-d-hero-left {
      padding: 14px 10px 14px 14px;
      display: flex; flex-direction: column;
      align-items: center; justify-content: center;
      gap: 5px; text-align: center;
      border-right: 1px solid #eef0f4;
    }
    .kfl-d-arrow-circle {
      width: 44px; height: 44px; border-radius: 50%;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.05rem;
      box-shadow: 0 4px 14px rgba(0,0,0,0.12);
    }
    .kfl-d-arrow-circle.up   { background: #00b84a; color: #fff; box-shadow: 0 4px 14px rgba(0,184,74,0.3); }
    .kfl-d-arrow-circle.down { background: #ef4444; color: #fff; box-shadow: 0 4px 14px rgba(239,68,68,0.3); }
    .kfl-d-arrow-circle.same { background: #e8eaf0; color: #9aa5b8; }
    .kfl-d-you-on-a {
      font-family: 'DM Sans', sans-serif;
      font-size: 0.57rem; color: #8899b0; font-weight: 500; line-height: 1;
    }
    .kfl-d-direction {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 0.95rem; font-weight: 800;
      letter-spacing: 0.5px; text-transform: uppercase; line-height: 1;
    }
    .kfl-d-direction.up   { color: #00b84a; }
    .kfl-d-direction.down { color: #ef4444; }
    .kfl-d-direction.same { color: #9aa5b8; }
    .kfl-d-by-pts {
      font-family: 'DM Sans', sans-serif;
      font-size: 0.58rem; color: #8899b0; font-weight: 500;
    }
    .kfl-d-by-pts strong { color: #2d3748; font-weight: 700; }
    .kfl-d-hero-right {
      padding: 14px 14px 14px 12px;
      display: flex; flex-direction: column; justify-content: center;
    }
    .kfl-d-gw-sub {
      font-family: 'DM Sans', sans-serif;
      font-size: 0.5rem; font-weight: 700;
      letter-spacing: 1.5px; text-transform: uppercase;
      color: #9aa5b8; margin-bottom: 0;
    }
    .kfl-d-pts-lbl {
      font-family: 'DM Sans', sans-serif;
      font-size: 0.48rem; font-weight: 700;
      letter-spacing: 1.2px; text-transform: uppercase;
      color: #b0baca; margin-bottom: 2px;
    }
    .kfl-d-score {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 3.2rem; font-weight: 900;
      line-height: 0.88; color: #0d1520; letter-spacing: -1px;
    }
    .kfl-d-vs-avg {
      font-family: 'DM Sans', sans-serif;
      font-size: 0.58rem; color: #8899b0; font-weight: 500;
      margin-top: 4px;
    }
    .kfl-d-vs-avg strong { font-weight: 700; }
    .kfl-d-vs-avg strong.pos { color: #00913a; }
    .kfl-d-vs-avg strong.neg { color: #dc2626; }
    .kfl-d-one-liner {
      font-family: 'DM Sans', sans-serif;
      font-size: 0.56rem; color: #9aa5b8;
      font-style: italic; margin-top: 3px; line-height: 1.3;
    }

    /* Stat pill rows */
    .kfl-d-stats {
      padding: 8px 14px 6px;
      display: flex; flex-direction: column; gap: 5px;
    }
    .kfl-d-stat-row {
      display: flex; align-items: center; gap: 6px;
    }
    .kfl-d-stat-lbl {
      font-family: 'DM Sans', sans-serif;
      font-size: 0.6rem; font-weight: 600;
      color: #9aa5b8; min-width: 58px; flex-shrink: 0;
    }
    .kfl-d-pill {
      display: inline-flex; align-items: center;
      padding: 3px 10px; border-radius: 100px;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 0.76rem; font-weight: 700;
      letter-spacing: 0.2px;
      background: #f0f2f5; color: #2d3748; border: 1px solid #e2e5ea;
      white-space: nowrap;
    }
    .kfl-d-pill.green { background: rgba(0,184,74,0.1); color: #00913a; border-color: rgba(0,184,74,0.2); }
    .kfl-d-pill.red   { background: rgba(239,68,68,0.1); color: #dc2626; border-color: rgba(239,68,68,0.18); }
    .kfl-d-pill.amber { background: rgba(245,158,11,0.1); color: #b45309; border-color: rgba(245,158,11,0.2); }

    /* Bottom: best/worst/captain */
    .kfl-d-bottom {
      display: grid; grid-template-columns: 1fr 1fr;
      border-top: 1px solid #eef0f4;
    }
    .kfl-d-mini {
      padding: 9px 12px;
    }
    .kfl-d-mini:first-child { border-right: 1px solid #eef0f4; }
    .kfl-d-mini-tag {
      font-family: 'DM Sans', sans-serif;
      font-size: 0.43rem; font-weight: 800;
      letter-spacing: 1.1px; text-transform: uppercase; margin-bottom: 2px;
    }
    .kfl-d-mini-tag.best  { color: rgba(0,184,74,0.55); }
    .kfl-d-mini-tag.worst { color: rgba(239,68,68,0.55); }
    .kfl-d-mini-name {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 0.84rem; font-weight: 700; color: #0d1520;
      line-height: 1.1; white-space: nowrap;
      overflow: hidden; text-overflow: ellipsis;
    }
    .kfl-d-mini-pts {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 1rem; font-weight: 800; line-height: 1;
    }
    .kfl-d-mini-pts.best  { color: #00b84a; }
    .kfl-d-mini-pts.worst { color: #ef4444; }
    .kfl-d-mini-pts-lbl { font-size: 0.46rem; color: #b0baca; margin-left: 1px; }

    /* Captain row */
    .kfl-d-captain {
      grid-column: 1 / -1;
      display: flex; align-items: center; gap: 8px;
      padding: 7px 12px 9px;
      border-top: 1px solid #eef0f4;
    }
    .kfl-d-c-ball {
      width: 24px; height: 24px; border-radius: 50%;
      background: linear-gradient(135deg, #f59e0b, #d97706);
      display: flex; align-items: center; justify-content: center;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 0.66rem; font-weight: 900; color: #fff;
      flex-shrink: 0; box-shadow: 0 2px 8px rgba(245,158,11,0.25);
    }
    .kfl-d-c-info { flex: 1; min-width: 0; }
    .kfl-d-c-lbl {
      font-family: 'DM Sans', sans-serif;
      font-size: 0.42rem; font-weight: 800;
      letter-spacing: 1.2px; text-transform: uppercase;
      color: rgba(245,158,11,0.55); line-height: 1; margin-bottom: 1px;
    }
    .kfl-d-c-name {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 0.84rem; font-weight: 700; color: #0d1520;
      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; line-height: 1.1;
    }
    .kfl-d-c-pts {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 1rem; font-weight: 800; color: #f59e0b;
      text-align: right; line-height: 1;
    }
    .kfl-d-c-pts-lbl {
      font-family: 'DM Sans', sans-serif;
      font-size: 0.42rem; color: #b0baca;
      display: block; text-align: right; line-height: 1;
    }

    /* Hint */
    .kfl-d-hint {
      text-align: center;
      font-family: 'DM Sans', sans-serif;
      font-size: 0.5rem; color: #c8d0dc;
      padding: 5px 0 8px; letter-spacing: 0.3px;
    }

    /* Stagger */
    .kfl-digest-card .kfl-d-topbar,
    .kfl-digest-card .kfl-d-hero,
    .kfl-digest-card .kfl-d-stats,
    .kfl-digest-card .kfl-d-bottom,
    .kfl-digest-card .kfl-d-hint {
      opacity: 0; transform: translateY(5px);
      animation: kfl-d-up 0.28s ease forwards;
    }
    .kfl-digest-card .kfl-d-topbar { animation-delay: 0.14s; }
    .kfl-digest-card .kfl-d-hero   { animation-delay: 0.19s; }
    .kfl-digest-card .kfl-d-stats  { animation-delay: 0.25s; }
    .kfl-digest-card .kfl-d-bottom { animation-delay: 0.30s; }
    .kfl-digest-card .kfl-d-hint   { animation-delay: 0.34s; }
    @keyframes kfl-d-up { to { opacity:1; transform:translateY(0); } }

    /* Dark theme */
    [data-theme="dark"] .kfl-digest-card       { background: var(--kfl-surface, #141e2d); }
    [data-theme="dark"] .kfl-d-topbar          { border-bottom-color: rgba(255,255,255,0.06); }
    [data-theme="dark"] .kfl-d-hero            { border-bottom-color: rgba(255,255,255,0.06); }
    [data-theme="dark"] .kfl-d-hero-left       { border-right-color: rgba(255,255,255,0.06); }
    [data-theme="dark"] .kfl-d-close           { background: rgba(255,255,255,0.07); color: rgba(255,255,255,0.35); }
    [data-theme="dark"] .kfl-d-close:hover     { background: rgba(255,255,255,0.13); color: #fff; }
    [data-theme="dark"] .kfl-d-gw-sub         { color: rgba(255,255,255,0.3); }
    [data-theme="dark"] .kfl-d-pts-lbl        { color: rgba(255,255,255,0.25); }
    [data-theme="dark"] .kfl-d-score          { color: #ffffff; }
    [data-theme="dark"] .kfl-d-vs-avg         { color: rgba(255,255,255,0.4); }
    [data-theme="dark"] .kfl-d-vs-avg strong  { color: rgba(255,255,255,0.4); }
    [data-theme="dark"] .kfl-d-vs-avg strong.pos { color: #00e868; }
    [data-theme="dark"] .kfl-d-vs-avg strong.neg { color: #ef4444; }
    [data-theme="dark"] .kfl-d-you-on-a       { color: rgba(255,255,255,0.38); }
    [data-theme="dark"] .kfl-d-by-pts         { color: rgba(255,255,255,0.38); }
    [data-theme="dark"] .kfl-d-by-pts strong  { color: rgba(255,255,255,0.75); }
    [data-theme="dark"] .kfl-d-direction.up   { color: #00e868; }
    [data-theme="dark"] .kfl-d-arrow-circle.up{ background: #00e868; color: #021409; }
    [data-theme="dark"] .kfl-d-arrow-circle.same { background: rgba(255,255,255,0.08); }
    [data-theme="dark"] .kfl-d-stat-lbl       { color: rgba(255,255,255,0.35); }
    [data-theme="dark"] .kfl-d-pill           { background: rgba(255,255,255,0.06); color: rgba(255,255,255,0.75); border-color: rgba(255,255,255,0.08); }
    [data-theme="dark"] .kfl-d-pill.green     { background: rgba(0,232,104,0.1); color: #00e868; border-color: rgba(0,232,104,0.18); }
    [data-theme="dark"] .kfl-d-pill.red       { background: rgba(239,68,68,0.1); color: #ef4444; border-color: rgba(239,68,68,0.18); }
    [data-theme="dark"] .kfl-d-bottom        { border-top-color: rgba(255,255,255,0.06); }
    [data-theme="dark"] .kfl-d-mini:first-child{ border-right-color: rgba(255,255,255,0.06); }
    [data-theme="dark"] .kfl-d-mini-name     { color: #fff; }
    [data-theme="dark"] .kfl-d-captain       { border-top-color: rgba(255,255,255,0.06); }
    [data-theme="dark"] .kfl-d-c-name        { color: #fff; }
    [data-theme="dark"] .kfl-d-hint          { color: rgba(255,255,255,0.12); }
    [data-theme="dark"] .kfl-d-one-liner      { color: rgba(255,255,255,0.3); }
  `;
  document.head.appendChild(style);

  /* ── Fetch helpers ── */
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

  /* ── Helpers ── */
  function fmtRank(n) {
    if (!n) return '\u2014';
    return n >= 1000000 ? (n/1000000).toFixed(1)+'M'
         : n >= 1000    ? Number((n/1000).toFixed(0)).toLocaleString()+'k'
         : n.toLocaleString();
  }
  function rankDiff(cur, prev) {
    if (!cur || !prev) return { dir: 'same', diff: 0 };
    const d = prev - cur;
    if (d > 0) return { dir: 'up',   diff: d };
    if (d < 0) return { dir: 'down', diff: Math.abs(d) };
    return { dir: 'same', diff: 0 };
  }

  /* ── Build card HTML ── */
  function buildCard(data) {
    const {
      gwName, gwPoints, totalPoints, overallRank, prevRank,
      avgPoints, bestPlayer, worstPlayer, captain, captainPts,
      transfers, transferCost, chip,
    } = data;

    const arrow    = rankDiff(overallRank, prevRank);
    const oneLiner = getOneLiner(gwPoints, avgPoints);
    const vsAvg    = gwPoints - avgPoints;
    const vsClass  = vsAvg >= 0 ? 'pos' : 'neg';
    const vsSign   = vsAvg >= 0 ? '+' : '';

    const arrowIcon = arrow.dir === 'up'   ? 'fa-arrow-up'
                    : arrow.dir === 'down' ? 'fa-arrow-down'
                    :                        'fa-minus';
    const dirLabel  = arrow.dir === 'up'   ? 'Green Arrow'
                    : arrow.dir === 'down' ? 'Red Arrow'
                    :                        'No Change';

    const chipBadge = chip && chip !== 'n/a'
      ? '<span class="kfl-d-chip">' + chip.replace(/_/g,' ') + '</span>'
      : '';

    const transferText = transferCost > 0
      ? transfers + ' · -' + transferCost + ' hit'
      : transfers + ' · no hit';
    const transferPillClass = transferCost > 0 ? 'red' : '';

    const rankChangeText = arrow.diff > 0
      ? (arrow.dir === 'up' ? '+' : '-') + fmtRank(arrow.diff)
      : '\u2014';
    const rankPillClass = arrow.dir === 'up' ? 'green' : arrow.dir === 'down' ? 'red' : '';

    return `
      <div class="kfl-d-topbar">
        <span class="kfl-d-gw-label">${gwName} \xB7 Recap ${chipBadge}</span>
        <button class="kfl-d-close" id="kfl-digest-close" aria-label="Close">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>

      <div class="kfl-d-hero">
        <div class="kfl-d-hero-left">
          <div class="kfl-d-arrow-circle ${arrow.dir}">
            <i class="fa-solid ${arrowIcon}"></i>
          </div>
          <span class="kfl-d-you-on-a">You're on a</span>
          <span class="kfl-d-direction ${arrow.dir}">${dirLabel}</span>
          <span class="kfl-d-by-pts">by <strong>${vsSign}${vsAvg} pts</strong></span>
        </div>
        <div class="kfl-d-hero-right">
          <span class="kfl-d-gw-sub">${gwName}</span>
          <span class="kfl-d-pts-lbl">Gameweek Points</span>
          <div class="kfl-d-score">${gwPoints}</div>
          <div class="kfl-d-vs-avg">vs avg <strong class="${vsClass}">${vsSign}${vsAvg} pts</strong></div>
          <div class="kfl-d-one-liner">${oneLiner}</div>
        </div>
      </div>

      <div class="kfl-d-stats">
        <div class="kfl-d-stat-row">
          <span class="kfl-d-stat-lbl">Live Rank</span>
          <span class="kfl-d-pill">${fmtRank(overallRank)}</span>
        </div>
        <div class="kfl-d-stat-row">
          <span class="kfl-d-stat-lbl">Change</span>
          <span class="kfl-d-pill ${rankPillClass}">${rankChangeText}</span>
        </div>
        <div class="kfl-d-stat-row">
          <span class="kfl-d-stat-lbl">Transfers</span>
          <span class="kfl-d-pill ${transferPillClass}">${transferText}</span>
        </div>
      </div>

      <div class="kfl-d-bottom">
        <div class="kfl-d-mini">
          <div class="kfl-d-mini-tag best">\u26A1 Best</div>
          <div class="kfl-d-mini-name">${bestPlayer.name}</div>
          <div class="kfl-d-mini-pts best">${bestPlayer.pts}<span class="kfl-d-mini-pts-lbl">pts</span></div>
        </div>
        <div class="kfl-d-mini">
          <div class="kfl-d-mini-tag worst">\uD83D\uDE2C Worst</div>
          <div class="kfl-d-mini-name">${worstPlayer.name}</div>
          <div class="kfl-d-mini-pts worst">${worstPlayer.pts}<span class="kfl-d-mini-pts-lbl">pts</span></div>
        </div>
        <div class="kfl-d-captain">
          <div class="kfl-d-c-ball">C</div>
          <div class="kfl-d-c-info">
            <div class="kfl-d-c-lbl">Captain</div>
            <div class="kfl-d-c-name">${captain}</div>
          </div>
          <div>
            <div class="kfl-d-c-pts">${captainPts}</div>
            <span class="kfl-d-c-pts-lbl">pts (\xD72)</span>
          </div>
        </div>
      </div>

      <div class="kfl-d-hint">Tap outside or swipe to dismiss</div>
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
