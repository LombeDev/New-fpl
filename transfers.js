/**
 * transfers.js — Kopala FPL
 * Top 5 transfers in & out for the current gameweek.
 * Renders into #transfers-container on any page that has one.
 */

(function () {
  'use strict';

  const PROXY = '/.netlify/functions/fpl-proxy?endpoint=bootstrap-static/';
  const container = document.getElementById('transfers-container');
  if (!container) return;

  /* ============================================
     INJECT STYLES
     ============================================ */
  const style = document.createElement('style');
  style.textContent = `
    .tr-section {
      padding: 16px 16px 0;
    }

    /* Tab switcher — IN / OUT toggle */
    .tr-tabs {
      display: flex;
      background: var(--surface-2, #202020);
      border: 1px solid var(--border, rgba(255,255,255,0.07));
      border-radius: var(--r-lg, 16px);
      padding: 4px;
      gap: 4px;
      margin-bottom: 14px;
    }

    .tr-tab {
      flex: 1;
      padding: 9px 12px;
      border-radius: 10px;
      border: none;
      background: transparent;
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 0.85rem;
      font-weight: 800;
      letter-spacing: 0.4px;
      color: var(--text-3, #666);
      cursor: pointer;
      transition: background 0.2s ease, color 0.2s ease;
      -webkit-tap-highlight-color: transparent;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 7px;
    }

    .tr-tab i { font-size: 0.7rem; }

    .tr-tab.active-in {
      background: rgba(0, 232, 122, 0.12);
      color: #00e87a;
    }

    .tr-tab.active-out {
      background: rgba(239, 68, 68, 0.12);
      color: #ef4444;
    }

    /* List panels */
    .tr-panel {
      display: none;
    }
    .tr-panel.visible {
      display: block;
    }

    /* Individual row */
    .tr-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 0;
      border-bottom: 1px solid var(--border, rgba(255,255,255,0.07));
      transition: background 0.15s;
    }
    .tr-row:last-child {
      border-bottom: none;
    }

    /* Rank number */
    .tr-rank {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 1rem;
      font-weight: 900;
      color: var(--text-3, #666);
      min-width: 18px;
      text-align: center;
      flex-shrink: 0;
    }

    /* Shirt */
    .tr-shirt {
      width: 34px;
      height: auto;
      flex-shrink: 0;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.35));
    }

    /* Player info */
    .tr-info {
      flex: 1;
      min-width: 0;
    }

    .tr-info__name {
      font-size: 0.88rem;
      font-weight: 700;
      color: var(--text-1, #fff);
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      line-height: 1.2;
    }

    .tr-info__meta {
      display: flex;
      align-items: center;
      gap: 6px;
      margin-top: 2px;
    }

    .tr-info__team {
      font-size: 0.68rem;
      font-weight: 600;
      color: var(--text-3, #666);
    }

    .tr-pos-badge {
      font-size: 0.58rem;
      font-weight: 800;
      letter-spacing: 0.5px;
      padding: 1px 5px;
      border-radius: 4px;
    }

    .tr-pos-badge.gkp { background: rgba(245,158,11,0.15); color: #f59e0b; }
    .tr-pos-badge.def { background: rgba(34,197,94,0.15);  color: #22c55e; }
    .tr-pos-badge.mid { background: rgba(59,130,246,0.15); color: #3b82f6; }
    .tr-pos-badge.fwd { background: rgba(239,68,68,0.15);  color: #ef4444; }

    /* Transfer count */
    .tr-count {
      font-family: 'Barlow Condensed', sans-serif;
      font-size: 1rem;
      font-weight: 900;
      flex-shrink: 0;
      font-variant-numeric: tabular-nums;
    }
    .tr-count.in  { color: #00e87a; }
    .tr-count.out { color: #ef4444; }

    /* Direction arrow */
    .tr-arrow {
      font-size: 0.65rem;
      flex-shrink: 0;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .tr-arrow.in  { background: rgba(0,232,122,0.1);  color: #00e87a; }
    .tr-arrow.out { background: rgba(239,68,68,0.1);   color: #ef4444; }

    /* Shimmer rows */
    .tr-shimmer-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 0;
      border-bottom: 1px solid var(--border, rgba(255,255,255,0.07));
    }
    .tr-shimmer-row:last-child { border-bottom: none; }

    .tr-ghost {
      background: linear-gradient(90deg, #202020 25%, #2a2a2a 50%, #202020 75%);
      background-size: 400% 100%;
      animation: tr-shimmer 1.6s ease infinite;
      border-radius: 6px;
    }
    @keyframes tr-shimmer {
      from { background-position: -200% 0; }
      to   { background-position:  200% 0; }
    }
  `;
  document.head.appendChild(style);

  /* ============================================
     RENDER HELPERS
     ============================================ */
  const POS_LABELS = ['', 'GKP', 'DEF', 'MID', 'FWD'];
  const POS_CLASS  = ['', 'gkp', 'def', 'mid', 'fwd'];

  function formatCount(n) {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + 'm';
    if (n >= 1000)    return (n / 1000).toFixed(1) + 'k';
    return n.toLocaleString();
  }

  function buildRow(player, teamMeta, isIn, rank) {
    const dir     = isIn ? 'in' : 'out';
    const icon    = isIn ? 'fa-arrow-up' : 'fa-arrow-down';
    const count   = isIn ? player.transfers_in_event : player.transfers_out_event;
    const posIdx  = player.element_type;
    const isGK    = posIdx === 1;
    const shirt   = `https://draft.premierleague.com/img/shirts/standard/shirt_${teamMeta.code}${isGK ? '_1' : ''}-66.png`;

    return `
      <div class="tr-row">
        <span class="tr-rank">${rank}</span>
        <div class="tr-arrow ${dir}"><i class="fa-solid ${icon}"></i></div>
        <img class="tr-shirt" src="${shirt}" alt="${player.web_name}" loading="lazy"
             onerror="this.src='https://draft.premierleague.com/img/shirts/standard/shirt_1-66.png'">
        <div class="tr-info">
          <div class="tr-info__name">${player.web_name}</div>
          <div class="tr-info__meta">
            <span class="tr-info__team">${teamMeta.name}</span>
            <span class="tr-pos-badge ${POS_CLASS[posIdx]}">${POS_LABELS[posIdx]}</span>
          </div>
        </div>
        <div class="tr-count ${dir}">${formatCount(count)}</div>
      </div>
    `;
  }

  function buildShimmers(count = 5) {
    return Array.from({ length: count }, () => `
      <div class="tr-shimmer-row">
        <div class="tr-ghost" style="width:18px;height:16px;border-radius:4px;flex-shrink:0;"></div>
        <div class="tr-ghost" style="width:20px;height:20px;border-radius:50%;flex-shrink:0;"></div>
        <div class="tr-ghost" style="width:34px;height:34px;border-radius:6px;flex-shrink:0;"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:5px;">
          <div class="tr-ghost" style="height:13px;width:70%;"></div>
          <div class="tr-ghost" style="height:10px;width:45%;"></div>
        </div>
        <div class="tr-ghost" style="width:40px;height:16px;border-radius:4px;flex-shrink:0;"></div>
      </div>
    `).join('');
  }

  /* ============================================
     RENDER FULL COMPONENT
     ============================================ */
  function render(topIn, topOut, teams) {
    const inRows  = topIn.map((p, i)  => buildRow(p, teams[p.team], true,  i + 1)).join('');
    const outRows = topOut.map((p, i) => buildRow(p, teams[p.team], false, i + 1)).join('');

    container.innerHTML = `
      <div class="tr-section">
        <div class="section-header">
          <span class="section-title">GW Transfers</span>
        </div>

        <div class="tr-tabs" role="tablist">
          <button class="tr-tab active-in" id="tr-tab-in" role="tab" aria-selected="true" aria-controls="tr-panel-in">
            <i class="fa-solid fa-arrow-up"></i> Transfers In
          </button>
          <button class="tr-tab" id="tr-tab-out" role="tab" aria-selected="false" aria-controls="tr-panel-out">
            <i class="fa-solid fa-arrow-down"></i> Transfers Out
          </button>
        </div>

        <div class="tr-panel visible" id="tr-panel-in" role="tabpanel" aria-labelledby="tr-tab-in">
          ${inRows}
        </div>
        <div class="tr-panel" id="tr-panel-out" role="tabpanel" aria-labelledby="tr-tab-out">
          ${outRows}
        </div>
      </div>
    `;

    // Tab switching
    const tabIn  = document.getElementById('tr-tab-in');
    const tabOut = document.getElementById('tr-tab-out');
    const panIn  = document.getElementById('tr-panel-in');
    const panOut = document.getElementById('tr-panel-out');

    tabIn.addEventListener('click', () => {
      tabIn.classList.add('active-in');
      tabOut.classList.remove('active-out');
      tabIn.setAttribute('aria-selected', 'true');
      tabOut.setAttribute('aria-selected', 'false');
      panIn.classList.add('visible');
      panOut.classList.remove('visible');
    });

    tabOut.addEventListener('click', () => {
      tabOut.classList.add('active-out');
      tabIn.classList.remove('active-in');
      tabOut.setAttribute('aria-selected', 'true');
      tabIn.setAttribute('aria-selected', 'false');
      panOut.classList.add('visible');
      panIn.classList.remove('visible');
    });
  }

  /* ============================================
     FETCH & BOOT
     ============================================ */
  async function init() {
    // Show shimmers while loading
    container.innerHTML = `
      <div class="tr-section">
        <div class="section-header">
          <span class="section-title">GW Transfers</span>
        </div>
        <div class="tr-tabs">
          <div class="tr-ghost" style="flex:1;height:38px;border-radius:10px;"></div>
          <div class="tr-ghost" style="flex:1;height:38px;border-radius:10px;margin-left:4px;"></div>
        </div>
        ${buildShimmers(5)}
      </div>
    `;

    try {
      const res  = await fetch(PROXY);
      const data = await res.json();

      const teams = {};
      data.teams.forEach(t => { teams[t.id] = { name: t.short_name, code: t.code }; });

      const players = data.elements;
      const topIn   = [...players].sort((a, b) => b.transfers_in_event  - a.transfers_in_event).slice(0, 5);
      const topOut  = [...players].sort((a, b) => b.transfers_out_event - a.transfers_out_event).slice(0, 5);

      render(topIn, topOut, teams);

    } catch (err) {
      console.error('[Transfers]', err);
      container.innerHTML = `
        <div class="tr-section">
          <div class="empty-state">
            <div class="empty-state__icon"><i class="fa-solid fa-rotate-exclamation"></i></div>
            <div class="empty-state__msg">Transfer data unavailable</div>
          </div>
        </div>
      `;
    }
  }

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();

})();
