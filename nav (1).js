/* ============================================================
   KOPALA FPL — NAVIGATION MODULE  v4
   Topbar  : logo LEFT · action chips CENTER · ⋮ RIGHT
   Dropdown: compact 260px · right-anchored · slides from topbar
   Bottom  : Home · Leagues · Prices · Live  (Stats removed)
   Settings: Notifications · Theme · Support · Log Out
   ============================================================ */

(function () {
  'use strict';

  /* Pages — Stats removed */
  const NAV_LINKS = [
    { href: 'index.html',   label: 'Home',    icon: 'fa-house' },
    { href: 'leagues.html', label: 'Leagues', icon: 'fa-trophy' },
    { href: 'prices.html',  label: 'Prices',  icon: 'fa-arrow-trend-up' },
    { href: 'games.html',   label: 'Live',    icon: 'fa-futbol', live: true },
  ];

  const MENU_LINKS = [
    { href: 'index.html',   label: 'Home',    icon: 'fa-house' },
    { href: 'leagues.html', label: 'Leagues', icon: 'fa-trophy' },
    { href: 'prices.html',  label: 'Prices',  icon: 'fa-arrow-trend-up' },
    { href: 'games.html',   label: 'Live',    icon: 'fa-futbol', live: true },
  ];

  /* Center chips */
  const CHIPS = [
    { id: 'chip-search',    icon: 'fa-magnifying-glass', label: 'Search',    action: 'search'    },
    { id: 'chip-assistant', icon: 'fa-bolt',              label: 'Assistant', action: 'assistant' },
    { id: 'chip-watchlist', icon: 'fa-star',              label: 'Watchlist', action: 'watchlist' },
  ];

  /* ── THEME ── */
  function getInitialTheme() {
    const s = localStorage.getItem('kopala_theme');
    if (s === 'dark' || s === 'light') return s;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  const _theme = getInitialTheme();
  document.documentElement.setAttribute('data-theme', _theme);

  /* ── HELPERS ── */
  function currentPage() {
    const p = window.location.pathname.split('/').pop() || 'index.html';
    return p === '' ? 'index.html' : p;
  }
  function isActive(href)  { return href === currentPage(); }
  function notifGranted()  { return window.Notification && Notification.permission === 'granted'; }

  /* ── INJECTED STYLES ── */
  function injectStyles() {
    if (document.getElementById('kfl-nav-v4-styles')) return;
    const s = document.createElement('style');
    s.id = 'kfl-nav-v4-styles';
    s.textContent = `

      /* Center chips */
      .kfl-chips { display:flex; align-items:center; gap:6px; overflow:hidden; }
      .kfl-chip {
        display:flex; align-items:center; gap:5px;
        padding:0 10px; height:30px; border-radius:100px;
        border:1px solid var(--border-mid); background:var(--surface-2);
        color:var(--text-2); font-family:var(--kfl-font);
        font-size:12px; font-weight:600; white-space:nowrap;
        cursor:pointer; -webkit-tap-highlight-color:transparent;
        touch-action:manipulation;
        transition:background .14s ease,color .14s ease,border-color .14s ease,transform .1s ease;
      }
      .kfl-chip i { font-size:11px; }
      .kfl-chip:active,
      .kfl-chip.is-active {
        transform:scale(0.93);
        background:var(--accent-dim); border-color:var(--accent-glow); color:var(--accent);
      }
      @media (max-width:360px) {
        .kfl-chip span { display:none; }
        .kfl-chip { padding:0 9px; }
      }

      /* Compact dropdown */
      .kfl-dropdown {
        position:fixed;
        top:calc(var(--kfl-topbar-h) + 4px);
        right:10px; left:auto !important;
        width:252px; z-index:1300;
        background:var(--surface);
        border:1px solid var(--glass-border);
        border-radius:14px;
        box-shadow:0 8px 30px rgba(0,0,0,0.25), 0 2px 6px rgba(0,0,0,0.15);
        overflow:hidden;
        opacity:0; transform:translateY(-6px) scale(0.97);
        transform-origin:top right;
        pointer-events:none;
        transition:opacity .16s ease, transform .2s cubic-bezier(.22,1,.36,1);
        will-change:transform,opacity;
      }
      .kfl-dropdown.is-open {
        opacity:1; transform:translateY(0) scale(1); pointer-events:auto;
      }
      .kfl-dropdown__inner { padding:6px 0; }

      /* Nav rows */
      .kfl-dd-nav-item {
        display:flex; align-items:center; gap:11px;
        padding:0 14px; height:42px;
        text-decoration:none; color:var(--text-1);
        font-family:var(--kfl-font); font-size:14px; font-weight:500;
        cursor:pointer; -webkit-tap-highlight-color:transparent;
        touch-action:manipulation; position:relative;
        transition:background .1s ease;
      }
      .kfl-dd-nav-item:active { background:var(--hover-bg); }
      .kfl-dd-nav-item.is-active { color:var(--accent); font-weight:600; }
      .kfl-dd-nav-item__icon {
        font-size:13px; color:var(--text-3); width:16px;
        text-align:center; flex-shrink:0;
        transition:color .1s ease;
      }
      .kfl-dd-nav-item.is-active .kfl-dd-nav-item__icon { color:var(--accent); }
      .kfl-dd-nav-item__label { flex:1; }
      .kfl-dd-nav-item__right {
        display:flex; align-items:center; gap:7px; flex-shrink:0;
      }
      .kfl-dd-nav-item__check { font-size:11px; color:var(--accent); }
      .kfl-dd-nav-item__live {
        display:flex; align-items:center; gap:3px;
        font-size:8px; font-weight:800; letter-spacing:.4px;
        text-transform:uppercase; color:var(--pink);
        background:var(--pink-dim); border:1px solid rgba(255,51,82,.2);
        border-radius:100px; padding:2px 6px 2px 5px; line-height:1;
      }
      .kfl-dd-nav-item__live-dot {
        width:4px; height:4px; border-radius:50%;
        background:var(--pink); flex-shrink:0;
        animation:livepulse 1.8s ease-in-out infinite;
      }

      /* Settings accordion toggle */
      .kfl-settings-toggle {
        display:flex; align-items:center; gap:11px;
        padding:0 14px; height:42px; width:100%;
        border:none; background:none; cursor:pointer;
        font-family:var(--kfl-font); text-align:left; color:var(--text-1);
        -webkit-tap-highlight-color:transparent;
        transition:background .1s ease;
      }
      .kfl-settings-toggle:active { background:var(--hover-bg); }
      .kfl-settings-toggle__icon {
        font-size:13px; color:var(--text-3); width:16px; text-align:center; flex-shrink:0;
      }
      .kfl-settings-toggle__label { font-size:14px; font-weight:500; flex:1; }
      .kfl-settings-toggle__chevron {
        color:var(--text-3); flex-shrink:0; display:flex; align-items:center;
        transition:transform .2s cubic-bezier(.4,0,.2,1), color .15s ease;
      }
      .kfl-settings-toggle__chevron svg { width:12px; height:12px; display:block; }
      .kfl-settings-toggle.is-open .kfl-settings-toggle__chevron {
        transform:rotate(180deg); color:var(--accent);
      }

      /* Settings body */
      .kfl-settings-body {
        overflow:hidden; max-height:0; opacity:0;
        transition:max-height .26s cubic-bezier(.4,0,.2,1), opacity .18s ease;
      }
      .kfl-settings-body.is-open { max-height:400px; opacity:1; }

      /* Setting rows */
      .kfl-setting-row {
        display:flex; align-items:center; gap:11px;
        padding:0 14px; height:42px;
        border:none; background:transparent; width:100%;
        text-align:left; cursor:pointer;
        font-family:var(--kfl-font); text-decoration:none; color:var(--text-1);
        -webkit-tap-highlight-color:transparent; touch-action:manipulation;
        transition:background .1s ease;
      }
      .kfl-setting-row:active { background:var(--hover-bg); }
      .kfl-setting-row--danger { color:var(--pink) !important; }
      .kfl-setting-row--danger:active { background:var(--pink-dim); }
      .kfl-setting-row__icon {
        font-size:13px; color:var(--text-3); width:16px; text-align:center; flex-shrink:0;
      }
      .kfl-setting-row--danger .kfl-setting-row__icon { color:var(--pink); }
      .kfl-setting-row__label { flex:1; font-size:14px; font-weight:500; }
      .kfl-setting-row--danger .kfl-setting-row__label { color:var(--pink); }
      .kfl-setting-row__end { flex-shrink:0; display:flex; align-items:center; gap:6px; }

      /* Toggle switch */
      .kfl-toggle { position:relative; width:34px; height:19px; flex-shrink:0; cursor:pointer; }
      .kfl-toggle input { opacity:0; width:0; height:0; position:absolute; }
      .kfl-toggle__track {
        position:absolute; inset:0; border-radius:100px;
        background:var(--surface-3); border:1px solid var(--border-mid);
        transition:background .18s ease, border-color .18s ease;
      }
      .kfl-toggle__thumb {
        position:absolute; top:3px; left:3px;
        width:13px; height:13px; border-radius:50%;
        background:var(--text-3); box-shadow:0 1px 3px rgba(0,0,0,.3);
        transition:transform .2s cubic-bezier(.34,1.56,.64,1), background .18s ease;
      }
      .kfl-toggle input:checked ~ .kfl-toggle__track { background:var(--accent); border-color:var(--accent); }
      .kfl-toggle input:checked ~ .kfl-toggle__thumb { transform:translateX(15px); background:#fff; }

      /* Theme badge */
      .kfl-setting-badge {
        font-size:10px; font-weight:600; padding:2px 7px;
        border-radius:100px; background:var(--surface-2);
        border:1px solid var(--border-mid); color:var(--text-3);
      }
      .kfl-setting-ext { font-size:10px; color:var(--text-3); }

      /* Divider */
      .kfl-dd-divider { height:1px; background:var(--border); margin:5px 0; }

      /* Footer */
      .kfl-dd-footer {
        display:flex; align-items:center; justify-content:center; gap:5px;
        padding:6px 14px 4px; font-size:10.5px; color:var(--text-3); font-weight:500;
      }
      .kfl-dd-footer-dot { opacity:0.35; }
    `;
    document.head.appendChild(s);
  }

  /* ── TOP BAR ── */
  function buildTopbar() {
    const notifOn    = notifGranted();
    const t          = _theme;
    const themeEmoji = t === 'dark' ? '🌙' : '☀️';
    const themeTitle = t === 'dark' ? 'Dark mode'  : 'Light mode';
    const themeBadge = t === 'dark' ? 'Dark'        : 'Light';

    const topbar = `
      <header class="kfl-topbar" role="banner">
        <div class="kfl-topbar__inner">

          <a href="index.html" class="kfl-logo" aria-label="Kopala FPL — Home">
            <img src="/logo.png" alt="Kopala FPL" class="kfl-logo__img">
          </a>

          <div class="kfl-chips" role="toolbar" aria-label="Quick actions">
            ${CHIPS.map(c => `
              <button class="kfl-chip" id="${c.id}" data-action="${c.action}"
                      aria-label="${c.label}" type="button">
                <i class="fa-solid ${c.icon}" aria-hidden="true"></i>
                <span>${c.label}</span>
              </button>`).join('')}
          </div>

          <div class="kfl-topbar__right">
            <button class="kfl-icon-btn kfl-dots-btn"
                    id="dots-btn"
                    aria-label="Open menu"
                    aria-expanded="false"
                    aria-haspopup="true">
              <span class="kfl-dots" aria-hidden="true">
                <span></span><span></span><span></span>
              </span>
            </button>
          </div>

        </div>
      </header>`;

    const dropdown = `
      <div class="kfl-dropdown" id="kfl-dropdown" role="menu" aria-hidden="true" inert>
        <div class="kfl-dropdown__inner">

          ${MENU_LINKS.map(l => `
            <a href="${l.href}"
               class="kfl-dd-nav-item${isActive(l.href) ? ' is-active' : ''}"
               role="menuitem"
               ${isActive(l.href) ? 'aria-current="page"' : ''}>
              <span class="kfl-dd-nav-item__icon">
                <i class="fa-solid ${l.icon}" aria-hidden="true"></i>
              </span>
              <span class="kfl-dd-nav-item__label">${l.label}</span>
              <div class="kfl-dd-nav-item__right">
                ${l.live ? `<span class="kfl-dd-nav-item__live"><span class="kfl-dd-nav-item__live-dot"></span>Live</span>` : ''}
                ${isActive(l.href) ? `<span class="kfl-dd-nav-item__check"><i class="fa-solid fa-check"></i></span>` : ''}
              </div>
            </a>`).join('')}

          <div class="kfl-dd-divider"></div>

          <button class="kfl-settings-toggle" id="kfl-settings-toggle"
                  aria-expanded="false" type="button">
            <span class="kfl-settings-toggle__icon">
              <i class="fa-solid fa-gear" aria-hidden="true"></i>
            </span>
            <span class="kfl-settings-toggle__label">Settings</span>
            <span class="kfl-settings-toggle__chevron" aria-hidden="true">
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="2 4 6 8 10 4"/>
              </svg>
            </span>
          </button>

          <div class="kfl-settings-body" id="kfl-settings-body">

            <div class="kfl-setting-row" id="notif-row"
                 tabindex="0" role="button" aria-label="Toggle notifications">
              <span class="kfl-setting-row__icon"><i class="fa-solid fa-bell"></i></span>
              <span class="kfl-setting-row__label">Notifications</span>
              <div class="kfl-setting-row__end">
                <label class="kfl-toggle" aria-hidden="true">
                  <input type="checkbox" id="notif-checkbox" ${notifOn ? 'checked' : ''} tabindex="-1">
                  <span class="kfl-toggle__track"></span>
                  <span class="kfl-toggle__thumb"></span>
                </label>
              </div>
            </div>

            <button class="kfl-setting-row" id="theme-toggle" type="button">
              <span class="kfl-setting-row__icon">
                <span id="theme-emoji" style="font-size:13px;transition:opacity .12s,transform .12s;">${themeEmoji}</span>
              </span>
              <span class="kfl-setting-row__label" id="theme-title">${themeTitle}</span>
              <div class="kfl-setting-row__end">
                <span class="kfl-setting-badge" id="theme-badge">${themeBadge}</span>
              </div>
            </button>

            <a href="https://wa.me/260978263899" class="kfl-setting-row"
               role="menuitem" target="_blank" rel="noopener noreferrer">
              <span class="kfl-setting-row__icon" style="color:#25d366;">
                <i class="fa-brands fa-whatsapp"></i>
              </span>
              <span class="kfl-setting-row__label">Contact &amp; Support</span>
              <div class="kfl-setting-row__end kfl-setting-ext">
                <i class="fa-solid fa-arrow-up-right-from-square"></i>
              </div>
            </a>

          </div>

          <div class="kfl-dd-divider"></div>

          <button class="kfl-setting-row kfl-setting-row--danger" id="logout-btn"
                  role="menuitem" type="button">
            <span class="kfl-setting-row__icon">
              <i class="fa-solid fa-arrow-right-from-bracket"></i>
            </span>
            <span class="kfl-setting-row__label">Log Out</span>
          </button>

          <div class="kfl-dd-footer">
            <span>Kopala FPL</span>
            <span class="kfl-dd-footer-dot">·</span>
            <span>Built for Zambians 🇿🇲</span>
          </div>

        </div>
      </div>`;

    return topbar + dropdown;
  }

  /* ── BOTTOM NAV ── */
  function buildBottomNav() {
    const items = NAV_LINKS.map(l => `
      <a href="${l.href}"
         class="kfl-tab${isActive(l.href) ? ' is-active' : ''}${l.live ? ' kfl-tab--live' : ''}"
         ${isActive(l.href) ? 'aria-current="page"' : ''}
         aria-label="${l.label}">
        <div class="kfl-tab__pill">
          <i class="fa-solid ${l.icon}" aria-hidden="true"></i>
        </div>
        <span class="kfl-tab__label">${l.label}</span>
      </a>`).join('');
    return `
      <nav class="kfl-bottom-nav" aria-label="Bottom navigation">
        <div class="kfl-bottom-nav__inner">${items}</div>
      </nav>`;
  }

  function buildOverlay() {
    return `<div class="kfl-overlay" id="kfl-overlay" aria-hidden="true"></div>`;
  }

  /* ── THEME ── */
  function setupTheme() {
    const root = document.documentElement;
    const btn  = document.getElementById('theme-toggle');
    if (!btn) return;
    function applyThemeUI(t) {
      const map = {
        dark:  { emoji:'🌙', title:'Dark mode',  badge:'Dark'  },
        light: { emoji:'☀️', title:'Light mode', badge:'Light' },
      };
      const m = map[t];
      const el = id => document.getElementById(id);
      if (el('theme-title')) el('theme-title').textContent = m.title;
      if (el('theme-badge')) el('theme-badge').textContent = m.badge;
      const emoji = el('theme-emoji');
      if (emoji) {
        emoji.style.opacity = '0'; emoji.style.transform = 'scale(0.3) rotate(-20deg)';
        setTimeout(() => { emoji.textContent = m.emoji; emoji.style.opacity = '1'; emoji.style.transform = 'scale(1) rotate(0)'; }, 120);
      }
    }
    btn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('kopala_theme', next);
      applyThemeUI(next);
    });
  }

  /* ── NOTIFICATIONS ── */
  function setupNotifications() {
    const row = document.getElementById('notif-row');
    const checkbox = document.getElementById('notif-checkbox');
    if (!row) return;
    function updateUI(ok) { if (checkbox) checkbox.checked = ok; }
    function handleTap() {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'denied')  { updateUI(false); return; }
      if (Notification.permission === 'granted') { updateUI(true);  return; }
      Notification.requestPermission().then(p => {
        const ok = p === 'granted';
        updateUI(ok);
        if (ok && window.KopalaNotify?.prompt) window.KopalaNotify.prompt();
      });
    }
    row.addEventListener('click', handleTap);
    row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTap(); } });
    window._kflSyncNotifUI = () => updateUI(notifGranted());
  }

  /* ── CHIPS ── */
  function setupChips() {
    document.querySelectorAll('.kfl-chip').forEach(chip => {
      chip.addEventListener('click', () => {
        const action = chip.dataset.action;
        if (navigator.vibrate) navigator.vibrate(6);
        document.dispatchEvent(new CustomEvent('kopala:chip', { detail: { action } }));
        chip.classList.add('is-active');
        setTimeout(() => chip.classList.remove('is-active'), 350);
      });
    });
  }

  /* ── SETTINGS ACCORDION ── */
  function setupSettingsAccordion() {
    const toggle = document.getElementById('kfl-settings-toggle');
    const body   = document.getElementById('kfl-settings-body');
    if (!toggle || !body) return;
    toggle.addEventListener('click', () => {
      const open = toggle.classList.toggle('is-open');
      body.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  /* ── DROPDOWN ── */
  function setupDropdown() {
    const dotsBtn  = document.getElementById('dots-btn');
    const dropdown = document.getElementById('kfl-dropdown');
    const overlay  = document.getElementById('kfl-overlay');
    if (!dotsBtn || !dropdown) return;
    let isOpen = false;

    function open() {
      isOpen = true;
      window._kflSyncNotifUI?.();
      dropdown.classList.add('is-open');
      overlay?.classList.add('is-open');
      dropdown.removeAttribute('inert');
      dropdown.removeAttribute('aria-hidden');
      dotsBtn.setAttribute('aria-expanded', 'true');
      dotsBtn.classList.add('is-active');
    }
    function close() {
      isOpen = false;
      dropdown.classList.remove('is-open');
      overlay?.classList.remove('is-open');
      dropdown.setAttribute('inert', '');
      dropdown.setAttribute('aria-hidden', 'true');
      dotsBtn.setAttribute('aria-expanded', 'false');
      dotsBtn.classList.remove('is-active');
      dotsBtn.focus();
    }

    dotsBtn.addEventListener('click', e => { e.stopPropagation(); isOpen ? close() : open(); });
    overlay?.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen) close(); });
    document.addEventListener('click', e => {
      if (isOpen && !dropdown.contains(e.target) && !dotsBtn.contains(e.target)) close();
    });
    document.getElementById('logout-btn')?.addEventListener('click', () => { close(); logout(); });
  }

  /* ── AUTH ── */
  const TEAM_ID_KEY = 'kopala_id';
  function isLoggedIn() { const id = localStorage.getItem(TEAM_ID_KEY); return id && id.trim() !== ''; }
  function logout() { localStorage.removeItem(TEAM_ID_KEY); showLoginScreen(); }
  function showLoginScreen() {
    const ls = document.getElementById('login-screen');
    if (!ls) return;
    ls.style.display = 'flex';
    const inp = document.getElementById('fpl-id-inp');
    const err = document.getElementById('err-msg');
    if (inp) inp.classList.remove('error');
    if (err) { err.style.display = 'none'; err.textContent = ''; }
    setTimeout(() => inp?.focus(), 100);
  }

  /* ── ACTIVE SYNC ── */
  function syncActiveState() {
    const page = currentPage();
    document.querySelectorAll('.kfl-tab, .kfl-dd-nav-item').forEach(el => {
      const a = el.getAttribute('href') === page;
      el.classList.toggle('is-active', a);
      a ? el.setAttribute('aria-current', 'page') : el.removeAttribute('aria-current');
    });
  }
  function setupTurboSync() { document.addEventListener('kopala:page-changed', syncActiveState); }

  /* ── AUTH GATE ── */
  function setupAuthGate() {
    if (!isLoggedIn()) showLoginScreen();
    document.querySelectorAll('.kfl-tab, .kfl-dd-nav-item').forEach(el => {
      el.addEventListener('click', e => {
        if (!isLoggedIn()) {
          e.preventDefault(); e.stopImmediatePropagation();
          if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
          showLoginScreen();
        }
      }, true);
    });
    document.addEventListener('click', e => {
      if (isLoggedIn()) return;
      const link = e.target.closest('a[href]');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('//') ||
          href.startsWith('#') || href.startsWith('mailto:') || link.target === '_blank') return;
      e.preventDefault(); e.stopImmediatePropagation();
      showLoginScreen();
    }, true);
  }

  /* ── BOTTOM NAV HAPTIC ── */
  function setupBottomNav() {
    document.querySelectorAll('.kfl-tab').forEach(item => {
      item.addEventListener('click', () => { if (navigator.vibrate) navigator.vibrate([6, 0, 12]); });
    });
  }

  /* ── SCROLL ── */
  function setupScroll() {
    const topbar = document.querySelector('.kfl-topbar');
    if (!topbar) return;
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => { topbar.classList.toggle('is-scrolled', window.scrollY > 40); ticking = false; });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ── INIT ── */
  function loadNav() {
    injectStyles();
    const topbarTarget  = document.getElementById('kfl-topbar-mount');
    const bottomTarget  = document.getElementById('kfl-bottom-nav-mount');
    const overlayTarget = document.getElementById('kfl-overlay-mount');

    if (topbarTarget)  topbarTarget.outerHTML  = buildTopbar();
    if (bottomTarget)  bottomTarget.outerHTML  = buildBottomNav();
    if (overlayTarget) overlayTarget.outerHTML = buildOverlay();

    if (!topbarTarget && !bottomTarget) {
      document.body.insertAdjacentHTML('afterbegin', buildOverlay() + buildTopbar());
      document.body.insertAdjacentHTML('beforeend',  buildBottomNav());
    }

    setupTheme();
    setupNotifications();
    setupChips();
    setupSettingsAccordion();
    setupDropdown();
    setupBottomNav();
    setupScroll();
    setupAuthGate();
    setupTurboSync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNav);
  } else {
    loadNav();
  }

})();
