/**
 * live-widget.js — Kopala FPL
 * ─────────────────────────────────────────────────────────────
 * Floating live score pill that sits above the bottom nav
 * during an active gameweek. Shows live points, rank arrow,
 * and players still to play. Tapping expands to full team view.
 *
 * - Auto-refreshes every 60s via the live/ endpoint
 * - Haptic feedback on every interaction (via haptic.js)
 * - Collapses when navigating, expands on tap
 * - Only renders during an active gameweek
 *
 * Dependencies: haptic.js (optional — degrades gracefully)
 * Usage: <script src="live-widget.js"></script>
 */

(function () {
  'use strict';

  const PROXY      = '/.netlify/functions/fpl-proxy?endpoint=';
  const STORAGE_ID = 'kopala_id';
  const REFRESH_MS = 60 * 1000;        // 60 seconds
  const NAV_H      = 60;               // bottom nav height px — adjust to match your nav

  let _timer      = null;
  let _lastPts    = null;
  let _isExpanded = false;
  let _data       = null;

  /* ── Haptic helper — safe if haptic.js not loaded ── */
  const H = {
    tap:     () => window.Haptic?.tap(),
    score:   () => window.Haptic?.score(),
    expand:  () => window.Haptic?.expand(),
    dismiss: () => window.Haptic?.dismiss(),
    warning: () => window.Haptic?.warning(),
  };

  /* ── Position constants ── */
  function pillBottom() {
    return NAV_H + 10; // 10px gap above nav
  }

  /* ── Inject styles ── */
  (function injectStyles() {
    const s = document.createElement('style');
    s.textContent = `
      /* ── Pill ── */
      .kfl-lw-pill {
        position: fixed;
        bottom: ${pillBottom()}px;
        left: 50%;
        transform: translateX(-50%) translateY(0);
        z-index: 950;

        display: flex;
        align-items: center;
        gap: 7px;

        padding: 0 14px 0 10px;
        height: 36px;
        border-radius: 100px;

        background: var(--kfl-surface, #141e2d);
        border: 1px solid rgba(255,255,255,0.10);
        box-shadow: 0 4px 20px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.04);

        cursor: pointer;
        user-select: none;
        -webkit-tap-highlight-color: transparent;

        transition: transform 0.32s cubic-bezier(0.34,1.3,0.64,1),
                    box-shadow 0.2s ease,
                    opacity 0.25s ease;
        will-change: transform;
      }

      .kfl-lw-pill.is-hidden {
        transform: translateX(-50%) translateY(120%);
        opacity: 0;
        pointer-events: none;
      }

      .kfl-lw-pill:active {
        transform: translateX(-50%) scale(0.95);
        box-shadow: 0 2px 10px rgba(0,0,0,0.3);
      }

      /* live dot */
      .kfl-lw-dot {
        width: 7px; height: 7px;
        border-radius: 50%;
        background: var(--kfl-green, #00e868);
        box-shadow: 0 0 6px var(--kfl-green, #00e868);
        flex-shrink: 0;
        animation: kfl-lw-pulse 2s ease-in-out infinite;
      }

      @keyframes kfl-lw-pulse {
        0%, 100% { opacity: 1; transform: scale(1); }
        50%       { opacity: 0.5; transform: scale(0.7); }
      }

      .kfl-lw-pill.is-loading .kfl-lw-dot {
        background: rgba(255,255,255,0.2);
        box-shadow: none;
        animation: none;
      }

      /* score */
      .kfl-lw-score {
        font-family: 'Barlow Condensed', sans-serif;
        font-size: 1rem;
        font-weight: 900;
        color: var(--kfl-text-1, #fff);
        letter-spacing: -0.5px;
        line-height: 1;
        min-width: 24px;
        text-align: center;
        transition: color 0.3s ease;
      }

      .kfl-lw-score.updated {
        animation: kfl-lw-score-flash 0.5s ease;
      }

      @keyframes kfl-lw-score-flash {
        0%   { color: var(--kfl-green, #00e868); transform: scale(1.15); }
        100% { color: var(--kfl-text-1, #fff);  transform: scale(1); }
      }

      /* divider */
      .kfl-lw-sep {
        width: 1px; height: 16px;
        background: rgba(255,255,255,0.10);
        flex-shrink: 0;
      }

      /* rank arrow */
      .kfl-lw-arrow {
        font-family: 'DM Sans', sans-serif;
        font-size: 0.62rem;
        font-weight: 700;
        display: flex;
        align-items: center;
        gap: 2px;
        white-space: nowrap;
      }
      .kfl-lw-arrow.up   { color: var(--kfl-green, #00e868); }
      .kfl-lw-arrow.down { color: #ef4444; }
      .kfl-lw-arrow.same { color: rgba(255,255,255,0.35); }

      /* players to play */
      .kfl-lw-ttp {
        font-family: 'DM Sans', sans-serif;
        font-size: 0.58rem;
        font-weight: 600;
        color: rgba(255,255,255,0.38);
        white-space: nowrap;
      }
      .kfl-lw-ttp strong {
        color: rgba(255,255,255,0.7);
        font-weight: 700;
      }

      /* expand icon */
      .kfl-lw-expand-icon {
        font-size: 0.5rem;
        color: rgba(255,255,255,0.25);
        margin-left: 2px;
      }

      /* ── Expanded panel ── */
      .kfl-lw-panel {
        position: fixed;
        bottom: ${pillBottom() + 44}px;
        left: 50%;
        transform: translateX(-50%) translateY(10px) scale(0.96);
        z-index: 949;

        width: calc(100vw - 24px);
        max-width: 360px;
        max-height: 70vh;
        overflow-y: auto;
        scrollbar-width: none;

        background: var(--kfl-surface, #141e2d);
        border: 1px solid rgba(255,255,255,0.08);
        border-radius: 16px;
        box-shadow: 0 16px 48px rgba(0,0,0,0.55);

        opacity: 0;
        pointer-events: none;
        transition: opacity 0.22s ease, transform 0.28s cubic-bezier(0.34,1.2,0.64,1);
        will-change: transform, opacity;
      }

      .kfl-lw-panel::-webkit-scrollbar { display: none; }

      .kfl-lw-panel.is-open {
        opacity: 1;
        pointer-events: auto;
        transform: translateX(-50%) translateY(0) scale(1);
      }

      /* panel header */
      .kfl-lw-panel-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 12px 14px 10px;
        border-bottom: 1px solid rgba(255,255,255,0.06);
        position: sticky;
        top: 0;
        background: var(--kfl-surface, #141e2d);
        z-index: 1;
        border-radius: 16px 16px 0 0;
      }

      .kfl-lw-panel-title {
        font-family: 'Barlow Condensed', sans-serif;
        font-size: 0.6rem;
        font-weight: 800;
        letter-spacing: 2px;
        text-transform: uppercase;
        color: var(--kfl-green, #00e868);
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .kfl-lw-panel-pts {
        font-family: 'Barlow Condensed', sans-serif;
        font-size: 1.3rem;
        font-weight: 900;
        color: var(--kfl-text-1, #fff);
        letter-spacing: -0.5px;
        line-height: 1;
      }

      .kfl-lw-panel-close {
        width: 24px; height: 24px;
        border-radius: 50%;
        background: rgba(255,255,255,0.06);
        border: 1px solid rgba(255,255,255,0.08);
        color: rgba(255,255,255,0.3);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer;
        font-size: 0.6rem;
        transition: background 0.15s;
        flex-shrink: 0;
      }
      .kfl-lw-panel-close:hover { background: rgba(255,255,255,0.12); color: #fff; }

      /* panel summary strip */
      .kfl-lw-summary {
        display: grid;
        grid-template-columns: 1fr 1fr 1fr;
        border-bottom: 1px solid rgba(255,255,255,0.05);
      }

      .kfl-lw-summary-item {
        padding: 8px 12px;
        text-align: center;
      }
      .kfl-lw-summary-item + .kfl-lw-summary-item {
        border-left: 1px solid rgba(255,255,255,0.05);
      }
      .kfl-lw-summary-label {
        font-family: 'DM Sans', sans-serif;
        font-size: 0.5rem;
        font-weight: 700;
        letter-spacing: 1px;
        text-transform: uppercase;
        color: rgba(255,255,255,0.28);
        margin-bottom: 3px;
      }
      .kfl-lw-summary-value {
        font-family: 'Barlow Condensed', sans-serif;
        font-size: 0.9rem;
        font-weight: 800;
        color: var(--kfl-text-1, #fff);
        line-height: 1;
      }
      .kfl-lw-summary-value.up   { color: var(--kfl-green, #00e868); }
      .kfl-lw-summary-value.down { color: #ef4444; }

      /* player rows */
      .kfl-lw-players {
        padding: 6px 0 4px;
      }

      .kfl-lw-player-row {
        display: flex;
        align-items: center;
        gap: 10px;
        padding: 6px 14px;
        transition: background 0.1s;
      }
      .kfl-lw-player-row:hover { background: rgba(255,255,255,0.02); }

      .kfl-lw-pos-badge {
        width: 20px; height: 20px;
        border-radius: 4px;
        display: flex; align-items: center; justify-content: center;
        font-family: 'Barlow Condensed', sans-serif;
        font-size: 0.55rem; font-weight: 800;
        flex-shrink: 0;
        letter-spacing: 0.3px;
      }
      .kfl-lw-pos-badge.gkp { background: rgba(234,179,8,0.15);  color: #eab308; }
      .kfl-lw-pos-badge.def { background: rgba(59,130,246,0.15); color: #60a5fa; }
      .kfl-lw-pos-badge.mid { background: rgba(34,197,94,0.15);  color: #4ade80; }
      .kfl-lw-pos-badge.fwd { background: rgba(239,68,68,0.15);  color: #f87171; }

      .kfl-lw-player-name {
        font-family: 'Barlow Condensed', sans-serif;
        font-size: 0.82rem; font-weight: 700;
        color: var(--kfl-text-1, #fff);
        flex: 1; min-width: 0;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        line-height: 1;
      }
      .kfl-lw-player-name.is-playing { color: var(--kfl-green, #00e868); }
      .kfl-lw-player-name.not-played { color: rgba(255,255,255,0.4); }
      .kfl-lw-player-name.benched    { color: rgba(255,255,255,0.22); }

      .kfl-lw-player-status {
        font-size: 0.5rem;
        flex-shrink: 0;
        display: flex; align-items: center; gap: 3px;
      }

      .kfl-lw-player-pts {
        font-family: 'Barlow Condensed', sans-serif;
        font-size: 0.9rem; font-weight: 800;
        color: var(--kfl-text-1, #fff);
        min-width: 22px; text-align: right; line-height: 1;
        flex-shrink: 0;
      }
      .kfl-lw-player-pts.captain { color: #f59e0b; }
      .kfl-lw-player-pts.vice    { color: rgba(245,158,11,0.55); }
      .kfl-lw-player-pts.benched { color: rgba(255,255,255,0.22); }

      .kfl-lw-captain-badge {
        font-family: 'Barlow Condensed', sans-serif;
        font-size: 0.5rem; font-weight: 900;
        background: #f59e0b; color: #fff;
        width: 13px; height: 13px;
        border-radius: 50%;
        display: inline-flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .kfl-lw-captain-badge.vc {
        background: rgba(245,158,11,0.25); color: #f59e0b;
      }

      /* bench divider */
      .kfl-lw-bench-label {
        font-family: 'DM Sans', sans-serif;
        font-size: 0.5rem; font-weight: 700;
        letter-spacing: 1.2px; text-transform: uppercase;
        color: rgba(255,255,255,0.2);
        padding: 6px 14px 3px;
        border-top: 1px solid rgba(255,255,255,0.05);
        margin-top: 2px;
      }

      /* still to play chip */
      .kfl-lw-ttp-chip {
        font-size: 0.48rem; font-weight: 700;
        padding: 1px 5px; border-radius: 4px;
        background: rgba(255,255,255,0.07);
        color: rgba(255,255,255,0.4);
        white-space: nowrap;
      }
      .kfl-lw-ttp-chip.playing {
        background: rgba(0,232,104,0.12);
        color: var(--kfl-green, #00e868);
      }

      /* refresh indicator */
      .kfl-lw-refresh-bar {
        height: 2px;
        background: rgba(255,255,255,0.04);
        border-radius: 0 0 16px 16px;
        overflow: hidden;
      }
      .kfl-lw-refresh-bar-fill {
        height: 100%;
        background: var(--kfl-green, #00e868);
        opacity: 0.5;
        border-radius: 100px;
        width: 0%;
        transition: width linear;
      }

      /* panel dismiss backdrop */
      .kfl-lw-backdrop {
        position: fixed;
        inset: 0;
        z-index: 948;
        display: none;
      }
      .kfl-lw-backdrop.is-open { display: block; }

      /* light theme */
      [data-theme="light"] .kfl-lw-pill {
        background: #ffffff;
        border-color: rgba(0,0,0,0.08);
        box-shadow: 0 4px 20px rgba(0,0,0,0.12);
      }
      [data-theme="light"] .kfl-lw-score         { color: #0a0e1a; }
      [data-theme="light"] .kfl-lw-sep           { background: rgba(0,0,0,0.08); }
      [data-theme="light"] .kfl-lw-ttp           { color: rgba(0,0,0,0.4); }
      [data-theme="light"] .kfl-lw-ttp strong    { color: rgba(0,0,0,0.7); }
      [data-theme="light"] .kfl-lw-expand-icon   { color: rgba(0,0,0,0.2); }
      [data-theme="light"] .kfl-lw-panel         { background: #ffffff; border-color: rgba(0,0,0,0.07); }
      [data-theme="light"] .kfl-lw-panel-header  { background: #ffffff; border-bottom-color: rgba(0,0,0,0.06); }
      [data-theme="light"] .kfl-lw-panel-pts     { color: #0a0e1a; }
      [data-theme="light"] .kfl-lw-panel-close   { background: rgba(0,0,0,0.05); border-color: rgba(0,0,0,0.07); color: rgba(0,0,0,0.35); }
      [data-theme="light"] .kfl-lw-summary       { border-bottom-color: rgba(0,0,0,0.05); }
      [data-theme="light"] .kfl-lw-summary-item + .kfl-lw-summary-item { border-left-color: rgba(0,0,0,0.05); }
      [data-theme="light"] .kfl-lw-summary-label { color: rgba(0,0,0,0.3); }
      [data-theme="light"] .kfl-lw-summary-value { color: #0a0e1a; }
      [data-theme="light"] .kfl-lw-player-name   { color: #0a0e1a; }
      [data-theme="light"] .kfl-lw-player-pts    { color: #0a0e1a; }
      [data-theme="light"] .kfl-lw-bench-label   { color: rgba(0,0,0,0.22); border-top-color: rgba(0,0,0,0.06); }
      [data-theme="light"] .kfl-lw-refresh-bar   { background: rgba(0,0,0,0.04); }
    `;
    document.head.appendChild(s);
  })();

  /* ── DOM refs ── */
  let pill, panel, backdrop, scoreEl, arrowEl, ttpEl, fillEl;

  function buildDOM() {
    // Backdrop
    backdrop = document.createElement('div');
    backdrop.className = 'kfl-lw-backdrop';
    backdrop.addEventListener('click', collapse);

    // Panel
    panel = document.createElement('div');
    panel.className = 'kfl-lw-panel';
    panel.id = 'kfl-lw-panel';
    panel.innerHTML = `
      <div class="kfl-lw-panel-header">
        <div class="kfl-lw-panel-title">
          <span class="kfl-lw-dot" style="width:6px;height:6px;border-radius:50%;background:var(--kfl-green,#00e868);box-shadow:0 0 5px var(--kfl-green,#00e868);animation:kfl-lw-pulse 2s ease-in-out infinite;display:inline-block"></span>
          Live GW
        </div>
        <div class="kfl-lw-panel-pts" id="kfl-lw-panel-pts">—</div>
        <button class="kfl-lw-panel-close" id="kfl-lw-panel-close" aria-label="Close">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="kfl-lw-summary" id="kfl-lw-summary">
        <div class="kfl-lw-summary-item">
          <div class="kfl-lw-summary-label">Rank</div>
          <div class="kfl-lw-summary-value" id="kfl-lw-s-rank">—</div>
        </div>
        <div class="kfl-lw-summary-item">
          <div class="kfl-lw-summary-label">Change</div>
          <div class="kfl-lw-summary-value" id="kfl-lw-s-change">—</div>
        </div>
        <div class="kfl-lw-summary-item">
          <div class="kfl-lw-summary-label">To Play</div>
          <div class="kfl-lw-summary-value" id="kfl-lw-s-ttp">—</div>
        </div>
      </div>
      <div class="kfl-lw-players" id="kfl-lw-players"></div>
      <div class="kfl-lw-refresh-bar">
        <div class="kfl-lw-refresh-bar-fill" id="kfl-lw-fill"></div>
      </div>
    `;

    // Pill
    pill = document.createElement('div');
    pill.className = 'kfl-lw-pill is-hidden';
    pill.id = 'kfl-lw-pill';
    pill.setAttribute('role', 'button');
    pill.setAttribute('aria-label', 'Live gameweek score');
    pill.innerHTML = `
      <span class="kfl-lw-dot"></span>
      <span class="kfl-lw-score" id="kfl-lw-score">—</span>
      <span class="kfl-lw-sep"></span>
      <span class="kfl-lw-arrow same" id="kfl-lw-arrow">—</span>
      <span class="kfl-lw-sep"></span>
      <span class="kfl-lw-ttp" id="kfl-lw-ttp"><strong>?</strong> to play</span>
      <i class="fa-solid fa-chevron-up kfl-lw-expand-icon"></i>
    `;

    document.body.appendChild(backdrop);
    document.body.appendChild(panel);
    document.body.appendChild(pill);

    scoreEl = document.getElementById('kfl-lw-score');
    arrowEl = document.getElementById('kfl-lw-arrow');
    ttpEl   = document.getElementById('kfl-lw-ttp');
    fillEl  = document.getElementById('kfl-lw-fill');

    pill.addEventListener('click', toggleExpand);
    document.getElementById('kfl-lw-panel-close').addEventListener('click', collapse);
  }

  /* ── Expand / Collapse ── */
  function toggleExpand() {
    if (_isExpanded) { collapse(); return; }
    H.expand();
    _isExpanded = true;
    panel.classList.add('is-open');
    backdrop.classList.add('is-open');
    pill.querySelector('.kfl-lw-expand-icon').style.transform = 'rotate(180deg)';
    pill.querySelector('.kfl-lw-expand-icon').style.transition = 'transform 0.2s ease';
  }

  function collapse() {
    if (!_isExpanded) return;
    H.dismiss();
    _isExpanded = false;
    panel.classList.remove('is-open');
    backdrop.classList.remove('is-open');
    pill.querySelector('.kfl-lw-expand-icon').style.transform = 'rotate(0deg)';
  }

  /* ── Format helpers ── */
  function fmtRank(n) {
    if (!n) return '—';
    return n >= 1000000 ? (n / 1000000).toFixed(1) + 'M'
         : n >= 1000    ? (n / 1000).toFixed(0) + 'k'
         : String(n);
  }

  function posLabel(type) {
    return ['GKP', 'DEF', 'MID', 'FWD'][type - 1] || '?';
  }
  function posClass(type) {
    return ['gkp', 'def', 'mid', 'fwd'][type - 1] || 'mid';
  }

  /* ── Refresh countdown bar ── */
  let _fillTimer = null;
  function startFill() {
    if (!fillEl) return;
    clearTimeout(_fillTimer);
    fillEl.style.transition = 'none';
    fillEl.style.width = '0%';
    requestAnimationFrame(() => {
      fillEl.style.transition = `width ${REFRESH_MS}ms linear`;
      fillEl.style.width = '100%';
    });
  }

  /* ── Render pill ── */
  function renderPill(pts, rankDir, rankDiff, ttpCount) {
    const prevPts = _lastPts;

    scoreEl.textContent = pts;
    if (prevPts !== null && pts !== prevPts) {
      scoreEl.classList.remove('updated');
      void scoreEl.offsetWidth; // reflow
      scoreEl.classList.add('updated');
      H.score();
    }
    _lastPts = pts;

    // Arrow
    arrowEl.className = 'kfl-lw-arrow ' + rankDir;
    if (rankDir === 'up')   arrowEl.innerHTML = `<i class="fa-solid fa-arrow-up" style="font-size:0.5rem"></i> ${fmtRank(rankDiff)}`;
    else if (rankDir === 'down') arrowEl.innerHTML = `<i class="fa-solid fa-arrow-down" style="font-size:0.5rem"></i> ${fmtRank(rankDiff)}`;
    else arrowEl.innerHTML = `<i class="fa-solid fa-minus" style="font-size:0.5rem"></i>`;

    // To play
    ttpEl.innerHTML = `<strong>${ttpCount}</strong> to play`;

    // Show pill
    pill.classList.remove('is-hidden');
    pill.classList.remove('is-loading');
  }

  /* ── Render panel player list ── */
  function renderPanel(data) {
    const { pts, overallRank, prevRank, players, ttpCount } = data;

    document.getElementById('kfl-lw-panel-pts').textContent = pts + ' pts';

    // Summary
    const rankDiffVal = prevRank && overallRank ? prevRank - overallRank : 0;
    const rankDir = rankDiffVal > 0 ? 'up' : rankDiffVal < 0 ? 'down' : 'same';
    document.getElementById('kfl-lw-s-rank').textContent = fmtRank(overallRank);
    const changeEl = document.getElementById('kfl-lw-s-change');
    changeEl.className = 'kfl-lw-summary-value ' + rankDir;
    changeEl.textContent = rankDiffVal > 0 ? '+' + fmtRank(rankDiffVal)
                         : rankDiffVal < 0 ? '-' + fmtRank(Math.abs(rankDiffVal))
                         : '→';
    document.getElementById('kfl-lw-s-ttp').textContent = ttpCount;

    // Player rows
    const container = document.getElementById('kfl-lw-players');
    let html = '';
    let benchStarted = false;

    players.forEach((p, i) => {
      if (i === 11 && !benchStarted) {
        html += `<div class="kfl-lw-bench-label">Bench</div>`;
        benchStarted = true;
      }

      const isBench   = i >= 11;
      const ptsClass  = p.isCaptain ? 'captain' : p.isVice ? 'vice' : isBench ? 'benched' : '';
      const nameClass = p.isPlaying ? 'is-playing' : p.hasPlayed ? '' : isBench ? 'benched' : 'not-played';
      const pos       = posLabel(p.posType);
      const posC      = posClass(p.posType);

      const captainBadge = p.isCaptain
        ? `<span class="kfl-lw-captain-badge">C</span>`
        : p.isVice
        ? `<span class="kfl-lw-captain-badge vc">V</span>`
        : '';

      const statusChip = p.isPlaying
        ? `<span class="kfl-lw-ttp-chip playing">LIVE</span>`
        : !p.hasPlayed
        ? `<span class="kfl-lw-ttp-chip">TBP</span>`
        : '';

      const displayPts = p.isCaptain ? p.pts * 2 : p.pts;

      html += `
        <div class="kfl-lw-player-row">
          <span class="kfl-lw-pos-badge ${posC}">${pos}</span>
          ${captainBadge}
          <span class="kfl-lw-player-name ${nameClass}">${p.name}</span>
          <span class="kfl-lw-player-status">${statusChip}</span>
          <span class="kfl-lw-player-pts ${ptsClass}">${displayPts}</span>
        </div>
      `;
    });

    container.innerHTML = html;
  }

  /* ── Fetch & compute ── */
  async function refresh() {
    const teamId = localStorage.getItem(STORAGE_ID);
    if (!teamId) return;

    try {
      // Bootstrap to get current GW + player data
      const bsRes     = await fetch(PROXY + 'bootstrap-static/');
      const bootstrap = await bsRes.json();

      const currentEvent = bootstrap.events.find(e => e.is_current);
      if (!currentEvent) { hidePill(); return; }

      // Only show during active gameweek (has started but not all finished)
      const gwId = currentEvent.id;

      // Fetch picks + live in parallel
      const [picksRes, liveRes] = await Promise.all([
        fetch(PROXY + `entry/${teamId}/event/${gwId}/picks/`),
        fetch(PROXY + `event/${gwId}/live/`),
      ]);
      const picksData = await picksRes.json();
      const liveData  = await liveRes.json();

      const picks   = picksData.picks || [];
      const history = picksData.entry_history;
      if (!picks.length) return;

      // Build live points map
      const liveMap = {};
      const playingMap = {};  // currently in a live game
      const playedMap  = {};  // game finished
      (liveData.elements || []).forEach(e => {
        liveMap[e.id]    = e.stats?.total_points ?? 0;
        playingMap[e.id] = e.explain?.some(ex => ex.stats?.some(s => s.identifier === 'minutes' && s.value > 0)) ?? false;
        playedMap[e.id]  = (e.stats?.minutes ?? 0) > 0;
      });

      // Build player lookup
      const playerMap = {};
      bootstrap.elements.forEach(p => { playerMap[p.id] = p; });

      // Compute total live points
      let totalPts = 0;
      let ttpCount = 0;
      const players = [];

      picks.forEach((pick, i) => {
        const player    = playerMap[pick.element];
        if (!player) return;
        const rawPts    = liveMap[pick.element] ?? 0;
        const pts       = pick.multiplier > 1 ? rawPts * pick.multiplier : rawPts;
        const isPlaying = playingMap[pick.element] ?? false;
        const hasPlayed = playedMap[pick.element] ?? false;

        if (i < 11) totalPts += pts;
        if (!hasPlayed && !isPlaying && i < 11) ttpCount++;

        players.push({
          name:      player.web_name,
          posType:   player.element_type,
          pts:       rawPts,
          isCaptain: pick.is_captain,
          isVice:    pick.is_vice_captain,
          multiplier: pick.multiplier,
          isPlaying,
          hasPlayed,
        });
      });

      // Rank direction
      const prevRank    = history?.rank_sort ?? null;
      const overallRank = history?.overall_rank ?? null;
      const rankDiffVal = prevRank && overallRank ? prevRank - overallRank : 0;
      const rankDir     = rankDiffVal > 0 ? 'up' : rankDiffVal < 0 ? 'down' : 'same';

      _data = { pts: totalPts, overallRank, prevRank, players, ttpCount, rankDir, rankDiffVal };

      renderPill(totalPts, rankDir, Math.abs(rankDiffVal), ttpCount);
      if (_isExpanded) renderPanel(_data);

      startFill();

    } catch (err) {
      console.warn('[LiveWidget] Refresh failed:', err.message);
    }
  }

  function hidePill() {
    if (pill) pill.classList.add('is-hidden');
    collapse();
    clearInterval(_timer);
  }

  /* ── Boot ── */
  async function init() {
    const teamId = localStorage.getItem(STORAGE_ID);
    if (!teamId) return;

    buildDOM();

    // Show loading state immediately
    pill.classList.remove('is-hidden');
    pill.classList.add('is-loading');

    await refresh();

    // Panel render wired to expand click — render on first open
    pill.addEventListener('click', () => {
      if (_isExpanded && _data) renderPanel(_data);
    });

    // Auto-refresh every 60s
    _timer = setInterval(refresh, REFRESH_MS);
  }

  // Stop refreshing when tab hidden, resume on focus
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      clearInterval(_timer);
    } else {
      refresh();
      _timer = setInterval(refresh, REFRESH_MS);
    }
  });

  window.KopalaLiveWidget = {
    refresh,
    hide: hidePill,
    expand: toggleExpand,
    collapse,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
