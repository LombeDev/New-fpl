/**
 * live-widget.js — Kopala FPL
 * ─────────────────────────────────────────────────────────────
 * Floating live score pill + expanded panel, LiveFPL style.
 *
 * ONLY appears when at least one fixture in the current GW
 * is actively in progress (started + not finished).
 * Hides automatically when the last game goes to FT.
 *
 * Expanded panel shows:
 *  • Summary strip  — live pts / rank change / players to play
 *  • Live Fixtures  — kit colours, score, minute, goal/card/bonus events,
 *                     your FPL players in that game + their live points
 *  • My Squad grid  — shirt emoji + name + coloured points badge per player
 *
 * Refreshes every 60s. Pauses when tab hidden.
 * Haptic via window.Haptic (haptic.js) — degrades gracefully.
 *
 * Usage: <script src="haptic.js"></script>
 *        <script src="live-widget.js"></script>
 */

(function () {
  'use strict';

  /* ── Config ── */
  const PROXY      = '/.netlify/functions/fpl-proxy?endpoint=';
  const STORAGE_ID = 'kopala_id';
  const REFRESH_MS = 60_000;
  const NAV_H      = 62;   // match your bottom nav height

  /* ── State ── */
  let _timer      = null;
  let _isExpanded = false;
  let _lastPts    = null;
  let _rendered   = false;

  /* ── Haptic shim ── */
  const H = {
    tap:    () => window.Haptic?.tap(),
    score:  () => window.Haptic?.score(),
    expand: () => window.Haptic?.expand(),
    close:  () => window.Haptic?.dismiss(),
  };


  const TEAM_SHORT = {
    1:'ARS',2:'AVL',3:'BRE',4:'BHA',5:'CHE',6:'CRY',7:'EVE',8:'FUL',
    9:'IPS',10:'LEI',11:'LIV',12:'MCI',13:'MUN',14:'NEW',15:'NFO',
    16:'SOU',17:'TOT',18:'WHU',19:'WOL',20:'BOU',
  };

  /* ── Inject styles ── */
  (function injectCSS() {
    const s = document.createElement('style');
    s.textContent = `
      :root {
        --kfl-lw-g:    var(--kfl-green, #00e868);
        --kfl-lw-gd:   var(--kfl-green-dim, rgba(0,232,104,.12));
        --kfl-lw-r:    #ef4444;
        --kfl-lw-a:    #f59e0b;
        --kfl-lw-s:    var(--kfl-surface, #0f1923);
        --kfl-lw-s2:   var(--kfl-surface-2, #162030);
        --kfl-lw-s3:   var(--kfl-surface-3, #1e2d40);
        --kfl-lw-bdr:  var(--kfl-border, rgba(255,255,255,.07));
        --kfl-lw-t1:   var(--kfl-text-1, #eef2ff);
        --kfl-lw-t2:   var(--kfl-text-2, #7a90b0);
        --kfl-lw-t3:   var(--kfl-text-3, #3a5070);
      }

      /* ─── PILL ─── */
      #kfl-lw-pill {
        position: fixed;
        bottom: ${NAV_H + 10}px;
        left: 50%;
        transform: translateX(-50%) translateY(0) scale(1);
        z-index: 960;
        display: flex;
        align-items: center;
        gap: 8px;
        height: 38px;
        padding: 0 14px 0 11px;
        border-radius: 100px;
        background: var(--kfl-lw-s2);
        border: 1px solid var(--kfl-lw-bdr);
        box-shadow: 0 4px 24px rgba(0,0,0,.5), 0 0 0 1px rgba(255,255,255,.03);
        cursor: pointer;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        transition: transform .32s cubic-bezier(.34,1.3,.64,1),
                    opacity .25s ease,
                    box-shadow .2s ease;
        will-change: transform, opacity;
      }
      #kfl-lw-pill.hidden {
        transform: translateX(-50%) translateY(140%);
        opacity: 0;
        pointer-events: none;
      }
      #kfl-lw-pill:active {
        transform: translateX(-50%) scale(.95);
        box-shadow: 0 2px 10px rgba(0,0,0,.35);
      }

      .kfl-lw-dot {
        width: 7px; height: 7px;
        border-radius: 50%;
        background: var(--kfl-lw-g);
        box-shadow: 0 0 7px var(--kfl-lw-g);
        flex-shrink: 0;
        animation: kflLwPulse 2s ease-in-out infinite;
      }
      @keyframes kflLwPulse {
        0%,100% { opacity:1; transform:scale(1); }
        50%      { opacity:.5; transform:scale(.7); }
      }
      #kfl-lw-pill.loading .kfl-lw-dot {
        background: var(--kfl-lw-t3);
        box-shadow: none; animation: none;
      }

      #kfl-lw-score {
        font-family: 'Barlow Condensed', sans-serif;
        font-size: 1.05rem; font-weight: 900;
        color: var(--kfl-lw-t1); letter-spacing: -.5px; line-height: 1;
        min-width: 22px; text-align: center;
        transition: color .25s ease;
      }
      #kfl-lw-score.flash {
        animation: kflLwFlash .5s ease;
      }
      @keyframes kflLwFlash {
        0%   { color: var(--kfl-lw-g); transform: scale(1.15); }
        100% { color: var(--kfl-lw-t1); transform: scale(1); }
      }

      .kfl-lw-sep {
        width: 1px; height: 16px;
        background: rgba(255,255,255,.1); flex-shrink: 0;
      }

      #kfl-lw-arrow {
        font-family: 'DM Sans', sans-serif;
        font-size: .62rem; font-weight: 700;
        display: flex; align-items: center; gap: 2px;
        white-space: nowrap;
      }
      #kfl-lw-arrow.up   { color: var(--kfl-lw-g); }
      #kfl-lw-arrow.down { color: var(--kfl-lw-r); }
      #kfl-lw-arrow.same { color: var(--kfl-lw-t3); }

      #kfl-lw-ttp {
        font-family: 'DM Sans', sans-serif;
        font-size: .58rem; font-weight: 600;
        color: var(--kfl-lw-t2); white-space: nowrap;
      }
      #kfl-lw-ttp strong { color: var(--kfl-lw-t1); font-weight: 700; }

      .kfl-lw-chev {
        font-size: .5rem; color: var(--kfl-lw-t3);
        transition: transform .2s ease;
      }
      #kfl-lw-pill.expanded .kfl-lw-chev { transform: rotate(180deg); }

      /* ─── BACKDROP ─── */
      #kfl-lw-backdrop {
        position: fixed; inset: 0;
        z-index: 958; display: none;
      }
      #kfl-lw-backdrop.open { display: block; }

      /* ─── PANEL ─── */
      #kfl-lw-panel {
        position: fixed;
        bottom: ${NAV_H + 56}px;
        left: 50%;
        transform: translateX(-50%) translateY(12px) scale(.96);
        z-index: 959;
        width: calc(100vw - 20px);
        max-width: 420px;
        max-height: 78vh;
        overflow-y: auto;
        scrollbar-width: none;
        border-radius: 18px;
        background: var(--kfl-lw-s);
        border: 1px solid var(--kfl-lw-bdr);
        box-shadow: 0 20px 64px rgba(0,0,0,.7);
        opacity: 0;
        pointer-events: none;
        transition: opacity .22s ease, transform .28s cubic-bezier(.34,1.2,.64,1);
        will-change: transform, opacity;
      }
      #kfl-lw-panel::-webkit-scrollbar { display: none; }
      #kfl-lw-panel.open {
        opacity: 1;
        pointer-events: auto;
        transform: translateX(-50%) translateY(0) scale(1);
      }

      /* panel header */
      .kfl-lw-ph {
        display: flex; align-items: center; justify-content: space-between;
        padding: 11px 14px 9px;
        border-bottom: 1px solid var(--kfl-lw-bdr);
        background: var(--kfl-lw-s2);
        border-radius: 18px 18px 0 0;
        position: sticky; top: 0; z-index: 2;
      }
      .kfl-lw-ph-left { display: flex; align-items: center; gap: 7px; }
      .kfl-lw-live-lbl {
        font-family: 'Barlow Condensed', sans-serif;
        font-size: .58rem; font-weight: 800;
        letter-spacing: 2px; text-transform: uppercase;
        color: var(--kfl-lw-g);
      }
      .kfl-lw-ph-pts {
        font-family: 'Barlow Condensed', sans-serif;
        font-size: 1.4rem; font-weight: 900;
        color: var(--kfl-lw-t1); letter-spacing: -.5px; line-height: 1;
      }
      .kfl-lw-ph-pts span {
        font-size: .68rem; font-weight: 600;
        color: var(--kfl-lw-t2); margin-left: 2px;
      }
      .kfl-lw-ph-close {
        width: 24px; height: 24px; border-radius: 50%;
        background: rgba(255,255,255,.06);
        border: 1px solid var(--kfl-lw-bdr);
        color: var(--kfl-lw-t3);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; font-size: .58rem;
        transition: background .15s, color .15s;
      }
      .kfl-lw-ph-close:hover { background: rgba(255,255,255,.12); color: var(--kfl-lw-t1); }

      /* summary strip */
      .kfl-lw-summ {
        display: grid; grid-template-columns: repeat(3,1fr);
        border-bottom: 1px solid var(--kfl-lw-bdr);
      }
      .kfl-lw-si { padding: 7px 10px; text-align: center; }
      .kfl-lw-si + .kfl-lw-si { border-left: 1px solid var(--kfl-lw-bdr); }
      .kfl-lw-sl {
        font-family: 'DM Sans', sans-serif;
        font-size: .44rem; font-weight: 700;
        letter-spacing: 1.1px; text-transform: uppercase;
        color: var(--kfl-lw-t3); margin-bottom: 3px;
      }
      .kfl-lw-sv {
        font-family: 'Barlow Condensed', sans-serif;
        font-size: .9rem; font-weight: 800;
        color: var(--kfl-lw-t1); line-height: 1;
      }
      .kfl-lw-sv.up   { color: var(--kfl-lw-g); }
      .kfl-lw-sv.down { color: var(--kfl-lw-r); }

      /* section label */
      .kfl-lw-sec {
        font-family: 'DM Sans', sans-serif;
        font-size: .44rem; font-weight: 800;
        letter-spacing: 1.5px; text-transform: uppercase;
        color: var(--kfl-lw-t3); padding: 8px 14px 4px;
      }

      /* ─── FIXTURE CARD ─── */
      .kfl-lw-fx {
        margin: 0 10px 8px;
        border-radius: 12px;
        background: var(--kfl-lw-s2);
        border: 1px solid var(--kfl-lw-bdr);
        overflow: hidden;
      }
      .kfl-lw-fx.is-live { border-color: rgba(0,232,104,.22); }

      .kfl-lw-fx-head {
        display: flex; align-items: center;
        padding: 9px 12px; gap: 4px;
      }
      .kfl-lw-fx-team {
        display: flex; flex-direction: column;
        align-items: center; gap: 3px;
        flex: 1; min-width: 0;
      }

      /* real kit image — fixture header */
      .kfl-lw-kit {
        width: 36px; height: 36px;
        flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
      }
      .kfl-lw-kit-real {
        width: 36px; height: 36px;
        object-fit: contain;
        display: block;
        filter: drop-shadow(0 2px 5px rgba(0,0,0,0.35));
      }
      .kfl-lw-kit-fb {
        display: flex; align-items: center; justify-content: center;
        color: var(--kfl-lw-t3); font-size: 1.2rem;
      }

      .kfl-lw-tname {
        font-family: 'Barlow Condensed', sans-serif;
        font-size: .72rem; font-weight: 800;
        color: var(--kfl-lw-t1); text-align: center;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        width: 100%;
      }
      .kfl-lw-teo {
        font-family: 'DM Sans', sans-serif;
        font-size: .42rem; font-weight: 600;
        color: var(--kfl-lw-t3); text-align: center;
      }

      .kfl-lw-fx-score {
        display: flex; flex-direction: column;
        align-items: center; gap: 3px; flex-shrink: 0;
        padding: 0 6px;
      }
      .kfl-lw-snum {
        font-family: 'Barlow Condensed', sans-serif;
        font-size: 1.7rem; font-weight: 900;
        color: var(--kfl-lw-t1); letter-spacing: -2px; line-height: 1;
      }
      .kfl-lw-fstat {
        font-family: 'DM Sans', sans-serif;
        font-size: .44rem; font-weight: 800;
        letter-spacing: 1px; text-transform: uppercase;
        padding: 1px 7px; border-radius: 100px;
      }
      .kfl-lw-fstat.live { background: rgba(0,232,104,.12); color: var(--kfl-lw-g); }
      .kfl-lw-fstat.ft   { background: rgba(255,255,255,.06); color: var(--kfl-lw-t3); }
      .kfl-lw-fstat.ns   { background: rgba(255,255,255,.04); color: var(--kfl-lw-t3); }

      /* events */
      .kfl-lw-evts {
        padding: 0 12px 7px;
        display: flex; flex-wrap: wrap; gap: 3px;
      }
      .kfl-lw-ec {
        font-family: 'DM Sans', sans-serif;
        font-size: .46rem; font-weight: 700;
        padding: 2px 7px; border-radius: 100px;
        background: rgba(255,255,255,.05); color: var(--kfl-lw-t2);
        display: flex; align-items: center; gap: 2px;
      }
      .kfl-lw-ec.goal  { background: rgba(0,232,104,.1);   color: var(--kfl-lw-g); }
      .kfl-lw-ec.ast   { background: rgba(99,179,237,.1);  color: #63b3ed; }
      .kfl-lw-ec.card  { background: rgba(239,68,68,.1);   color: var(--kfl-lw-r); }
      .kfl-lw-ec.bon   { background: rgba(245,158,11,.1);  color: var(--kfl-lw-a); }
      .kfl-lw-ec.owngl { background: rgba(239,68,68,.08);  color: #f87171; }

      /* my players chips in fixture */
      .kfl-lw-fxp {
        padding: 0 10px 9px;
        display: flex; gap: 5px; overflow-x: auto;
        scrollbar-width: none;
      }
      .kfl-lw-fxp::-webkit-scrollbar { display: none; }
      .kfl-lw-mpc {
        display: flex; align-items: center; gap: 4px;
        padding: 4px 9px 4px 6px;
        border-radius: 8px;
        background: var(--kfl-lw-s3);
        border: 1px solid var(--kfl-lw-bdr);
        flex-shrink: 0;
      }
      .kfl-lw-mpc.cap { border-color: rgba(245,158,11,.3); background: rgba(245,158,11,.07); }
      .kfl-lw-mpp {
        width: 16px; height: 16px; border-radius: 3px;
        display: flex; align-items: center; justify-content: center;
        font-family: 'Barlow Condensed', sans-serif;
        font-size: .44rem; font-weight: 800; flex-shrink: 0;
      }
      .kfl-lw-mpp.g { background: rgba(234,179,8,.18);  color: #fde047; }
      .kfl-lw-mpp.d { background: rgba(59,130,246,.18); color: #60a5fa; }
      .kfl-lw-mpp.m { background: rgba(34,197,94,.18);  color: #4ade80; }
      .kfl-lw-mpp.f { background: rgba(239,68,68,.18);  color: #f87171; }
      .kfl-lw-mpn {
        font-family: 'Barlow Condensed', sans-serif;
        font-size: .76rem; font-weight: 700;
        color: var(--kfl-lw-t1); white-space: nowrap; line-height: 1;
      }
      .kfl-lw-mppts {
        font-family: 'Barlow Condensed', sans-serif;
        font-size: .78rem; font-weight: 900;
        color: var(--kfl-lw-g); margin-left: 2px; line-height: 1;
      }
      .kfl-lw-mppts.cap { color: var(--kfl-lw-a); }
      .kfl-lw-cb {
        width: 13px; height: 13px; border-radius: 50%;
        background: var(--kfl-lw-a); color: #1a0a00;
        font-family: 'Barlow Condensed', sans-serif;
        font-size: .44rem; font-weight: 900;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }

      /* ─── SQUAD GRID ─── */
      .kfl-lw-sgrid {
        display: grid;
        grid-template-columns: repeat(5, 1fr);
        gap: 4px;
        padding: 4px 10px;
      }
      .kfl-lw-sgrid.r4 { grid-template-columns: repeat(4,1fr); }
      .kfl-lw-sgrid.r2 {
        grid-template-columns: repeat(2,1fr);
        max-width: 136px; margin: 0 auto;
      }

      .kfl-lw-pc {
        display: flex; flex-direction: column;
        align-items: center; gap: 2px;
        padding: 5px 3px;
        border-radius: 9px;
        background: var(--kfl-lw-s2);
        border: 1px solid var(--kfl-lw-bdr);
        position: relative; overflow: hidden;
        transition: border-color .15s;
      }
      .kfl-lw-pc.on  { border-color: rgba(0,232,104,.28); }
      .kfl-lw-pc.cap { border-color: rgba(245,158,11,.32); }
      .kfl-lw-pc.bch { opacity: .42; }

      /* real kit image — squad player card */
      .kfl-lw-pc-kit {
        width: 28px; height: 28px;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
      }
      .kfl-lw-pc-kit .kfl-lw-kit-real {
        width: 28px; height: 28px;
        filter: drop-shadow(0 1px 3px rgba(0,0,0,0.3));
      }
      .kfl-lw-pc-kit .kfl-lw-kit-fb {
        width: 28px; height: 28px; font-size: .9rem;
      }

      .kfl-lw-pcn {
        font-family: 'Barlow Condensed', sans-serif;
        font-size: .58rem; font-weight: 700;
        color: var(--kfl-lw-t1); text-align: center;
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        width: 100%; padding: 0 2px; line-height: 1;
      }
      .kfl-lw-pb {
        padding: 1px 5px; border-radius: 100px;
        font-family: 'Barlow Condensed', sans-serif;
        font-size: .57rem; font-weight: 800; line-height: 1.4;
        min-width: 22px; text-align: center;
      }
      .kfl-lw-pb.played  { background: var(--kfl-lw-gd);          color: var(--kfl-lw-g); }
      .kfl-lw-pb.playing { background: rgba(0,232,104,.22);        color: var(--kfl-lw-g);
                            animation: kflLwGlow 1.5s ease-in-out infinite; }
      .kfl-lw-pb.tbp     { background: rgba(255,255,255,.05);      color: var(--kfl-lw-t3); }
      .kfl-lw-pb.captbp  { background: rgba(245,158,11,.12);       color: var(--kfl-lw-a); }
      .kfl-lw-pb.captpl  { background: rgba(245,158,11,.22);       color: var(--kfl-lw-a);
                            animation: kflLwGlow 1.5s ease-in-out infinite; }
      .kfl-lw-pb.captd   { background: rgba(245,158,11,.14);       color: var(--kfl-lw-a); }
      @keyframes kflLwGlow {
        0%,100% { box-shadow: none; }
        50%     { box-shadow: 0 0 6px var(--kfl-lw-g); }
      }

      .kfl-lw-cbdg {
        position: absolute; top: 2px; right: 2px;
        width: 12px; height: 12px; border-radius: 50%;
        background: var(--kfl-lw-a); color: #1a0a00;
        font-family: 'Barlow Condensed', sans-serif;
        font-size: .42rem; font-weight: 900;
        display: flex; align-items: center; justify-content: center;
      }

      /* bench divider label */
      .kfl-lw-blbl {
        font-family: 'DM Sans', sans-serif;
        font-size: .42rem; font-weight: 800;
        letter-spacing: 1.3px; text-transform: uppercase;
        color: var(--kfl-lw-t3);
        padding: 6px 14px 2px;
        border-top: 1px solid var(--kfl-lw-bdr);
        margin-top: 2px;
      }

      /* refresh bar */
      .kfl-lw-rbar { height: 2px; background: rgba(255,255,255,.04); margin-top: 6px; }
      .kfl-lw-rfill {
        height: 100%; width: 0;
        background: var(--kfl-lw-g); opacity: .4;
        border-radius: 0 100px 100px 0;
      }

      /* ─── Light theme overrides ─── */
      [data-theme="light"] #kfl-lw-pill {
        background: #fff;
        border-color: rgba(0,0,0,.08);
        box-shadow: 0 4px 20px rgba(0,0,0,.12);
      }
      [data-theme="light"] #kfl-lw-score       { color: #0a0e1a; }
      [data-theme="light"] .kfl-lw-sep         { background: rgba(0,0,0,.1); }
      [data-theme="light"] #kfl-lw-ttp         { color: rgba(0,0,0,.45); }
      [data-theme="light"] #kfl-lw-ttp strong  { color: #0a0e1a; }
      [data-theme="light"] #kfl-lw-panel       { background: #f4f7fb; border-color: rgba(0,0,0,.07); }
      [data-theme="light"] .kfl-lw-ph          { background: #fff; border-bottom-color: rgba(0,0,0,.06); }
      [data-theme="light"] .kfl-lw-ph-pts      { color: #0a0e1a; }
      [data-theme="light"] .kfl-lw-ph-close    { background: rgba(0,0,0,.05); border-color: rgba(0,0,0,.07); }
      [data-theme="light"] .kfl-lw-summ        { border-bottom-color: rgba(0,0,0,.06); }
      [data-theme="light"] .kfl-lw-si + .kfl-lw-si { border-left-color: rgba(0,0,0,.06); }
      [data-theme="light"] .kfl-lw-sv          { color: #0a0e1a; }
      [data-theme="light"] .kfl-lw-fx          { background: #fff; border-color: rgba(0,0,0,.07); }
      [data-theme="light"] .kfl-lw-tname       { color: #0a0e1a; }
      [data-theme="light"] .kfl-lw-snum        { color: #0a0e1a; }
      [data-theme="light"] .kfl-lw-pc          { background: #fff; border-color: rgba(0,0,0,.07); }
      [data-theme="light"] .kfl-lw-pcn         { color: #0a0e1a; }
      [data-theme="light"] .kfl-lw-mpc         { background: rgba(0,0,0,.04); border-color: rgba(0,0,0,.07); }
      [data-theme="light"] .kfl-lw-mpn         { color: #0a0e1a; }
      [data-theme="light"] .kfl-lw-blbl        { border-top-color: rgba(0,0,0,.06); }
    `;
    document.head.appendChild(s);
  })();

  /* ── Real FPL kit image ── */
  const KIT_BASE = 'https://fantasy.premierleague.com/dist/img/shirts/standard/shirt_';

  function kitImg(teamCode, size) {
    size = size || 34;
    if (!teamCode) {
      return `<span class="kfl-lw-kit-fb" style="width:${size}px;height:${size}px"><i class="fa-solid fa-shirt"></i></span>`;
    }
    return `<img
      src="${KIT_BASE}${teamCode}-66.png"
      class="kfl-lw-kit-real"
      width="${size}" height="${size}"
      onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"
      alt="" loading="lazy"
    ><span class="kfl-lw-kit-fb" style="display:none;width:${size}px;height:${size}px"><i class="fa-solid fa-shirt"></i></span>`;
  }

  /* ── Stat helpers ── */
  function fmtRank(n) {
    if (!n) return '—';
    return n >= 1_000_000 ? (n / 1_000_000).toFixed(1) + 'M'
         : n >= 1_000     ? Math.round(n / 1_000) + 'k'
         : String(n);
  }

  function posClass(type) { return ['g','d','m','f'][type - 1] || 'm'; }
  function posLabel(type) { return ['GKP','DEF','MID','FWD'][type - 1] || '?'; }

  /* ── Build fixture event chips ── */
  function buildEvents(fixture, playerMap) {
    if (!fixture.stats) return '';
    const chips = [];

    const goals = fixture.stats.find(s => s.identifier === 'goals_scored');
    const assists = fixture.stats.find(s => s.identifier === 'assists');
    const ownGoals = fixture.stats.find(s => s.identifier === 'own_goals');
    const redCards = fixture.stats.find(s => s.identifier === 'red_cards');
    const bonus = fixture.stats.find(s => s.identifier === 'bonus');

    const addChips = (stat, cls, icon) => {
      if (!stat) return;
      [...(stat.h || []), ...(stat.a || [])].forEach(e => {
        const name = playerMap[e.element]?.web_name || '?';
        chips.push(`<span class="kfl-lw-ec ${cls}">${icon} ${name}</span>`);
      });
    };

    addChips(goals,    'goal',  '⚽');
    addChips(assists,  'ast',   '🅰️');
    addChips(ownGoals, 'owngl', '😬');
    addChips(redCards, 'card',  '🟥');

    // Bonus chips — max top 3
    if (bonus) {
      const all = [...(bonus.h || []), ...(bonus.a || [])]
        .sort((a, b) => b.value - a.value).slice(0, 3);
      if (all.length) {
        const bonusText = all.map(e => `${playerMap[e.element]?.web_name || '?'} ${e.value}`).join(' · ');
        chips.push(`<span class="kfl-lw-ec bon">★ ${bonusText}</span>`);
      }
    }

    return chips.join('');
  }

  /* ── Build "my players in fixture" chips ── */
  function buildMyPlayersInFixture(fixture, myPicksMap, playerMap, liveMap) {
    const fxTeams = new Set([fixture.team_h, fixture.team_a]);
    const chips = [];

    myPicksMap.forEach((pick, elementId) => {
      const player = playerMap[elementId];
      if (!player || !fxTeams.has(player.team)) return;
      if (pick.position > 11) return; // bench only if needed

      const rawPts = liveMap[elementId] ?? 0;
      const pts    = pick.multiplier > 1 ? rawPts * 2 : rawPts;
      const isCap  = pick.is_captain;
      const pos    = posClass(player.element_type);

      chips.push(`
        <div class="kfl-lw-mpc${isCap ? ' cap' : ''}">
          <div class="kfl-lw-mpp ${pos}">${posLabel(player.element_type)}</div>
          <span class="kfl-lw-mpn">${player.web_name}</span>
          <span class="kfl-lw-mppts${isCap ? ' cap' : ''}">${pts}</span>
          ${isCap ? '<div class="kfl-lw-cb">C</div>' : ''}
        </div>
      `);
    });

    return chips.join('');
  }

  /* ── Build fixture card HTML ── */
  function buildFixtureCard(fixture, playerMap, myPicksMap, liveMap, teamMap) {
    const isLive = fixture.started && !fixture.finished_provisional;
    const isFT   = fixture.finished_provisional;
    const hTeam  = teamMap[fixture.team_h];
    const aTeam  = teamMap[fixture.team_a];

    // Use real FPL team code for kit URL (bootstrap.teams[].code)
    const hCode = hTeam?.code ?? null;
    const aCode = aTeam?.code ?? null;

    const statusClass = isLive ? 'live' : isFT ? 'ft' : 'ns';
    const statusText  = isLive ? (fixture.minutes + "'")
                      : isFT   ? 'FT'
                      :          'NS';

    const hScore = fixture.team_h_score ?? 0;
    const aScore = fixture.team_a_score ?? 0;

    const hEO = hTeam?.top10k_eo ? `Top10k EO: ${hTeam.top10k_eo}%` : '';
    const aEO = aTeam?.top10k_eo ? `Top10k EO: ${aTeam.top10k_eo}%` : '';

    const eventsHTML    = buildEvents(fixture, playerMap);
    const myPlayersHTML = buildMyPlayersInFixture(fixture, myPicksMap, playerMap, liveMap);

    return `
      <div class="kfl-lw-fx${isLive ? ' is-live' : ''}">
        <div class="kfl-lw-fx-head">
          <div class="kfl-lw-fx-team">
            <div class="kfl-lw-kit">${kitImg(hCode, 36)}</div>
            <div class="kfl-lw-tname">${hTeam?.short_name || TEAM_SHORT[fixture.team_h] || '?'}</div>
            ${hEO ? `<div class="kfl-lw-teo">${hEO}</div>` : ''}
          </div>
          <div class="kfl-lw-fx-score">
            <div class="kfl-lw-snum">${hScore}&thinsp;:&thinsp;${aScore}</div>
            <div class="kfl-lw-fstat ${statusClass}">${statusText}</div>
          </div>
          <div class="kfl-lw-fx-team">
            <div class="kfl-lw-kit">${kitImg(aCode, 36)}</div>
            <div class="kfl-lw-tname">${aTeam?.short_name || TEAM_SHORT[fixture.team_a] || '?'}</div>
            ${aEO ? `<div class="kfl-lw-teo">${aEO}</div>` : ''}
          </div>
        </div>
        ${eventsHTML ? `<div class="kfl-lw-evts">${eventsHTML}</div>` : ''}
        ${myPlayersHTML ? `<div class="kfl-lw-fxp">${myPlayersHTML}</div>` : ''}
      </div>
    `;
  }

  /* ── Build squad grid ── */
  function buildSquadGrid(picks, playerMap, liveMap, playingSet, teamMap) {
    const GKP = picks.filter(p => playerMap[p.element]?.element_type === 1);
    const DEF = picks.filter(p => playerMap[p.element]?.element_type === 2 && p.position <= 11);
    const MID = picks.filter(p => playerMap[p.element]?.element_type === 3 && p.position <= 11);
    const FWD = picks.filter(p => playerMap[p.element]?.element_type === 4 && p.position <= 11);
    const BCH = picks.filter(p => p.position > 11);

    function playerCard(pick, isBench = false) {
      const player = playerMap[pick.element];
      if (!player) return '';
      const rawPts    = liveMap[pick.element] ?? 0;
      const pts       = pick.multiplier > 1 ? rawPts * 2 : rawPts;
      const isPlaying = playingSet.has(pick.element);
      const hasPlayed = (liveMap[pick.element] !== undefined) && !playingSet.has(pick.element);
      const isCap     = pick.is_captain;
      // Use real FPL team code from teamMap for kit URL
      const teamCode  = teamMap[player.team]?.code ?? null;

      let pbClass;
      if (isCap) {
        pbClass = isPlaying ? 'captpl' : hasPlayed ? 'captd' : 'captbp';
      } else {
        pbClass = isPlaying ? 'playing' : hasPlayed ? 'played' : 'tbp';
      }

      const ptsLabel  = (pbClass === 'tbp' || pbClass === 'captbp') ? '—' : String(pts);
      const cardClass = `kfl-lw-pc${isPlaying ? ' on' : ''}${isCap ? ' cap' : ''}${isBench ? ' bch' : ''}`;

      return `
        <div class="${cardClass}">
          <div class="kfl-lw-pc-kit">${kitImg(teamCode, 28)}</div>
          <div class="kfl-lw-pcn">${player.web_name}</div>
          <div class="kfl-lw-pb ${pbClass}">${ptsLabel}</div>
          ${isCap ? '<div class="kfl-lw-cbdg">C</div>' : ''}
        </div>
      `;
    }

    const gkpOnly = GKP.filter(p => p.position <= 11);

    return `
      <div class="kfl-lw-sgrid r2">${gkpOnly.map(p => playerCard(p)).join('')}</div>
      <div class="kfl-lw-sgrid">${DEF.map(p => playerCard(p)).join('')}</div>
      <div class="kfl-lw-sgrid">${MID.map(p => playerCard(p)).join('')}</div>
      <div class="kfl-lw-sgrid r4">${FWD.map(p => playerCard(p)).join('')}</div>
      <div class="kfl-lw-blbl">Bench</div>
      <div class="kfl-lw-sgrid r4" style="padding-top:4px;padding-bottom:8px">${BCH.map(p => playerCard(p, true)).join('')}</div>
    `;
  }

  /* ── DOM elements ── */
  let pill, panel, backdrop;
  let scoreEl, arrowEl, ttpEl, fillEl;
  let _fillStart = null;

  function buildDOM() {
    backdrop = Object.assign(document.createElement('div'), { id: 'kfl-lw-backdrop' });
    backdrop.addEventListener('click', collapse);

    panel = Object.assign(document.createElement('div'), { id: 'kfl-lw-panel' });
    panel.innerHTML = `
      <div class="kfl-lw-ph">
        <div class="kfl-lw-ph-left">
          <span class="kfl-lw-dot"></span>
          <span class="kfl-lw-live-lbl" id="kfl-lw-gw-lbl">Live</span>
        </div>
        <div class="kfl-lw-ph-pts" id="kfl-lw-ph-pts">—<span>pts</span></div>
        <button class="kfl-lw-ph-close" id="kfl-lw-ph-close" aria-label="Close">
          <i class="fa-solid fa-xmark"></i>
        </button>
      </div>
      <div class="kfl-lw-summ">
        <div class="kfl-lw-si"><div class="kfl-lw-sl">Rank</div><div class="kfl-lw-sv" id="kfl-lw-s-rank">—</div></div>
        <div class="kfl-lw-si"><div class="kfl-lw-sl">Change</div><div class="kfl-lw-sv" id="kfl-lw-s-chg">—</div></div>
        <div class="kfl-lw-si"><div class="kfl-lw-sl">To Play</div><div class="kfl-lw-sv" id="kfl-lw-s-ttp">—</div></div>
      </div>
      <div id="kfl-lw-fx-area"></div>
      <div id="kfl-lw-squad-area"></div>
      <div class="kfl-lw-rbar"><div class="kfl-lw-rfill" id="kfl-lw-fill"></div></div>
    `;

    pill = Object.assign(document.createElement('div'), {
      id: 'kfl-lw-pill',
      className: 'hidden loading',
    });
    pill.setAttribute('role', 'button');
    pill.setAttribute('aria-label', 'Live gameweek score');
    pill.innerHTML = `
      <span class="kfl-lw-dot"></span>
      <span id="kfl-lw-score">—</span>
      <span class="kfl-lw-sep"></span>
      <span id="kfl-lw-arrow" class="same">—</span>
      <span class="kfl-lw-sep"></span>
      <span id="kfl-lw-ttp"><strong>?</strong> to play</span>
      <i class="fa-solid fa-chevron-up kfl-lw-chev"></i>
    `;

    document.body.append(backdrop, panel, pill);

    scoreEl = document.getElementById('kfl-lw-score');
    arrowEl = document.getElementById('kfl-lw-arrow');
    ttpEl   = document.getElementById('kfl-lw-ttp');
    fillEl  = document.getElementById('kfl-lw-fill');

    pill.addEventListener('click', () => {
      H.tap();
      toggleExpand();
    });
    document.getElementById('kfl-lw-ph-close').addEventListener('click', () => {
      H.close();
      collapse();
    });
  }

  /* ── Expand / Collapse ── */
  function toggleExpand() {
    _isExpanded ? collapse() : expand();
  }
  function expand() {
    H.expand();
    _isExpanded = true;
    panel.classList.add('open');
    backdrop.classList.add('open');
    pill.classList.add('expanded');
  }
  function collapse() {
    if (!_isExpanded) return;
    _isExpanded = false;
    panel.classList.remove('open');
    backdrop.classList.remove('open');
    pill.classList.remove('expanded');
  }

  /* ── Refresh countdown bar ── */
  function startFill() {
    if (!fillEl) return;
    fillEl.style.transition = 'none';
    fillEl.style.width = '0%';
    requestAnimationFrame(() => requestAnimationFrame(() => {
      fillEl.style.transition = `width ${REFRESH_MS}ms linear`;
      fillEl.style.width = '100%';
    }));
  }

  /* ── Main render ── */
  function renderPill(pts, rankDir, rankDiffAbs, ttpCount, prevPts) {
    scoreEl.textContent = pts;
    if (prevPts !== null && pts !== prevPts) {
      scoreEl.classList.remove('flash');
      void scoreEl.offsetWidth;
      scoreEl.classList.add('flash');
      H.score();
    }

    arrowEl.className = rankDir;
    if (rankDir === 'up')
      arrowEl.innerHTML = `<i class="fa-solid fa-arrow-up" style="font-size:.5rem"></i> ${fmtRank(rankDiffAbs)}`;
    else if (rankDir === 'down')
      arrowEl.innerHTML = `<i class="fa-solid fa-arrow-down" style="font-size:.5rem"></i> ${fmtRank(rankDiffAbs)}`;
    else
      arrowEl.innerHTML = `<i class="fa-solid fa-minus" style="font-size:.5rem"></i>`;

    ttpEl.innerHTML = `<strong>${ttpCount}</strong> to play`;

    pill.classList.remove('hidden', 'loading');
  }

  function renderPanel(data) {
    const { gwName, pts, overallRank, prevRank, ttpCount,
            fixtures, picks, playerMap, liveMap, playingSet, teamMap, myPicksMap } = data;

    document.getElementById('kfl-lw-gw-lbl').textContent = `Live · ${gwName}`;
    document.getElementById('kfl-lw-ph-pts').innerHTML = `${pts}<span>pts</span>`;

    const diff = prevRank && overallRank ? prevRank - overallRank : 0;
    const dir  = diff > 0 ? 'up' : diff < 0 ? 'down' : 'same';
    document.getElementById('kfl-lw-s-rank').textContent = fmtRank(overallRank);
    const chgEl = document.getElementById('kfl-lw-s-chg');
    chgEl.className = `kfl-lw-sv ${dir}`;
    chgEl.textContent = diff > 0 ? `↑ ${fmtRank(diff)}`
                      : diff < 0 ? `↓ ${fmtRank(Math.abs(diff))}` : '→';
    document.getElementById('kfl-lw-s-ttp').textContent = ttpCount;

    // Fixtures: only those that have started or are live
    const activeFx = fixtures.filter(f => f.started);
    const fxHTML = activeFx.length
      ? `<div class="kfl-lw-sec">Live Fixtures</div>`
        + activeFx.map(f => buildFixtureCard(f, playerMap, myPicksMap, liveMap, teamMap)).join('')
      : '';
    document.getElementById('kfl-lw-fx-area').innerHTML = fxHTML;

    // Squad
    document.getElementById('kfl-lw-squad-area').innerHTML =
      `<div class="kfl-lw-sec" style="padding-top:10px">My Squad</div>`
      + buildSquadGrid(picks, playerMap, liveMap, playingSet, teamMap);
  }

  /* ── Fetch & compute ── */
  async function refresh() {
    const teamId = localStorage.getItem(STORAGE_ID);
    if (!teamId) return;

    try {
      performance?.mark?.('kfl:lw-refresh-start');

      // Use IDB cache shared with all pages — avoids redundant bootstrap network fetch
      const bootstrap = window.KopalaIDB
        ? await KopalaIDB.getBootstrap(PROXY)
        : await fetch(PROXY + 'bootstrap-static/').then(r => r.json());

      // Find current event
      const currentEvent = bootstrap.events.find(e => e.is_current);
      if (!currentEvent) { hidePill(); return; }
      const gwId = currentEvent.id;
      _gwId = gwId;

      // Fixtures for current GW
      const gwFixtures = await fetch(PROXY + 'fixtures/?event=' + gwId).then(r => r.json());

      // ── KEY CONDITION: only show when at least one game is LIVE ──
      const hasLiveGame = gwFixtures.some(f => f.started && !f.finished_provisional);
      if (!hasLiveGame) { hidePill(); return; }

      // Fetch picks + live in parallel
      const [picksRes, liveRes] = await Promise.all([
        fetch(PROXY + `entry/${teamId}/event/${gwId}/picks/`),
        fetch(PROXY + `event/${gwId}/live/`),
      ]);
      const picksData = await picksRes.json();
      const liveData  = await liveRes.json();

      const picks   = picksData.picks   || [];
      const history = picksData.entry_history;
      if (!picks.length) return;

      // Build lookups
      const playerMap = {};
      bootstrap.elements.forEach(p => { playerMap[p.id] = p; });

      const teamMap = {};
      bootstrap.teams.forEach(t => { teamMap[t.id] = t; });

      const liveMap    = {};
      const playingSet = new Set();
      (liveData.elements || []).forEach(e => {
        liveMap[e.id] = e.stats?.total_points ?? 0;
        const mins = e.stats?.minutes ?? 0;
        if (mins > 0 && mins < 90) playingSet.add(e.id);
        const player = playerMap[e.id];
        if (player) {
          const inLiveFx = gwFixtures.some(f =>
            f.started && !f.finished_provisional &&
            (f.team_h === player.team || f.team_a === player.team)
          );
          if (inLiveFx) playingSet.add(e.id);
        }
      });

      // Build myPicksMap (element -> pick) for fixture overlay
      const myPicksMap = new Map();
      picks.forEach(p => myPicksMap.set(p.element, p));

      // Compute total live points (starting XI only)
      let totalPts = 0;
      let ttpCount = 0;
      picks.forEach((pick, i) => {
        if (i >= 11) return; // skip bench
        const rawPts = liveMap[pick.element] ?? 0;
        const pts    = pick.multiplier > 1 ? rawPts * 2 : rawPts;
        totalPts += pts;
        const player   = playerMap[pick.element];
        const inFuture = player && gwFixtures.some(f =>
          !f.started &&
          (f.team_h === player.team || f.team_a === player.team)
        );
        if (inFuture) ttpCount++;
      });

      const prevRank    = history?.rank_sort ?? null;
      const overallRank = history?.overall_rank ?? null;
      const rankDiffVal = prevRank && overallRank ? prevRank - overallRank : 0;
      const rankDir     = rankDiffVal > 0 ? 'up' : rankDiffVal < 0 ? 'down' : 'same';
      const prevPts     = _lastPts;
      _lastPts          = totalPts;

      renderPill(totalPts, rankDir, Math.abs(rankDiffVal), ttpCount, prevPts);

      // Store full data payload for panel render on expand
      window._kflLwData = {
        gwName: currentEvent.name,
        pts: totalPts,
        overallRank, prevRank,
        ttpCount,
        fixtures: gwFixtures,
        picks, playerMap, liveMap,
        playingSet, teamMap, myPicksMap,
      };

      if (_isExpanded) renderPanel(window._kflLwData);

      performance?.mark?.('kfl:lw-refresh-done');
      startFill();

    } catch (err) {
      console.warn('[KopalaLW] refresh error:', err.message);
    }
  }

  // GW ID cache — populated by first refresh
  let _gwId = null;

  function hidePill() {
    if (!pill) return;
    pill.classList.add('hidden');
    collapse();
  }

  /* ── Override expand to render panel on open ── */
  function expand() {
    H.expand();
    _isExpanded = true;
    panel.classList.add('open');
    backdrop.classList.add('open');
    pill.classList.add('expanded');
    if (window._kflLwData) renderPanel(window._kflLwData);
  }

  /* ── Boot ── */
  async function init() {
    const teamId = localStorage.getItem(STORAGE_ID);
    if (!teamId) return;

    buildDOM();
    await refresh();

    _timer = setInterval(refresh, REFRESH_MS);

    // Pause/resume on tab visibility — registered here so it only runs after init
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'hidden') {
        clearInterval(_timer);
        _timer = null;
      } else {
        _gwId = null; // allow GW to advance between tabs
        refresh();
        _timer = setInterval(refresh, REFRESH_MS);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.KopalaLiveWidget = { refresh, hide: hidePill, expand, collapse };

})();
