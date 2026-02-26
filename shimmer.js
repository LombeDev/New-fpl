/* ============================================================
   KOPALA FPL — SHIMMER.JS
   Page-specific loading skeletons.
   Each page calls the matching function before its data fetch.
   ============================================================ */

(function () {
  'use strict';

  /* ── Shared sweep animation injected once ────────────────── */
  const _STYLE_ID = 'kfl-shimmer-styles';
  function _injectStyles() {
    if (document.getElementById(_STYLE_ID)) return;
    const s = document.createElement('style');
    s.id = _STYLE_ID;
    s.textContent = `
      @keyframes _kfl_sweep {
        0%   { background-position: -600px 0; }
        100% { background-position:  600px 0; }
      }
      .kskel {
        background: linear-gradient(
          90deg,
          var(--surface-2, rgba(255,255,255,0.04)) 25%,
          var(--surface-3, rgba(255,255,255,0.09)) 50%,
          var(--surface-2, rgba(255,255,255,0.04)) 75%
        );
        background-size: 1200px 100%;
        animation: _kfl_sweep 1.5s ease-in-out infinite;
        border-radius: 6px;
      }
      /* Card shell */
      .kskel-card {
        background: var(--surface-2, #1a1d25);
        border: 1px solid var(--border, rgba(255,255,255,0.06));
        border-radius: 12px;
        overflow: hidden;
        padding: 12px;
      }
      /* Row shell */
      .kskel-row {
        background: var(--surface-2, #1a1d25);
        border: 1px solid var(--border, rgba(255,255,255,0.06));
        border-radius: 10px;
        padding: 10px 14px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      /* Match card shell */
      .kskel-match {
        background: var(--surface-2, #1a1d25);
        border: 1px solid var(--border, rgba(255,255,255,0.06));
        border-radius: 16px;
        overflow: hidden;
      }
    `;
    document.head.appendChild(s);
  }

  /* ══════════════════════════════════════════════════════════
     LEAGUES PAGE
     Matches .lg-list layout:
     • Header bar (title + chip placeholder)
     • 8 × manager cards (rank circle + name lines + 3 stat boxes)
     ══════════════════════════════════════════════════════════ */
  function leaguesShimmer(container) {
    _injectStyles();
    if (typeof container === 'string') container = document.getElementById(container);
    if (!container) return;

    const card = (delay) => `
      <div class="kskel-card" style="animation-delay:${delay}s">

        <!-- Card header: rank + name block + GW score -->
        <div style="display:flex;align-items:flex-start;gap:10px;margin-bottom:10px">

          <!-- Rank column -->
          <div style="display:flex;flex-direction:column;align-items:center;gap:5px;flex-shrink:0;width:28px">
            <div class="kskel" style="width:16px;height:16px;border-radius:50%"></div>
            <div class="kskel" style="width:24px;height:22px;border-radius:5px"></div>
          </div>

          <!-- Name + manager -->
          <div style="flex:1;min-width:0">
            <div class="kskel" style="height:13px;width:62%;margin-bottom:7px"></div>
            <div class="kskel" style="height:10px;width:40%"></div>
          </div>

          <!-- GW score -->
          <div style="text-align:right;flex-shrink:0">
            <div class="kskel" style="height:18px;width:32px;margin-bottom:4px;margin-left:auto"></div>
            <div class="kskel" style="height:9px;width:18px;margin-left:auto"></div>
          </div>
        </div>

        <!-- 3-column stat boxes -->
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px">
          ${[0,1,2].map(() => `
            <div style="background:var(--surface-1,#0d0d0d);border:1px solid var(--border,rgba(255,255,255,0.06));border-radius:8px;padding:8px 6px;text-align:center">
              <div class="kskel" style="height:9px;width:55%;margin:0 auto 5px"></div>
              <div class="kskel" style="height:15px;width:40%;margin:0 auto"></div>
            </div>
          `).join('')}
        </div>

      </div>`;

    container.innerHTML = [0,0.05,0.1,0.15,0.2,0.25,0.3,0.35]
      .map(d => card(d)).join('');
  }

  /* ══════════════════════════════════════════════════════════
     PRICES PAGE
     Matches .pc-list layout:
     • 12 × player rows (shirt · name+meta · progress bar · net · prob · pred · star)
     ══════════════════════════════════════════════════════════ */
  function pricesShimmer(container) {
    _injectStyles();
    if (typeof container === 'string') container = document.getElementById(container);
    if (!container) return;

    // Also shimmer the zone summary cards
    const zones = document.getElementById('pc-zones');
    if (zones) {
      zones.innerHTML = [0,1,2].map(i => `
        <div class="kskel-card" style="text-align:center;padding:10px">
          <div class="kskel" style="height:28px;width:40px;margin:0 auto 5px;border-radius:6px"></div>
          <div class="kskel" style="height:9px;width:65%;margin:0 auto 6px"></div>
          <div class="kskel" style="height:8px;width:80%;margin:0 auto 3px"></div>
          <div class="kskel" style="height:8px;width:55%;margin:0 auto"></div>
        </div>
      `).join('');
    }

    const row = (delay) => `
      <div class="kskel-row" style="animation-delay:${delay}s">

        <!-- Jersey -->
        <div class="kskel" style="width:28px;height:34px;border-radius:4px;flex-shrink:0"></div>

        <!-- Name + meta -->
        <div style="flex:1;min-width:0">
          <div class="kskel" style="height:12px;width:55%;margin-bottom:6px"></div>
          <div style="display:flex;gap:5px;align-items:center">
            <div class="kskel" style="height:9px;width:28px;border-radius:3px"></div>
            <div class="kskel" style="height:9px;width:40px"></div>
            <div class="kskel" style="height:9px;width:30px"></div>
          </div>
        </div>

        <!-- Progress column -->
        <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex-shrink:0;width:52px">
          <div class="kskel" style="height:13px;width:36px;border-radius:4px"></div>
          <div class="kskel" style="height:4px;width:52px;border-radius:100px"></div>
          <div class="kskel" style="height:8px;width:42px;border-radius:3px"></div>
        </div>

        <!-- Net -->
        <div class="kskel" style="width:32px;height:13px;border-radius:4px;flex-shrink:0"></div>

        <!-- Prob -->
        <div class="kskel" style="width:36px;height:14px;border-radius:4px;flex-shrink:0"></div>

        <!-- Pred badge -->
        <div class="kskel" style="width:44px;height:20px;border-radius:5px;flex-shrink:0"></div>

        <!-- Star -->
        <div class="kskel" style="width:18px;height:18px;border-radius:50%;flex-shrink:0"></div>

      </div>`;

    container.innerHTML = [0,0.04,0.08,0.12,0.16,0.2,0.24,0.28,0.32,0.36,0.4,0.44]
      .map(d => row(d)).join('');
  }

  /* ══════════════════════════════════════════════════════════
     GAMES PAGE
     Matches .match-card layout:
     • GW header strip
     • 5 × match cards (timebar · two shirts + score · events strip)
     ══════════════════════════════════════════════════════════ */
  function gamesShimmer(container) {
    _injectStyles();
    if (typeof container === 'string') container = document.getElementById(container);
    if (!container) return;

    const matchCard = (delay) => `
      <div class="kskel-match" style="animation-delay:${delay}s">

        <!-- Timebar -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 14px;background:var(--surface-3,#21262f);border-bottom:1px solid var(--border,rgba(255,255,255,0.06))">
          <div class="kskel" style="height:10px;width:90px;border-radius:4px"></div>
          <div style="display:flex;gap:6px;align-items:center">
            <div class="kskel" style="height:22px;width:42px;border-radius:6px"></div>
            <div class="kskel" style="height:9px;width:24px;border-radius:3px"></div>
            <div class="kskel" style="height:22px;width:42px;border-radius:6px"></div>
          </div>
        </div>

        <!-- Main: shirt · vs · shirt -->
        <div style="display:flex;align-items:center;justify-content:space-around;padding:18px 10px;gap:8px">

          <!-- Home team -->
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:7px">
            <div class="kskel" style="width:44px;height:52px;border-radius:6px"></div>
            <div class="kskel" style="height:12px;width:50px;border-radius:4px"></div>
            <div class="kskel" style="height:9px;width:32px;border-radius:3px"></div>
          </div>

          <!-- Score / vs -->
          <div style="flex:0 0 90px;display:flex;flex-direction:column;align-items:center;gap:8px">
            <div class="kskel" style="height:22px;width:64px;border-radius:20px"></div>
            <div class="kskel" style="height:28px;width:72px;border-radius:6px"></div>
          </div>

          <!-- Away team -->
          <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:7px">
            <div class="kskel" style="width:44px;height:52px;border-radius:6px"></div>
            <div class="kskel" style="height:12px;width:50px;border-radius:4px"></div>
            <div class="kskel" style="height:9px;width:32px;border-radius:3px"></div>
          </div>

        </div>

        <!-- Expand button strip -->
        <div style="display:flex;align-items:center;justify-content:space-between;padding:11px 14px;border-top:1px solid var(--border,rgba(255,255,255,0.06))">
          <div class="kskel" style="height:10px;width:120px;border-radius:4px"></div>
          <div class="kskel" style="height:10px;width:10px;border-radius:50%"></div>
        </div>

      </div>`;

    container.innerHTML = [0,0.06,0.12,0.18,0.24]
      .map(d => matchCard(d)).join('');
  }

  /* ── Expose globally ─────────────────────────────────────── */
  window.KflShimmer = { leagues: leaguesShimmer, prices: pricesShimmer, games: gamesShimmer };

})();
