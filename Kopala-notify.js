/**
 * kopala-notify.js — Kopala FPL
 * ─────────────────────────────────────────────────────────────
 * Single unified module for ALL notifications + haptic feedback.
 * Replaces: haptic.js + deadline-notify.js (load only this file).
 *
 * Features:
 *   1. Haptic feedback — named vibration patterns, auto-wired to nav + [data-haptic]
 *   2. Deadline alerts — 24h / 1h system notifications + 15min in-app banner
 *   3. Price change digest — morning summary of rises/falls for YOUR squad players
 *   4. Goal alerts — live push notification when a team with your player scores
 *
 * Usage:
 *   <script src="kopala-notify.js"></script>
 *   (remove haptic.js and deadline-notify.js from your pages)
 *
 * Public API:
 *   Haptic.tap() / .success() / .warning() / .error() / .score() / .expand() / .dismiss()
 *   KopalaNotify.prompt()        — show permission card (for settings page)
 *   KopalaNotify.status()        — 'granted' | 'denied' | 'default' | 'unsupported'
 *   KopalaNotify.testDeadline()  — fire a test deadline notification now
 *   KopalaNotify.testPrice()     — fire a test price change notification now
 *   KopalaNotify.testGoal()      — fire a test goal notification now
 */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     1. HAPTIC FEEDBACK
  ═══════════════════════════════════════════════════════════ */

  var _vibSupported = 'vibrate' in navigator;

  var PATTERNS = {
    tap:     [8],
    success: [10, 60, 20],
    warning: [30, 80, 30],
    error:   [50, 40, 50, 40, 50],
    score:   [12, 50, 12],
    goal:    [40, 60, 40, 60, 80],   // strong double — goal scored
    price:   [15, 40, 15],           // soft double — price change
    expand:  [6],
    dismiss: [4],
  };

  function vibrate(pattern) {
    if (!_vibSupported) return;
    try { navigator.vibrate(pattern); } catch (_) {}
  }

  var Haptic = {
    tap:     function () { vibrate(PATTERNS.tap); },
    success: function () { vibrate(PATTERNS.success); },
    warning: function () { vibrate(PATTERNS.warning); },
    error:   function () { vibrate(PATTERNS.error); },
    score:   function () { vibrate(PATTERNS.score); },
    goal:    function () { vibrate(PATTERNS.goal); },
    price:   function () { vibrate(PATTERNS.price); },
    expand:  function () { vibrate(PATTERNS.expand); },
    dismiss: function () { vibrate(PATTERNS.dismiss); },
    custom:  function (p) { vibrate(p); },
  };

  /* Auto-wire nav + data-haptic elements */
  function wireHaptics() {
    document.querySelectorAll('.kfl-bottom-nav__item').forEach(function (el) {
      if (el.dataset.hapticWired) return;
      el.dataset.hapticWired = '1';
      el.addEventListener('touchstart', Haptic.tap, { passive: true });
    });
    document.querySelectorAll('[data-haptic]').forEach(function (el) {
      if (el.dataset.hapticWired) return;
      el.dataset.hapticWired = '1';
      var fn = Haptic[el.dataset.haptic] || Haptic.tap;
      el.addEventListener('touchstart', fn, { passive: true });
    });
  }

  new MutationObserver(wireHaptics).observe(document.documentElement, { childList: true, subtree: true });
  window.Haptic = Haptic;


  /* ═══════════════════════════════════════════════════════════
     2. SHARED UTILITIES
  ═══════════════════════════════════════════════════════════ */

  var PROXY      = '/.netlify/functions/fpl-proxy?endpoint=';
  var STORE_ID   = 'kopala_id';
  var PERM_KEY   = 'kfl_notify_perm_asked';

  /* LocalStorage helpers */
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }

  /* Fire a system notification via SW (preferred) or basic Notification API */
  function pushNotify(title, body, opts) {
    if (!window.Notification || Notification.permission !== 'granted') return;
    opts = opts || {};
    var payload = {
      body:     body,
      icon:     '/android-chrome-192x192.png',
      badge:    '/android-chrome-192x192.png',
      vibrate:  opts.vibrate  || [100, 50, 100],
      tag:      opts.tag      || 'kfl-notify',
      renotify: opts.renotify !== false,
      silent:   opts.silent   || false,
      data:     { url: opts.url || '/' },
      actions:  opts.actions  || [],
    };
    if (navigator.serviceWorker) {
      navigator.serviceWorker.ready
        .then(function (reg) { return reg.showNotification(title, payload); })
        .catch(function () { new Notification(title, payload); });
    } else {
      new Notification(title, payload);
    }
  }

  /* Format a date nicely */
  function fmtDate(ts) {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(ts));
  }

  /* Fetch bootstrap (uses SW cache automatically) */
  async function fetchBootstrap() {
    var res = await fetch(PROXY + 'bootstrap-static/');
    return res.json();
  }

  /* Inject shared CSS once */
  var _cssInjected = false;
  function injectCSS() {
    if (_cssInjected) return;
    _cssInjected = true;
    var s = document.createElement('style');
    s.textContent = [
      /* ── Permission prompt ── */
      '#kfl-np{position:fixed;bottom:calc(env(safe-area-inset-bottom,0px)+80px);',
      'left:12px;right:12px;z-index:9100;display:flex;justify-content:center;',
      'transform:translateY(130%);opacity:0;pointer-events:none;',
      'transition:transform .38s cubic-bezier(.34,1.3,.64,1),opacity .25s ease;}',
      '#kfl-np.kfl-v{transform:translateY(0);opacity:1;pointer-events:auto;}',

      '.kfl-np-wrap{width:100%;max-width:420px;background:var(--kfl-surface,#141e2d);',
      'border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:14px 16px;',
      'display:flex;align-items:flex-start;gap:12px;box-shadow:0 8px 40px rgba(0,0,0,.55);}',

      '.kfl-np-ico{width:40px;height:40px;flex-shrink:0;border-radius:11px;',
      'display:flex;align-items:center;justify-content:center;font-size:1rem;}',
      '.kfl-np-ico.deadline{background:rgba(245,158,11,.12);color:#f59e0b;}',
      '.kfl-np-ico.all{background:rgba(0,232,104,.1);color:#00e868;}',

      '.kfl-np-body{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;}',
      '.kfl-np-body b{font-family:"Barlow Condensed",sans-serif;font-size:.9rem;font-weight:800;',
      'color:var(--kfl-text-1,#eef2ff);}',
      '.kfl-np-body span{font-size:.7rem;color:var(--kfl-text-3,#4a5f7a);line-height:1.4;}',
      '.kfl-np-hl{font-size:.66rem!important;color:#f59e0b!important;font-weight:600;}',

      '.kfl-np-acts{display:flex;flex-direction:column;gap:5px;flex-shrink:0;}',
      '.kfl-np-btn{border:none;border-radius:8px;padding:7px 14px;font-size:.76rem;',
      'font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;transition:opacity .15s;}',
      '.kfl-np-yes{background:#f59e0b;color:#1a0a00;}.kfl-np-yes:hover{opacity:.88;}',
      '.kfl-np-no{background:rgba(255,255,255,.07);color:var(--kfl-text-3,#4a5f7a);',
      'border:1px solid rgba(255,255,255,.08);}.kfl-np-no:hover{background:rgba(255,255,255,.12);}',

      /* ── Light theme ── */
      '[data-theme="light"] .kfl-np-wrap{background:#fff;border-color:rgba(0,0,0,.08);',
      'box-shadow:0 8px 40px rgba(0,0,0,.14);}',
      '[data-theme="light"] .kfl-np-body b{color:#0a0e1a;}',
      '[data-theme="light"] .kfl-np-body span{color:#7a90b0;}',
      '[data-theme="light"] .kfl-np-no{background:rgba(0,0,0,.05);border-color:rgba(0,0,0,.08);color:#7a90b0;}',

      /* ── 15-min deadline banner ── */
      '#kfl-du{position:fixed;top:0;left:0;right:0;z-index:9500;',
      'background:linear-gradient(90deg,#dc2626,#ef4444);color:#fff;',
      'display:flex;align-items:center;gap:8px;padding:10px 14px;',
      'font-size:.8rem;font-weight:600;transform:translateY(-100%);',
      'transition:transform .3s cubic-bezier(.34,1.2,.64,1);font-family:"DM Sans",sans-serif;}',
      '#kfl-du.kfl-v{transform:translateY(0);}',
      '#kfl-du .ico{font-size:.9rem;flex-shrink:0;}',
      '#kfl-du .msg{flex:1;}',
      '#kfl-du .cta{color:#fff;font-weight:800;font-family:"Barlow Condensed",sans-serif;',
      'font-size:.82rem;letter-spacing:.5px;text-decoration:none;flex-shrink:0;',
      'background:rgba(0,0,0,.2);padding:4px 10px;border-radius:6px;}',
      '#kfl-du .x{background:none;border:none;color:rgba(255,255,255,.7);',
      'cursor:pointer;font-size:.8rem;padding:4px;flex-shrink:0;transition:color .15s;}',
      '#kfl-du .x:hover{color:#fff;}',
    ].join('');
    document.head.appendChild(s);
  }

  /* ── Generic permission prompt ── */
  function showPrompt(opts) {
    // opts: { iconClass, title, lines[], highlight, onYes, onNo }
    if (document.getElementById('kfl-np')) return;
    injectCSS();

    var linesHTML = (opts.lines || []).map(function (l) {
      return '<span>' + l + '</span>';
    }).join('');
    if (opts.highlight) {
      linesHTML += '<span class="kfl-np-hl">' + opts.highlight + '</span>';
    }

    var el = document.createElement('div');
    el.id = 'kfl-np';
    el.innerHTML =
      '<div class="kfl-np-wrap">' +
        '<div class="kfl-np-ico ' + (opts.iconClass || 'all') + '">' +
          '<i class="fa-solid ' + (opts.icon || 'fa-bell') + '"></i>' +
        '</div>' +
        '<div class="kfl-np-body">' +
          '<b>' + opts.title + '</b>' +
          linesHTML +
        '</div>' +
        '<div class="kfl-np-acts">' +
          '<button class="kfl-np-btn kfl-np-yes" id="kfl-np-y">Allow</button>' +
          '<button class="kfl-np-btn kfl-np-no"  id="kfl-np-n">Not now</button>' +
        '</div>' +
      '</div>';

    document.body.appendChild(el);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.classList.add('kfl-v'); });
    });

    var gone = false;
    function dismiss() {
      if (gone) return; gone = true;
      el.classList.remove('kfl-v');
      setTimeout(function () { el.parentNode && el.parentNode.removeChild(el); }, 400);
    }

    document.getElementById('kfl-np-y').onclick = function () { dismiss(); opts.onYes && opts.onYes(); };
    document.getElementById('kfl-np-n').onclick = function () { dismiss(); opts.onNo  && opts.onNo(); };
    setTimeout(function () { if (!gone) { dismiss(); opts.onNo && opts.onNo(); } }, 12000);
  }

  /* Request browser permission — shared by all notification types */
  async function requestPermission() {
    if (!window.Notification) return 'unsupported';
    if (Notification.permission === 'granted') return 'granted';
    if (Notification.permission === 'denied')  return 'denied';
    return await Notification.requestPermission();
  }


  /* ═══════════════════════════════════════════════════════════
     3. DEADLINE NOTIFICATIONS
  ═══════════════════════════════════════════════════════════ */

  var DL_KEY = 'kfl_deadline_sched';

  async function fetchNextDeadline() {
    try {
      var bs   = await fetchBootstrap();
      var now  = Date.now();
      var next = bs.events
        .filter(function (e) { return new Date(e.deadline_time).getTime() > now; })
        .sort(function (a, b) { return new Date(a.deadline_time) - new Date(b.deadline_time); })[0];
      if (!next) return null;
      var dl = new Date(next.deadline_time).getTime();
      return { gwId: next.id, gwName: next.name, deadline: dl, deadlineStr: fmtDate(dl) };
    } catch (e) {
      console.warn('[KopalaNotify] deadline fetch:', e.message);
      return null;
    }
  }

  function scheduleDeadlineAlerts(info) {
    var now = Date.now();
    var dl  = info.deadline;

    var ms24 = dl - now - 86400000;
    var ms1  = dl - now -  3600000;
    var ms15 = dl - now -   900000;

    if (ms24 > 0) {
      setTimeout(function () {
        pushNotify(
          '\u23F0 ' + info.gwName + ' deadline tomorrow',
          'Make your transfers before ' + info.deadlineStr + '. 24 hours to go.',
          { tag: 'kfl-deadline', vibrate: [100, 60, 100], url: '/transfers.html',
            actions: [{ action: 'open', title: 'Make transfers' }, { action: 'dismiss', title: 'Dismiss' }] }
        );
      }, ms24);
    }

    if (ms1 > 0) {
      setTimeout(function () {
        Haptic.warning();
        pushNotify(
          '\uD83D\uDEA8 1 hour to ' + info.gwName + ' deadline!',
          info.deadlineStr + ' \u2014 lock in your captain and transfers now.',
          { tag: 'kfl-deadline', vibrate: [200, 80, 200], url: '/transfers.html',
            actions: [{ action: 'open', title: 'Transfers now' }, { action: 'dismiss', title: 'Dismiss' }] }
        );
      }, ms1);
    }

    if (ms15 > 0) {
      setTimeout(function () {
        Haptic.warning();
        showDeadlineBanner(info.gwName);
      }, ms15);
    }

    lsSet(DL_KEY, { gwId: info.gwId, scheduled: true });
    console.log('[KopalaNotify] Deadline alerts scheduled:', info.gwName, '@', info.deadlineStr);
  }

  function showDeadlineBanner(gwName) {
    if (document.getElementById('kfl-du')) return;
    injectCSS();
    var el = document.createElement('div');
    el.id = 'kfl-du';
    el.innerHTML =
      '<i class="fa-solid fa-circle-exclamation ico"></i>' +
      '<span class="msg"><b>15 minutes</b> to ' + gwName + ' deadline</span>' +
      '<a href="/transfers.html" class="cta">Transfers \u2192</a>' +
      '<button class="x" id="kfl-du-x" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button>';
    document.body.insertBefore(el, document.body.firstChild);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('kfl-v'); }); });

    function close() {
      el.classList.remove('kfl-v');
      setTimeout(function () { el.parentNode && el.parentNode.removeChild(el); }, 300);
    }
    document.getElementById('kfl-du-x').onclick = close;
    setTimeout(close, 30000);
  }

  async function initDeadline() {
    var info = await fetchNextDeadline();
    if (!info) return;
    var stored = lsGet(DL_KEY);
    if (stored && stored.gwId === info.gwId && stored.scheduled) return;
    scheduleDeadlineAlerts(info);
  }


  /* ═══════════════════════════════════════════════════════════
     4. PRICE CHANGE NOTIFICATIONS
     Runs once per day ~6:30am (when FPL updates prices).
     Checks YOUR squad players only. Sends a digest summary.
  ═══════════════════════════════════════════════════════════ */

  var PRICE_KEY = 'kfl_price_last';

  async function checkPriceChanges() {
    var teamId = localStorage.getItem(STORE_ID);
    if (!teamId) return;

    try {
      var bs = await fetchBootstrap();

      /* Find current GW for picks */
      var currentEvent = bs.events.find(function (e) { return e.is_current; });
      if (!currentEvent) return;

      /* Fetch my current squad picks */
      var pRes  = await fetch(PROXY + 'entry/' + teamId + '/event/' + currentEvent.id + '/picks/');
      var picks = await pRes.json();
      if (!picks.picks || !picks.picks.length) return;

      /* Build player lookup */
      var playerMap = {};
      bs.elements.forEach(function (p) { playerMap[p.id] = p; });

      /* Collect rises and falls for MY players */
      var rises = [];
      var falls = [];

      picks.picks.forEach(function (pick) {
        var p = playerMap[pick.element];
        if (!p) return;

        /* FPL exposes cost_change_event (change this GW) and cost_change_start (vs start of season) */
        var change = p.cost_change_event || 0; // in tenths of millions

        if (change > 0) rises.push({ name: p.web_name, change: change });
        if (change < 0) falls.push({ name: p.web_name, change: change });
      });

      if (rises.length === 0 && falls.length === 0) return;

      /* Build digest message */
      var parts = [];
      if (rises.length) {
        parts.push('\uD83D\uDCC8 ' + rises.map(function (r) {
          return r.name + ' +\xA3' + (r.change / 10).toFixed(1) + 'm';
        }).join(', '));
      }
      if (falls.length) {
        parts.push('\uD83D\uDCC9 ' + falls.map(function (f) {
          return f.name + ' \xA3' + (f.change / 10).toFixed(1) + 'm';
        }).join(', '));
      }

      Haptic.price();
      pushNotify(
        '\uD83D\uDCB0 Price changes in your squad',
        parts.join('  \u2022  '),
        { tag: 'kfl-price', vibrate: [15, 40, 15], url: '/squad.html',
          actions: [{ action: 'open', title: 'View squad' }] }
      );

      lsSet(PRICE_KEY, { date: new Date().toDateString(), rises: rises.length, falls: falls.length });

    } catch (e) {
      console.warn('[KopalaNotify] price check:', e.message);
    }
  }

  function schedulePriceCheck() {
    /* Check if we already ran today */
    var stored = lsGet(PRICE_KEY);
    if (stored && stored.date === new Date().toDateString()) return;

    var now  = new Date();
    /* FPL prices update around 06:30 UK time. Schedule check at 06:35. */
    var fire = new Date(now);
    fire.setHours(6, 35, 0, 0);
    if (fire <= now) fire.setDate(fire.getDate() + 1); // already past today → tomorrow

    var ms = fire.getTime() - now.getTime();
    setTimeout(function () {
      checkPriceChanges();
      /* Re-schedule for next day */
      setInterval(checkPriceChanges, 86400000);
    }, ms);

    console.log('[KopalaNotify] Price check scheduled in', Math.round(ms / 60000), 'mins');
  }


  /* ═══════════════════════════════════════════════════════════
     5. GOAL NOTIFICATIONS (live match, your players' teams)
     Polls every 90s during live matches. Sends a push when
     a team with one of your players scores.
  ═══════════════════════════════════════════════════════════ */

  var GOAL_KEY     = 'kfl_goal_scores';  // tracks last known scores
  var _goalTimer   = null;
  var _goalActive  = false;

  async function startGoalWatcher() {
    if (_goalActive) return;
    _goalActive = true;
    await pollGoals();
    _goalTimer = setInterval(pollGoals, 90000); // every 90 seconds
  }

  function stopGoalWatcher() {
    _goalActive = false;
    if (_goalTimer) { clearInterval(_goalTimer); _goalTimer = null; }
  }

  async function pollGoals() {
    var teamId = localStorage.getItem(STORE_ID);
    if (!teamId) return;

    try {
      var bs = await fetchBootstrap();
      var currentEvent = bs.events.find(function (e) { return e.is_current; });
      if (!currentEvent) { stopGoalWatcher(); return; }

      var gwId   = currentEvent.id;
      var fxRes  = await fetch(PROXY + 'fixtures/?event=' + gwId);
      var fixtures = await fxRes.json();

      /* Are any games live right now? */
      var liveFixtures = fixtures.filter(function (f) {
        return f.started && !f.finished_provisional;
      });
      if (!liveFixtures.length) { stopGoalWatcher(); return; }

      /* Get my squad's team IDs */
      var pRes    = await fetch(PROXY + 'entry/' + teamId + '/event/' + gwId + '/picks/');
      var picks   = await pRes.json();
      if (!picks.picks) return;

      var playerMap = {};
      bs.elements.forEach(function (p) { playerMap[p.id] = p; });

      var teamMap = {};
      bs.teams.forEach(function (t) { teamMap[t.id] = t; });

      /* Build set of teams I have players in (starting XI only) */
      var myTeams = new Set();
      var myPlayersByTeam = {}; // teamId -> [playerName, ...]
      picks.picks.forEach(function (pick, i) {
        if (i >= 11) return;
        var p = playerMap[pick.element];
        if (!p) return;
        myTeams.add(p.team);
        if (!myPlayersByTeam[p.team]) myPlayersByTeam[p.team] = [];
        myPlayersByTeam[p.team].push(p.web_name + (pick.is_captain ? ' (C)' : ''));
      });

      /* Load last known scores */
      var lastScores = lsGet(GOAL_KEY) || {};

      liveFixtures.forEach(function (fx) {
        var hTeam = fx.team_h;
        var aTeam = fx.team_a;
        var hScore = fx.team_h_score || 0;
        var aScore = fx.team_a_score || 0;
        var key    = fx.id;

        var prev   = lastScores[key] || { h: 0, a: 0 };

        /* Detect new goals */
        if (hScore > prev.h && myTeams.has(hTeam)) {
          var scorers = myPlayersByTeam[hTeam] || [];
          fireGoalNotif(teamMap[hTeam], teamMap[aTeam], hScore, aScore, scorers, 'h');
        }
        if (aScore > prev.a && myTeams.has(aTeam)) {
          var scorers2 = myPlayersByTeam[aTeam] || [];
          fireGoalNotif(teamMap[aTeam], teamMap[hTeam], aScore, hScore, scorers2, 'a');
        }

        /* Update stored scores */
        lastScores[key] = { h: hScore, a: aScore };
      });

      lsSet(GOAL_KEY, lastScores);

    } catch (e) {
      console.warn('[KopalaNotify] goal poll:', e.message);
    }
  }

  function fireGoalNotif(scoringTeam, opponent, ownScore, oppScore, myPlayers, side) {
    var teamName = scoringTeam ? scoringTeam.short_name : '?';
    var oppName  = opponent    ? opponent.short_name    : '?';
    var scoreStr = side === 'h'
      ? ownScore + '\u2013' + oppScore
      : oppScore + '\u2013' + ownScore;

    var body = teamName + ' ' + ownScore + ' vs ' + oppName + ' ' + oppScore;
    if (myPlayers.length) {
      body += '\nYour players: ' + myPlayers.join(', ');
    }

    Haptic.goal();
    pushNotify(
      '\u26BD GOAL! ' + teamName + ' (' + ownScore + ')',
      body,
      { tag: 'kfl-goal-' + (scoringTeam ? scoringTeam.id : 'x'),
        renotify: true,
        vibrate: [40, 60, 40, 60, 80],
        url: '/games.html',
        actions: [{ action: 'open', title: 'View match' }] }
    );
  }

  /* Check once on load whether a live match is in progress and start watcher */
  async function maybeStartGoalWatcher() {
    if (Notification.permission !== 'granted') return;
    try {
      var bs  = await fetchBootstrap();
      var cur = bs.events.find(function (e) { return e.is_current; });
      if (!cur) return;
      var fxRes = await fetch(PROXY + 'fixtures/?event=' + cur.id);
      var fxs   = await fxRes.json();
      var hasLive = fxs.some(function (f) { return f.started && !f.finished_provisional; });
      if (hasLive) startGoalWatcher();
    } catch (_) {}
  }

  /* Restart watcher when page becomes visible again */
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      maybeStartGoalWatcher();
    } else {
      stopGoalWatcher(); // save battery when tab hidden
    }
  });


  /* ═══════════════════════════════════════════════════════════
     6. PERMISSION FLOW — one prompt covers everything
  ═══════════════════════════════════════════════════════════ */

  async function initPermissionFlow() {
    if (!window.Notification) return;

    /* Already granted → boot all features */
    if (Notification.permission === 'granted') {
      await initDeadline();
      schedulePriceCheck();
      maybeStartGoalWatcher();
      return;
    }

    /* Denied → nothing */
    if (Notification.permission === 'denied') return;

    /* Respect 7-day cooldown */
    var lastAsked = parseInt(localStorage.getItem(PERM_KEY) || '0', 10);
    if (Date.now() - lastAsked < 604800000) return;

    /* Fetch deadline info for the prompt copy */
    var dlInfo = await fetchNextDeadline();
    if (!dlInfo) return;
    if (dlInfo.deadline - Date.now() < 7200000) return; // < 2h remaining, not the moment

    /* Show the combined prompt after 3s */
    setTimeout(function () {
      showPrompt({
        iconClass: 'all',
        icon:      'fa-bell',
        title:     'Stay ahead of the game',
        lines: [
          'Deadline reminders 24h &amp; 1h before',
          'Price rises &amp; falls for your squad',
          'Goal alerts when your players\u2019 teams score',
        ],
        highlight: dlInfo.gwName + ' \u2014 ' + dlInfo.deadlineStr,
        onYes: async function () {
          localStorage.setItem(PERM_KEY, Date.now().toString());
          var result = await requestPermission();
          if (result === 'granted') {
            await initDeadline();
            schedulePriceCheck();
            maybeStartGoalWatcher();
          }
        },
        onNo: function () {
          localStorage.setItem(PERM_KEY, Date.now().toString());
        },
      });
    }, 3000);
  }


  /* ═══════════════════════════════════════════════════════════
     7. BOOT
  ═══════════════════════════════════════════════════════════ */

  function boot() {
    wireHaptics();
    initPermissionFlow();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* Re-init when SW delivers fresh bootstrap */
  window.addEventListener('kopala:bootstrap-updated', function () {
    if (Notification.permission !== 'granted') return;
    initDeadline();
    schedulePriceCheck();
  });


  /* ═══════════════════════════════════════════════════════════
     8. PUBLIC API
  ═══════════════════════════════════════════════════════════ */

  window.KopalaNotify = {

    /** Force-show the full permission prompt (use on settings page) */
    prompt: async function () {
      var dlInfo = await fetchNextDeadline();
      showPrompt({
        iconClass: 'all',
        icon:      'fa-bell',
        title:     'Stay ahead of the game',
        lines: [
          'Deadline reminders 24h &amp; 1h before',
          'Price rises &amp; falls for your squad',
          'Goal alerts when your players\u2019 teams score',
        ],
        highlight: dlInfo ? dlInfo.gwName + ' \u2014 ' + dlInfo.deadlineStr : '',
        onYes: async function () {
          var r = await requestPermission();
          if (r === 'granted') { await initDeadline(); schedulePriceCheck(); maybeStartGoalWatcher(); }
        },
        onNo: function () {},
      });
    },

    /** Current browser permission state */
    status: function () {
      return window.Notification ? Notification.permission : 'unsupported';
    },

    /** Test notifications individually */
    testDeadline: function () {
      Haptic.warning();
      pushNotify('\uD83D\uDEA8 1 hour to GW Test deadline!',
        'Fri 14 Mar, 18:30 \u2014 lock in your captain and transfers now.',
        { tag: 'kfl-deadline-test', url: '/transfers.html',
          actions: [{ action: 'open', title: 'Transfers now' }] });
    },
    testPrice: function () {
      Haptic.price();
      pushNotify('\uD83D\uDCB0 Price changes in your squad',
        '\uD83D\uDCC8 Salah +\xA30.1m, M.Salah +\xA30.1m  \u2022  \uD83D\uDCC9 Haaland -\xA30.1m',
        { tag: 'kfl-price-test', url: '/squad.html' });
    },
    testGoal: function () {
      Haptic.goal();
      pushNotify('\u26BD GOAL! ARS (2)',
        'ARS 2 vs CHE 1\nYour players: Rice (C), Saliba',
        { tag: 'kfl-goal-test', url: '/games.html' });
    },
    testBanner: function () {
      Haptic.warning();
      showDeadlineBanner('GW Test');
    },

    /** Manually trigger a price check right now */
    checkPrices: checkPriceChanges,

    /** Start/stop goal watcher manually */
    startGoals: startGoalWatcher,
    stopGoals:  stopGoalWatcher,
  };

})();
