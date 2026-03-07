/**
 * kopala-notify.js — Kopala FPL
 * ─────────────────────────────────────────────────────────────
 * Unified notifications + haptic feedback. No Firebase.
 * Uses the native Web Push + Service Worker Notification API.
 *
 * Notification groups (Android/iOS):
 *   kfl-deadline  → deadline reminders (30 min warning)
 *   kfl-goals     → goal alerts, one per scoring team
 *   kfl-prices    → morning price digest for your squad
 *
 * Public API:
 *   Haptic.tap() / .success() / .warning() / .error() / .goal() / .price()
 *   KopalaNotify.prompt()        — show permission card
 *   KopalaNotify.status()        — 'granted' | 'denied' | 'default' | 'unsupported'
 *   KopalaNotify.testDeadline()  — fire test deadline notification
 *   KopalaNotify.testPrice()     — fire test price notification
 *   KopalaNotify.testGoal()      — fire test goal notification
 *   KopalaNotify.updateTeamId(id)
 */

(function () {
  'use strict';

  /* ═══════════════════════════════════════════════════════════
     1. HAPTIC
  ═══════════════════════════════════════════════════════════ */

  var _vib = 'vibrate' in navigator;
  function vibrate(p) { if (_vib) try { navigator.vibrate(p); } catch (_) {} }

  var PATTERNS = {
    tap:     [8],
    success: [10, 60, 20],
    warning: [30, 80, 30],
    error:   [50, 40, 50, 40, 50],
    goal:    [40, 60, 40, 60, 80],
    price:   [15, 40, 15],
    expand:  [6],
    dismiss: [4],
  };

  var Haptic = {};
  Object.keys(PATTERNS).forEach(function (k) {
    Haptic[k] = function () { vibrate(PATTERNS[k]); };
  });
  Haptic.custom = function (p) { vibrate(p); };
  window.Haptic = Haptic;

  /* Auto-wire [data-haptic] elements */
  function wireHaptics() {
    document.querySelectorAll('[data-haptic]').forEach(function (el) {
      if (el.dataset.hapticWired) return;
      el.dataset.hapticWired = '1';
      var fn = Haptic[el.dataset.haptic] || Haptic.tap;
      el.addEventListener('touchstart', fn, { passive: true });
    });
  }
  new MutationObserver(wireHaptics)
    .observe(document.documentElement, { childList: true, subtree: true });


  /* ═══════════════════════════════════════════════════════════
     2. CONSTANTS + HELPERS
  ═══════════════════════════════════════════════════════════ */

  var PROXY    = '/.netlify/functions/fpl-proxy?endpoint=';
  var ID_KEY   = 'kopala_id';
  var PERM_KEY = 'kfl_notify_perm_asked';

  function lsGet(k) {
    try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (_) { return null; }
  }
  function lsSet(k, v) {
    try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {}
  }

  function fmtDate(ts) {
    return new Intl.DateTimeFormat('en-GB', {
      weekday: 'short', day: 'numeric', month: 'short',
      hour: '2-digit', minute: '2-digit',
    }).format(new Date(ts));
  }

  async function fetchBootstrap() {
    var res = await fetch(PROXY + 'bootstrap-static/');
    return res.json();
  }

  /* ── Send a notification via SW (preferred) or fallback ── */
  function sendNotification(title, body, opts) {
    if (!window.Notification || Notification.permission !== 'granted') return;
    opts = opts || {};

    var payload = {
      body:    body,
      icon:    '/android-chrome-192x192.png',
      badge:   '/android-chrome-96x96.png',
      vibrate: opts.vibrate  || [100, 50, 100],
      tag:     opts.tag      || 'kfl-notify',
      renotify: opts.renotify !== false,
      silent:  opts.silent   || false,
      data:    { url: opts.url || '/', group: opts.group || null },
      actions: opts.actions  || [],
    };

    /* Android grouping — threadId equivalent */
    if (opts.group) payload.group = opts.group;

    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready
        .then(function (reg) { return reg.showNotification(title, payload); })
        .catch(function () { new Notification(title, payload); });
    } else {
      try { new Notification(title, payload); } catch (_) {}
    }
  }

  /* ── Group summary: collapses individual notifs under one header ── */
  function sendGroupSummary(group, count) {
    if (!navigator.serviceWorker || !navigator.serviceWorker.controller) return;

    var summaryMap = {
      'kfl-deadline': 'FPL Deadline',
      'kfl-goals':    count + ' goal alert' + (count > 1 ? 's' : ''),
      'kfl-prices':   count + ' price change' + (count > 1 ? 's' : '') + ' in your squad',
    };

    navigator.serviceWorker.ready.then(function (reg) {
      reg.showNotification(summaryMap[group] || 'Kopala FPL', {
        body:    'Tap to open Kopala FPL',
        icon:    '/android-chrome-192x192.png',
        badge:   '/android-chrome-96x96.png',
        tag:     group + '-summary',
        group:   group,
        silent:  true,
        renotify: false,
        data:    { url: '/', group: group, isSummary: true, count: count },
      });
    });
  }


  /* ═══════════════════════════════════════════════════════════
     3. DEADLINE NOTIFICATIONS
     Fires at: 30 minutes before deadline
  ═══════════════════════════════════════════════════════════ */

  var DL_SCHED_KEY = 'kfl_deadline_sched';

  async function fetchNextDeadline() {
    try {
      var bs  = await fetchBootstrap();
      var now = Date.now();
      var next = bs.events
        .filter(function (e) { return new Date(e.deadline_time).getTime() > now + 60000; })
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
    var now  = Date.now();
    var dl   = info.deadline;
    /* 2 hours before deadline.
       The SW periodic sync is the primary driver for closed-app notifications.
       This setTimeout is a fallback for when the app IS open — it fires the
       in-app banner and a notification with more precise timing. */
    var ms2h = dl - now - 2 * 60 * 60 * 1000;

    if (ms2h > 0) {
      setTimeout(function () {
        Haptic.warning();

        /* Notification (also fires if app is open — SW handles closed-app case) */
        sendNotification(
          '⏰ 2 hours to ' + info.gwName + ' deadline!',
          'Lock in your captain and transfers before ' + info.deadlineStr,
          {
            tag:      'kfl-deadline-2h',
            group:    'kfl-deadline',
            renotify: true,
            vibrate:  [200, 80, 200, 80, 200],
            url:      '/transfers.html',
            actions:  [
              { action: 'open',    title: '📋 Transfers' },
              { action: 'dismiss', title: 'Dismiss' },
            ],
          }
        );

        sendGroupSummary('kfl-deadline', 1);
        showDeadlineBanner(info.gwName, info.deadlineStr);

      }, ms2h);

      lsSet(DL_SCHED_KEY, { gwId: info.gwId, scheduled: true, scheduledAt: now });
      console.log('[KopalaNotify] 2-hour deadline alert scheduled:', info.gwName, '@', info.deadlineStr,
        '(fires in', Math.round(ms2h / 60000), 'mins)');
    } else {
      console.log('[KopalaNotify] Deadline too close or past — SW will handle it');
    }
  }

  async function initDeadline() {
    var info = await fetchNextDeadline();
    if (!info) return;
    var stored = lsGet(DL_SCHED_KEY);
    /* Only re-schedule if it's a new GW or we haven't scheduled yet */
    if (stored && stored.gwId === info.gwId && stored.scheduled) return;
    scheduleDeadlineAlerts(info);
  }

  /* In-app banner (shown when user has app open during the 30-min window) */
  var _cssInjected = false;
  function injectBannerCSS() {
    if (_cssInjected) return;
    _cssInjected = true;
    var s = document.createElement('style');
    s.textContent = [
      '#kfl-du{position:fixed;top:0;left:0;right:0;z-index:9500;',
      'background:linear-gradient(90deg,#dc2626,#ef4444);color:#fff;',
      'display:flex;align-items:center;gap:8px;padding:10px 14px;',
      'font-size:.8rem;font-weight:600;',
      'transform:translateY(-100%);transition:transform .3s cubic-bezier(.34,1.2,.64,1);',
      'font-family:"DM Sans",system-ui,sans-serif;}',
      '#kfl-du.kfl-v{transform:translateY(0);}',
      '#kfl-du .msg{flex:1;}',
      '#kfl-du .cta{color:#fff;font-weight:800;font-size:.82rem;letter-spacing:.4px;',
      'text-decoration:none;background:rgba(0,0,0,.2);padding:4px 10px;border-radius:6px;flex-shrink:0;}',
      '#kfl-du .x{background:none;border:none;color:rgba(255,255,255,.75);',
      'cursor:pointer;font-size:1.1rem;padding:4px;flex-shrink:0;line-height:1;}',
    ].join('');
    document.head.appendChild(s);
  }

  function showDeadlineBanner(gwName, deadlineStr) {
    if (document.getElementById('kfl-du')) return;
    injectBannerCSS();
    var el = document.createElement('div');
    el.id = 'kfl-du';
    el.innerHTML =
      '<span class="msg">⏰ <b>30 mins</b> to ' + gwName + ' deadline — ' + deadlineStr + '</span>' +
      '<a href="/transfers.html" class="cta">Transfers →</a>' +
      '<button class="x" id="kfl-du-x" aria-label="Dismiss">✕</button>';
    document.body.insertBefore(el, document.body.firstChild);
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { el.classList.add('kfl-v'); });
    });
    function close() {
      el.classList.remove('kfl-v');
      setTimeout(function () { el.parentNode && el.parentNode.removeChild(el); }, 300);
    }
    document.getElementById('kfl-du-x').onclick = close;
    setTimeout(close, 45000); // auto-dismiss after 45s
  }


  /* ═══════════════════════════════════════════════════════════
     4. PRICE CHANGE NOTIFICATIONS
     Runs once daily at 06:35 (after FPL updates ~06:30).
     Checks YOUR squad only. Grouped under kfl-prices.
  ═══════════════════════════════════════════════════════════ */

  var PRICE_KEY = 'kfl_price_last';

  async function checkPriceChanges() {
    var teamId = localStorage.getItem(ID_KEY);
    if (!teamId) return;

    /* Only run once per calendar day */
    var stored = lsGet(PRICE_KEY);
    if (stored && stored.date === new Date().toDateString()) return;

    try {
      var bs = await fetchBootstrap();
      var currentEvent = bs.events.find(function (e) { return e.is_current; });
      if (!currentEvent) return;

      var pRes  = await fetch(PROXY + 'entry/' + teamId + '/event/' + currentEvent.id + '/picks/');
      var picks = await pRes.json();
      if (!picks.picks || !picks.picks.length) return;

      var playerMap = {};
      bs.elements.forEach(function (p) { playerMap[p.id] = p; });

      var rises = [];
      var falls = [];

      picks.picks.forEach(function (pick) {
        var p = playerMap[pick.element];
        if (!p) return;
        var chg = p.cost_change_event || 0;
        if (chg > 0) rises.push({ name: p.web_name, chg: chg });
        if (chg < 0) falls.push({ name: p.web_name, chg: chg });
      });

      if (!rises.length && !falls.length) return;

      Haptic.price();

      var total = rises.length + falls.length;

      /* One notification per changed player, all grouped */
      rises.forEach(function (r) {
        sendNotification(
          '📈 ' + r.name + ' +£' + (r.chg / 10).toFixed(1) + 'm',
          'Price rise in your squad',
          {
            tag:      'kfl-price-' + r.name.toLowerCase().replace(/\s/g, '-'),
            group:    'kfl-prices',
            renotify: false,
            vibrate:  [15, 40, 15],
            url:      '/prices.html',
            actions:  [{ action: 'open', title: '📊 View prices' }],
          }
        );
      });

      falls.forEach(function (f) {
        sendNotification(
          '📉 ' + f.name + ' £' + (f.chg / 10).toFixed(1) + 'm',
          'Price fall in your squad',
          {
            tag:      'kfl-price-' + f.name.toLowerCase().replace(/\s/g, '-'),
            group:    'kfl-prices',
            renotify: false,
            vibrate:  [15, 40, 15],
            url:      '/prices.html',
            actions:  [{ action: 'open', title: '📊 View prices' }],
          }
        );
      });

      /* Group summary collapses all individual price notifs */
      sendGroupSummary('kfl-prices', total);

      lsSet(PRICE_KEY, {
        date:  new Date().toDateString(),
        rises: rises.length,
        falls: falls.length,
      });

    } catch (e) {
      console.warn('[KopalaNotify] price check:', e.message);
    }
  }

  function schedulePriceCheck() {
    var stored = lsGet(PRICE_KEY);
    if (stored && stored.date === new Date().toDateString()) return;

    var now  = new Date();
    var fire = new Date(now);
    fire.setHours(6, 35, 0, 0);
    if (fire <= now) fire.setDate(fire.getDate() + 1);

    var ms = fire.getTime() - now.getTime();
    setTimeout(function () {
      checkPriceChanges();
      setInterval(checkPriceChanges, 86400000); // repeat daily
    }, ms);

    console.log('[KopalaNotify] Price check scheduled in', Math.round(ms / 60000), 'mins');
  }


  /* ═══════════════════════════════════════════════════════════
     5. GOAL NOTIFICATIONS
     Polls every 90s during live matches.
     One notification per scoring team, grouped under kfl-goals.
  ═══════════════════════════════════════════════════════════ */

  var GOAL_SCORES_KEY = 'kfl_goal_scores';
  var GOAL_COUNT_KEY  = 'kfl_goal_count';
  var _goalTimer      = null;
  var _goalActive     = false;

  async function startGoalWatcher() {
    if (_goalActive) return;
    _goalActive = true;
    await pollGoals();
    _goalTimer = setInterval(pollGoals, 90000);
    console.log('[KopalaNotify] Goal watcher started');
  }

  function stopGoalWatcher() {
    _goalActive = false;
    if (_goalTimer) { clearInterval(_goalTimer); _goalTimer = null; }
  }

  async function pollGoals() {
    var teamId = localStorage.getItem(ID_KEY);
    if (!teamId) return;

    try {
      var bs  = await fetchBootstrap();
      var cur = bs.events.find(function (e) { return e.is_current; });
      if (!cur) { stopGoalWatcher(); return; }

      var fxRes    = await fetch(PROXY + 'fixtures/?event=' + cur.id);
      var fixtures = await fxRes.json();

      var liveFixtures = fixtures.filter(function (f) {
        return f.started && !f.finished_provisional;
      });
      if (!liveFixtures.length) { stopGoalWatcher(); return; }

      /* Build my teams set */
      var pRes  = await fetch(PROXY + 'entry/' + teamId + '/event/' + cur.id + '/picks/');
      var picks = await pRes.json();
      if (!picks.picks) return;

      var playerMap = {};
      bs.elements.forEach(function (p) { playerMap[p.id] = p; });
      var teamMap = {};
      bs.teams.forEach(function (t) { teamMap[t.id] = t; });

      var myTeams        = new Set();
      var myPlayerByTeam = {};
      picks.picks.forEach(function (pick, idx) {
        if (idx >= 11) return; // starting XI only
        var p = playerMap[pick.element];
        if (!p) return;
        myTeams.add(p.team);
        if (!myPlayerByTeam[p.team]) myPlayerByTeam[p.team] = [];
        myPlayerByTeam[p.team].push(p.web_name + (pick.is_captain ? ' ©' : ''));
      });

      var lastScores  = lsGet(GOAL_SCORES_KEY) || {};
      var goalCount   = lsGet(GOAL_COUNT_KEY)  || 0;
      var newGoals    = 0;

      liveFixtures.forEach(function (fx) {
        var hScore = fx.team_h_score || 0;
        var aScore = fx.team_a_score || 0;
        var prev   = lastScores[fx.id] || { h: 0, a: 0 };

        /* Home team scored */
        if (hScore > prev.h && myTeams.has(fx.team_h)) {
          var players = myPlayerByTeam[fx.team_h] || [];
          fireGoalNotif(teamMap[fx.team_h], teamMap[fx.team_a], hScore, aScore, players, 'h', fx.id);
          newGoals++;
        }

        /* Away team scored */
        if (aScore > prev.a && myTeams.has(fx.team_a)) {
          var players2 = myPlayerByTeam[fx.team_a] || [];
          fireGoalNotif(teamMap[fx.team_a], teamMap[fx.team_h], aScore, hScore, players2, 'a', fx.id);
          newGoals++;
        }

        lastScores[fx.id] = { h: hScore, a: aScore };
      });

      if (newGoals > 0) {
        goalCount += newGoals;
        lsSet(GOAL_COUNT_KEY, goalCount);
        /* Update group summary so Android collapses them */
        sendGroupSummary('kfl-goals', goalCount);
      }

      lsSet(GOAL_SCORES_KEY, lastScores);

    } catch (e) {
      console.warn('[KopalaNotify] goal poll:', e.message);
    }
  }

  function fireGoalNotif(scoringTeam, opponent, ownScore, oppScore, myPlayers, side, fxId) {
    var tName   = scoringTeam ? scoringTeam.name       : 'Unknown';
    var tShort  = scoringTeam ? scoringTeam.short_name : '???';
    var oShort  = opponent    ? opponent.short_name    : '???';

    var scoreStr = side === 'h'
      ? tShort + ' ' + ownScore + '–' + oppScore + ' ' + oShort
      : oShort + ' ' + oppScore + '–' + ownScore + ' ' + tShort;

    var body = scoreStr;
    if (myPlayers.length) {
      body += '\nYour players: ' + myPlayers.join(', ');
    }

    Haptic.goal();

    sendNotification(
      '⚽ GOAL! ' + tName,
      body,
      {
        /* Unique tag per fixture so each match has its own notification */
        tag:      'kfl-goal-fx-' + fxId + '-' + (scoringTeam ? scoringTeam.id : 'x'),
        group:    'kfl-goals',
        renotify: true,
        vibrate:  [40, 60, 40, 60, 80],
        url:      '/games.html',
        actions:  [
          { action: 'open',    title: '⚽ View match' },
          { action: 'dismiss', title: 'Dismiss' },
        ],
      }
    );
  }

  /* Reset goal count when a new GW starts */
  function maybeResetGoalCount() {
    var stored = lsGet(GOAL_SCORES_KEY);
    if (!stored || Object.keys(stored).length === 0) {
      lsSet(GOAL_COUNT_KEY, 0);
    }
  }

  async function maybeStartGoalWatcher() {
    if (Notification.permission !== 'granted') return;
    try {
      var bs  = await fetchBootstrap();
      var cur = bs.events.find(function (e) { return e.is_current; });
      if (!cur) return;
      var fxRes = await fetch(PROXY + 'fixtures/?event=' + cur.id);
      var fxs   = await fxRes.json();
      var hasLive = fxs.some(function (f) { return f.started && !f.finished_provisional; });
      if (hasLive) {
        maybeResetGoalCount();
        startGoalWatcher();
      }
    } catch (_) {}
  }

  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'visible') {
      maybeStartGoalWatcher();
    } else {
      stopGoalWatcher();
    }
  });


  /* ═══════════════════════════════════════════════════════════
     6. PERMISSION PROMPT
  ═══════════════════════════════════════════════════════════ */

  var _promptCSS = false;
  function injectPromptCSS() {
    if (_promptCSS) return; _promptCSS = true;
    var s = document.createElement('style');
    s.textContent = [
      '#kfl-np{position:fixed;bottom:calc(env(safe-area-inset-bottom,0px) + 80px);',
      'left:12px;right:12px;z-index:9100;display:flex;justify-content:center;',
      'transform:translateY(130%);opacity:0;pointer-events:none;',
      'transition:transform .38s cubic-bezier(.34,1.3,.64,1),opacity .25s ease;}',
      '#kfl-np.kfl-v{transform:translateY(0);opacity:1;pointer-events:auto;}',

      '.kfl-np-w{width:100%;max-width:420px;',
      'background:var(--surface,#26002f);',
      'border:1px solid var(--border,rgba(4,245,255,0.1));',
      'border-radius:18px;padding:14px 16px;',
      'display:flex;align-items:flex-start;gap:12px;',
      'box-shadow:0 8px 40px rgba(0,0,0,.6);}',

      '.kfl-np-ico{width:40px;height:40px;flex-shrink:0;border-radius:11px;',
      'background:rgba(233,0,82,.12);color:#e90052;',
      'display:flex;align-items:center;justify-content:center;font-size:1.2rem;}',

      '.kfl-np-body{flex:1;min-width:0;}',
      '.kfl-np-body b{display:block;font-size:.9rem;font-weight:800;',
      'color:var(--text-1,#fff);margin-bottom:5px;}',
      '.kfl-np-body li{font-size:.72rem;color:var(--text-2,rgba(255,255,255,.55));',
      'line-height:1.6;list-style:none;padding-left:0;}',
      '.kfl-np-body li::before{content:"· ";color:var(--accent,#04f5ff);}',
      '.kfl-np-hl{display:block;font-size:.68rem;color:#e90052;font-weight:700;margin-top:5px;}',

      '.kfl-np-acts{display:flex;flex-direction:column;gap:5px;flex-shrink:0;}',
      '.kfl-np-btn{border:none;border-radius:8px;padding:7px 14px;font-size:.76rem;',
      'font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;transition:opacity .15s;}',
      '.kfl-np-yes{background:#e90052;color:#fff;}',
      '.kfl-np-yes:hover{opacity:.88;}',
      '.kfl-np-no{background:var(--hover-bg,rgba(255,255,255,.06));',
      'color:var(--text-2,rgba(255,255,255,.5));border:1px solid var(--border,rgba(4,245,255,.08));}',

      '[data-theme="light"] .kfl-np-w{background:#fff;border-color:rgba(0,0,0,.08);',
      'box-shadow:0 8px 40px rgba(0,0,0,.14);}',
      '[data-theme="light"] .kfl-np-body b{color:#38003c;}',
      '[data-theme="light"] .kfl-np-body li{color:rgba(56,0,60,.6);}',
    ].join('');
    document.head.appendChild(s);
  }

  function showPromptCard(opts) {
    if (document.getElementById('kfl-np')) return;
    injectPromptCSS();

    var items = (opts.lines || []).map(function (l) {
      return '<li>' + l + '</li>';
    }).join('');

    var el = document.createElement('div');
    el.id = 'kfl-np';
    el.innerHTML =
      '<div class="kfl-np-w">' +
        '<div class="kfl-np-ico">🔔</div>' +
        '<div class="kfl-np-body">' +
          '<b>' + opts.title + '</b>' +
          '<ul style="margin:0;padding:0">' + items + '</ul>' +
          (opts.highlight ? '<span class="kfl-np-hl">📅 ' + opts.highlight + '</span>' : '') +
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

    document.getElementById('kfl-np-y').onclick = function () {
      dismiss(); opts.onYes && opts.onYes();
    };
    document.getElementById('kfl-np-n').onclick = function () {
      dismiss(); opts.onNo && opts.onNo();
    };
    setTimeout(function () { if (!gone) { dismiss(); opts.onNo && opts.onNo(); } }, 15000);
  }

  async function requestPermission() {
    if (!window.Notification) return 'unsupported';
    if (Notification.permission !== 'default') return Notification.permission;
    return await Notification.requestPermission();
  }


  /* ═══════════════════════════════════════════════════════════
     7. PERMISSION FLOW
  ═══════════════════════════════════════════════════════════ */

  async function initPermissionFlow() {
    if (!window.Notification) return;

    if (Notification.permission === 'granted') {
      await initDeadline();
      schedulePriceCheck();
      maybeStartGoalWatcher();
      return;
    }

    if (Notification.permission === 'denied') return;

    /* 7-day cooldown between prompts */
    var lastAsked = parseInt(localStorage.getItem(PERM_KEY) || '0', 10);
    if (Date.now() - lastAsked < 7 * 24 * 60 * 60 * 1000) return;

    var dlInfo = await fetchNextDeadline();
    /* Don't prompt if deadline is very soon */
    if (!dlInfo || (dlInfo.deadline - Date.now()) < 2 * 60 * 60 * 1000) return;

    setTimeout(function () {
      showPromptCard({
        title: 'Stay ahead of the game',
        lines: [
          '⏰ 30-min deadline reminder before each GW',
          '📈 Price rises &amp; falls for your squad players',
          '⚽ Goal alerts when your players\' teams score',
        ],
        highlight: dlInfo.gwName + ' — ' + dlInfo.deadlineStr,
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
    }, 3500);
  }


  /* ═══════════════════════════════════════════════════════════
     8. BOOT
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

  /* SW delivered fresh bootstrap → re-check deadline */
  window.addEventListener('kopala:bootstrap-updated', function () {
    if (Notification.permission !== 'granted') return;
    initDeadline();
  });

  /* SW periodic sync woke us for a price check */
  window.addEventListener('kopala:run-price-check', function () {
    if (Notification.permission !== 'granted') return;
    console.log('[KopalaNotify] Price check triggered by SW');
    checkPriceChanges();
  });

  /* SW deadline check found the 2h window — show in-app banner if app is open */
  window.addEventListener('kopala:deadline-approaching', function (e) {
    var d = e.detail || {};
    showDeadlineBanner(d.gwName || 'upcoming GW', d.dlStr || '');
  });


  /* ═══════════════════════════════════════════════════════════
     9. PUBLIC API
  ═══════════════════════════════════════════════════════════ */

  window.KopalaNotify = {

    prompt: async function () {
      var dlInfo = await fetchNextDeadline();
      showPromptCard({
        title: 'Stay ahead of the game',
        lines: [
          '⏰ 30-min deadline reminder before each GW',
          '📈 Price rises &amp; falls for your squad players',
          '⚽ Goal alerts when your players\' teams score',
        ],
        highlight: dlInfo ? dlInfo.gwName + ' — ' + dlInfo.deadlineStr : '',
        onYes: async function () {
          var r = await requestPermission();
          if (r === 'granted') {
            await initDeadline();
            schedulePriceCheck();
            maybeStartGoalWatcher();
          }
        },
        onNo: function () {},
      });
    },

    status: function () {
      return window.Notification ? Notification.permission : 'unsupported';
    },

    updateTeamId: function (newId) {
      console.log('[KopalaNotify] Team ID updated:', newId);
      /* Re-check prices with new ID next run */
      lsSet(PRICE_KEY, null);
    },

    /* Test helpers */
    testDeadline: function () {
      Haptic.warning();
      sendNotification(
        '⏰ 2 hours to GW Test deadline!',
        'Lock in your captain and transfers before Fri 14 Mar, 18:30',
        { tag: 'kfl-deadline-test', group: 'kfl-deadline', url: '/transfers.html',
          actions: [{ action: 'open', title: '📋 Transfers' }] }
      );
      showDeadlineBanner('GW Test', 'Fri 14 Mar, 18:30');
    },

    testPrice: function () {
      Haptic.price();
      sendNotification('📈 Salah +£0.1m', 'Price rise in your squad',
        { tag: 'kfl-price-salah', group: 'kfl-prices', url: '/prices.html' });
      sendNotification('📉 Haaland -£0.1m', 'Price fall in your squad',
        { tag: 'kfl-price-haaland', group: 'kfl-prices', url: '/prices.html' });
      sendGroupSummary('kfl-prices', 2);
    },

    testGoal: function () {
      Haptic.goal();
      sendNotification('⚽ GOAL! Arsenal', 'ARS 2–1 CHE\nYour players: Rice ©, Saliba',
        { tag: 'kfl-goal-test-1', group: 'kfl-goals', renotify: true, url: '/games.html',
          actions: [{ action: 'open', title: '⚽ View match' }] });
      sendGroupSummary('kfl-goals', 1);
    },

    testBanner: function () {
      showDeadlineBanner('GW Test', 'Fri 14 Mar, 18:30');
    },

    checkPrices:  checkPriceChanges,
    startGoals:   startGoalWatcher,
    stopGoals:    stopGoalWatcher,
  };

})();
