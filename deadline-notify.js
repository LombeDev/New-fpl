/**
 * deadline-notify.js — Kopala FPL
 * Deadline push notification scheduler. No server needed.
 *
 * 3 alert tiers:
 *   24h before  -> system notification
 *    1h before  -> system notification + haptic
 *   15min before -> in-app red urgency banner + haptic
 *
 * Usage: <script src="deadline-notify.js"></script>
 */
(function () {
  'use strict';

  var PROXY       = '/.netlify/functions/fpl-proxy?endpoint=';
  var STORAGE_KEY = 'kfl_deadline_notify';
  var PERM_KEY    = 'kfl_notify_perm_asked';

  var buzz = function () { window.Haptic && window.Haptic.warning(); };

  function getStored() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null'); }
    catch (_) { return null; }
  }
  function setStored(d) { localStorage.setItem(STORAGE_KEY, JSON.stringify(d)); }

  /* ── Fetch next GW deadline from bootstrap ── */
  async function fetchNextDeadline() {
    try {
      var res = await fetch(PROXY + 'bootstrap-static/');
      var bs  = await res.json();
      var now = Date.now();
      var next = bs.events
        .filter(function (e) { return new Date(e.deadline_time).getTime() > now; })
        .sort(function (a, b) { return new Date(a.deadline_time) - new Date(b.deadline_time); })[0];
      if (!next) return null;
      var dl = new Date(next.deadline_time);
      return {
        gwId:        next.id,
        gwName:      next.name,
        deadline:    dl.getTime(),
        deadlineStr: new Intl.DateTimeFormat('en-GB', {
          weekday:'short', day:'numeric', month:'short',
          hour:'2-digit', minute:'2-digit',
        }).format(dl),
      };
    } catch (err) {
      console.warn('[DeadlineNotify]', err.message);
      return null;
    }
  }

  /* ── Inject CSS ── */
  var _css = false;
  function css() {
    if (_css) return; _css = true;
    var s = document.createElement('style');
    s.textContent =
      '#kfl-np{position:fixed;bottom:calc(env(safe-area-inset-bottom,0px) + 80px);left:12px;right:12px;z-index:9100;display:flex;justify-content:center;transform:translateY(130%);opacity:0;transition:transform .38s cubic-bezier(.34,1.3,.64,1),opacity .25s ease;pointer-events:none;}' +
      '#kfl-np.v{transform:translateY(0);opacity:1;pointer-events:auto;}' +
      '.kfl-np-i{width:100%;max-width:420px;background:var(--kfl-surface,#141e2d);border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:14px 16px;display:flex;align-items:flex-start;gap:12px;box-shadow:0 8px 40px rgba(0,0,0,.55);}' +
      '.kfl-np-ico{width:40px;height:40px;flex-shrink:0;border-radius:11px;background:rgba(245,158,11,.12);color:#f59e0b;display:flex;align-items:center;justify-content:center;font-size:1rem;}' +
      '.kfl-np-t{flex:1;min-width:0;display:flex;flex-direction:column;gap:3px;}' +
      '.kfl-np-t b{font-family:"Barlow Condensed",sans-serif;font-size:.9rem;font-weight:800;color:var(--kfl-text-1,#eef2ff);}' +
      '.kfl-np-t span{font-size:.7rem;color:var(--kfl-text-3,#4a5f7a);line-height:1.3;}' +
      '.kfl-np-t .kfl-np-dl{font-size:.66rem;color:#f59e0b;font-weight:600;}' +
      '.kfl-np-a{display:flex;flex-direction:column;gap:5px;flex-shrink:0;}' +
      '.kfl-np-btn{border:none;border-radius:8px;padding:7px 14px;font-size:.76rem;font-weight:700;cursor:pointer;font-family:inherit;white-space:nowrap;transition:opacity .15s;}' +
      '.kfl-np-y{background:#f59e0b;color:#1a0a00;}.kfl-np-y:hover{opacity:.88;}' +
      '.kfl-np-n{background:rgba(255,255,255,.07);color:var(--kfl-text-3,#4a5f7a);border:1px solid rgba(255,255,255,.07);}' +
      '.kfl-np-n:hover{background:rgba(255,255,255,.12);}' +
      '[data-theme="light"] .kfl-np-i{background:#fff;border-color:rgba(0,0,0,.08);}' +
      '[data-theme="light"] .kfl-np-t b{color:#0a0e1a;}' +
      '[data-theme="light"] .kfl-np-t span{color:#7a90b0;}' +
      '[data-theme="light"] .kfl-np-n{background:rgba(0,0,0,.05);border-color:rgba(0,0,0,.08);color:#7a90b0;}' +
      '#kfl-du{position:fixed;top:0;left:0;right:0;z-index:9500;background:linear-gradient(90deg,#dc2626,#ef4444);color:#fff;display:flex;align-items:center;gap:8px;padding:10px 14px;font-size:.8rem;font-weight:600;transform:translateY(-100%);transition:transform .3s cubic-bezier(.34,1.2,.64,1);font-family:"DM Sans",sans-serif;}' +
      '#kfl-du.v{transform:translateY(0);}' +
      '#kfl-du .ico{font-size:.9rem;flex-shrink:0;}' +
      '#kfl-du .msg{flex:1;}' +
      '#kfl-du .cta{color:#fff;font-weight:800;font-family:"Barlow Condensed",sans-serif;font-size:.82rem;letter-spacing:.5px;text-decoration:none;flex-shrink:0;background:rgba(0,0,0,.2);padding:4px 10px;border-radius:6px;}' +
      '#kfl-du .x{background:none;border:none;color:rgba(255,255,255,.7);cursor:pointer;font-size:.8rem;padding:4px;flex-shrink:0;transition:color .15s;}' +
      '#kfl-du .x:hover{color:#fff;}';
    document.head.appendChild(s);
  }

  /* ── Permission prompt ── */
  function showPrompt(gwName, dlStr, onYes, onNo) {
    if (document.getElementById('kfl-np')) return;
    css();
    var el = document.createElement('div');
    el.id = 'kfl-np';
    el.innerHTML =
      '<div class="kfl-np-i">' +
        '<div class="kfl-np-ico"><i class="fa-solid fa-bell"></i></div>' +
        '<div class="kfl-np-t">' +
          '<b>Never miss a deadline</b>' +
          '<span>Get alerts 24h &amp; 1h before ' + gwName + ' closes</span>' +
          '<span class="kfl-np-dl">' + dlStr + '</span>' +
        '</div>' +
        '<div class="kfl-np-a">' +
          '<button class="kfl-np-btn kfl-np-y" id="kfl-np-y">Allow</button>' +
          '<button class="kfl-np-btn kfl-np-n" id="kfl-np-n">Not now</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(el);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('v'); }); });

    var gone = false;
    function dismiss() {
      if (gone) return; gone = true;
      el.classList.remove('v');
      setTimeout(function () { el.parentNode && el.parentNode.removeChild(el); }, 380);
    }
    document.getElementById('kfl-np-y').onclick = function () { dismiss(); onYes(); };
    document.getElementById('kfl-np-n').onclick = function () { dismiss(); onNo(); };
    setTimeout(function () { if (!gone) { dismiss(); onNo(); } }, 12000);
  }

  /* ── System notification ── */
  function notify(title, body, url) {
    if (Notification.permission !== 'granted') return;
    url = url || '/';
    if (navigator.serviceWorker) {
      navigator.serviceWorker.ready.then(function (reg) {
        reg.showNotification(title, {
          body: body, icon: '/android-chrome-192x192.png',
          badge: '/android-chrome-192x192.png',
          vibrate: [200, 100, 200], tag: 'kfl-deadline', renotify: true,
          data: { url: url },
          actions: [{ action: 'open', title: 'Make transfers' }, { action: 'dismiss', title: 'Dismiss' }],
        });
      }).catch(function () { new Notification(title, { body: body, icon: '/android-chrome-192x192.png' }); });
    } else {
      new Notification(title, { body: body, icon: '/android-chrome-192x192.png' });
    }
  }

  /* ── 15-min in-app urgent banner ── */
  function urgentBanner(gwName) {
    if (document.getElementById('kfl-du')) return;
    css();
    var el = document.createElement('div');
    el.id = 'kfl-du';
    el.innerHTML =
      '<i class="fa-solid fa-circle-exclamation ico"></i>' +
      '<span class="msg"><b>15 minutes</b> to ' + gwName + ' deadline</span>' +
      '<a href="/transfers.html" class="cta">Transfers \u2192</a>' +
      '<button class="x" id="kfl-du-x" aria-label="Dismiss"><i class="fa-solid fa-xmark"></i></button>';
    document.body.insertBefore(el, document.body.firstChild);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('v'); }); });
    function close() {
      el.classList.remove('v');
      setTimeout(function () { el.parentNode && el.parentNode.removeChild(el); }, 300);
    }
    document.getElementById('kfl-du-x').onclick = close;
    setTimeout(close, 30000);
  }

  /* ── Schedule all three alerts ── */
  function schedule(info) {
    var now = Date.now();
    var dl  = info.deadline;

    var ms24 = dl - now - 86400000;
    var ms1  = dl - now -  3600000;
    var ms15 = dl - now -   900000;

    if (ms24 > 0) {
      setTimeout(function () {
        notify('\u23F0 ' + info.gwName + ' deadline tomorrow',
               'Make your transfers before ' + info.deadlineStr + '. 24 hours to go.',
               '/transfers.html');
      }, ms24);
    }
    if (ms1 > 0) {
      setTimeout(function () {
        buzz();
        notify('\uD83D\uDEA8 1 hour to ' + info.gwName + ' deadline!',
               info.deadlineStr + ' \u2014 lock in your captain and transfers now.',
               '/transfers.html');
      }, ms1);
    }
    if (ms15 > 0) {
      setTimeout(function () { buzz(); urgentBanner(info.gwName); }, ms15);
    }

    info.scheduled = true;
    setStored(info);
    console.log('[DeadlineNotify] Alerts scheduled for', info.gwName, '@', info.deadlineStr);
  }

  /* ── Boot ── */
  async function init() {
    if (!window.Notification) return;

    if (Notification.permission === 'granted') {
      var info = await fetchNextDeadline();
      if (!info) return;
      var s = getStored();
      if (!s || s.gwId !== info.gwId || !s.scheduled) schedule(info);
      return;
    }

    if (Notification.permission === 'denied') return;

    var lastAsked = parseInt(localStorage.getItem(PERM_KEY) || '0', 10);
    if (Date.now() - lastAsked < 604800000) return; // 7 days

    var info = await fetchNextDeadline();
    if (!info) return;
    if (info.deadline - Date.now() < 7200000) return; // < 2h, skip

    setTimeout(function () {
      showPrompt(info.gwName, info.deadlineStr,
        async function () {
          var r = await Notification.requestPermission();
          localStorage.setItem(PERM_KEY, Date.now().toString());
          if (r === 'granted') schedule(info);
        },
        function () { localStorage.setItem(PERM_KEY, Date.now().toString()); }
      );
    }, 3000);
  }

  window.addEventListener('kopala:bootstrap-updated', function () {
    if (Notification.permission !== 'granted') return;
    fetchNextDeadline().then(function (info) {
      if (!info) return;
      var s = getStored();
      if (!s || s.gwId !== info.gwId) schedule(info);
    });
  });

  document.readyState === 'loading'
    ? document.addEventListener('DOMContentLoaded', init)
    : init();

  /* ── Public API ── */
  window.KopalaNotify = {
    prompt: async function () {
      var info = await fetchNextDeadline();
      if (!info) return;
      showPrompt(info.gwName, info.deadlineStr,
        async function () { var r = await Notification.requestPermission(); if (r === 'granted') schedule(info); },
        function () {}
      );
    },
    test24h: function () {
      notify('\u23F0 GW Test deadline tomorrow',
             'Make your transfers before Fri 14 Mar, 18:30. 24 hours to go.',
             '/transfers.html');
    },
    test1h: function () {
      buzz();
      notify('\uD83D\uDEA8 1 hour to GW Test deadline!',
             'Fri 14 Mar, 18:30 \u2014 lock in your captain and transfers now.',
             '/transfers.html');
    },
    test15m: function () { buzz(); urgentBanner('GW Test'); },
    status: function () { return window.Notification ? Notification.permission : 'unsupported'; },
  };

})();
