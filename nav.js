/* ============================================================
   KOPALA FPL — NAVIGATION MODULE  v3
   Topbar  : logo LEFT · page name CENTER · ⋮ RIGHT (no bell)
   Dropdown: drops from topbar · 2-col page grid · settings accordion
   Settings: Notifications toggle · Theme · Change ID · Support · Logout
   ============================================================ */

(function () {
  'use strict';

  const NAV_LINKS = [
    { href: 'index.html',      label: 'Home',    icon: 'fa-house' },
    { href: 'leagues.html',    label: 'Leagues', icon: 'fa-trophy' },
    { href: 'prices.html',     label: 'Prices',  icon: 'fa-arrow-trend-up' },
    { href: 'games.html',      label: 'Live',    icon: 'fa-futbol', live: true },
   
  ];

  const MENU_LINKS = [
    { href: 'index.html',      label: 'Home',    icon: 'fa-house' },
    { href: 'leagues.html',    label: 'Leagues', icon: 'fa-trophy' },
    { href: 'prices.html',     label: 'Prices',  icon: 'fa-arrow-trend-up' },
    { href: 'games.html',      label: 'Live',    icon: 'fa-futbol',        live: true },
    
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
  function getActiveLabel() {
    const a = NAV_LINKS.find(l => isActive(l.href));
    return a ? a.label : '';
  }
  function notifGranted() {
    return window.Notification && Notification.permission === 'granted';
  }

  /* ── INJECTED STYLES ── */
  function injectStyles() {
    if (document.getElementById('kfl-nav-v3-styles')) return;
    const s = document.createElement('style');
    s.id = 'kfl-nav-v3-styles';
    s.textContent = `
      /* ── Page nav rows ── */
      .kfl-dd-nav-list { list-style: none; margin: 0; padding: 0 0 2px; }
      .kfl-dd-nav-item {
        display: flex; align-items: center; gap: 14px;
        padding: 0 18px; height: 52px;
        text-decoration: none; color: var(--text-1);
        font-family: var(--kfl-font); font-size: 15px; font-weight: 500;
        cursor: pointer; -webkit-tap-highlight-color: transparent;
        touch-action: manipulation; position: relative;
        transition: background .12s ease;
      }
      .kfl-dd-nav-item:active { background: var(--hover-bg); }
      .kfl-dd-nav-item.is-active { color: var(--accent); font-weight: 600; }
      .kfl-dd-nav-item.is-active::before {
        content: ''; position: absolute; left: 0; top: 10px; bottom: 10px;
        width: 3px; border-radius: 0 3px 3px 0;
        background: var(--accent); box-shadow: 1px 0 8px var(--accent-glow);
      }
      .kfl-dd-nav-item__icon {
        width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
        display: flex; align-items: center; justify-content: center;
        font-size: 15px; color: var(--text-2);
        background: var(--surface-2); border: 1px solid var(--border);
        transition: background .12s ease, color .12s ease;
      }
      .kfl-dd-nav-item.is-active .kfl-dd-nav-item__icon {
        background: var(--accent-dim); color: var(--accent); border-color: var(--accent-glow);
      }
      .kfl-dd-nav-item__label { flex: 1; }
      .kfl-dd-nav-item__right { display: flex; align-items: center; gap: 8px; flex-shrink: 0; }
      .kfl-dd-nav-item__check { font-size: 12px; color: var(--accent); opacity: 0.9; }
      .kfl-dd-nav-item__live {
        display: flex; align-items: center; gap: 4px;
        font-size: 9px; font-weight: 800; letter-spacing: 0.5px;
        text-transform: uppercase; color: var(--pink);
        background: var(--pink-dim); border: 1px solid rgba(255,51,82,.2);
        border-radius: 100px; padding: 3px 7px 3px 5px; line-height: 1;
      }
      .kfl-dd-nav-item__live-dot {
        width: 5px; height: 5px; border-radius: 50%;
        background: var(--pink); flex-shrink: 0;
        animation: livepulse 1.8s ease-in-out infinite;
      }

      /* Dropdown header */
      .kfl-dropdown__header {
        display: flex; align-items: center; justify-content: space-between;
        padding: 16px 18px 10px;
      }
      .kfl-dropdown__header-title {
        font-size: 11px; font-weight: 800; letter-spacing: 0.8px;
        text-transform: uppercase; color: var(--text-3);
      }
      .kfl-dropdown__close {
        display: flex; align-items: center; justify-content: center;
        width: 30px; height: 30px; border-radius: 8px;
        background: var(--surface-2); border: 1px solid var(--border-mid);
        color: var(--text-2); font-size: 14px;
        cursor: pointer; touch-action: manipulation;
        -webkit-tap-highlight-color: transparent;
        transition: background .13s ease, color .13s ease, transform .1s ease;
      }
      .kfl-dropdown__close:active { transform: scale(0.86); }

      /* Section label */
      .kfl-dd-section-label {
        font-size: 10px; font-weight: 800; letter-spacing: 1px;
        text-transform: uppercase; color: var(--text-3);
        padding: 14px 18px 6px; margin: 0;
      }

      /* Settings accordion toggle */
      .kfl-settings-toggle {
        display: flex; align-items: center; justify-content: space-between;
        width: 100%; padding: 14px 18px 6px;
        border: none; background: none; cursor: pointer;
        font-family: var(--kfl-font); text-align: left;
        -webkit-tap-highlight-color: transparent;
      }
      .kfl-settings-toggle__label {
        font-size: 10px; font-weight: 800; letter-spacing: 1px;
        text-transform: uppercase; color: var(--text-3);
      }
      .kfl-settings-toggle__chevron {
        display: flex; align-items: center; justify-content: center;
        width: 18px; height: 18px; color: var(--text-3); flex-shrink: 0;
        transition: transform .26s cubic-bezier(.4,0,.2,1), color .18s ease;
      }
      .kfl-settings-toggle__chevron svg { width: 11px; height: 11px; display: block; }
      .kfl-settings-toggle.is-open .kfl-settings-toggle__chevron {
        transform: rotate(180deg); color: var(--accent);
      }

      /* Settings body */
      .kfl-settings-body {
        overflow: hidden; max-height: 0; opacity: 0;
        transition: max-height .34s cubic-bezier(.4,0,.2,1), opacity .22s ease;
      }
      .kfl-settings-body.is-open { max-height: 600px; opacity: 1; }

      /* Setting rows */
      .kfl-setting-row {
        display: flex; align-items: center; gap: 13px;
        padding: 11px 18px; border: none; background: transparent;
        width: 100%; text-align: left; cursor: pointer;
        font-family: var(--kfl-font); text-decoration: none;
        color: var(--text-1); -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        transition: background .1s ease, transform .1s ease;
      }
      .kfl-setting-row:active { background: var(--hover-bg); transform: scale(0.99); }
      .kfl-setting-row--danger { color: var(--pink) !important; }
      .kfl-setting-row--danger:active { background: var(--pink-dim); }

      .kfl-setting-row__icon {
        width: 34px; height: 34px; border-radius: 9px;
        display: flex; align-items: center; justify-content: center;
        font-size: 15px; flex-shrink: 0;
        background: var(--surface-2); border: 1px solid var(--border);
        color: var(--text-2);
        transition: background .14s ease, color .14s ease;
      }
      .kfl-setting-row--danger .kfl-setting-row__icon {
        background: var(--pink-dim); border-color: rgba(255,51,82,.18);
        color: var(--pink);
      }
      .kfl-setting-row__body { flex: 1; min-width: 0; }
      .kfl-setting-row__title  { font-size: 14px; font-weight: 600; color: var(--text-1); line-height: 1.2; }
      .kfl-setting-row--danger .kfl-setting-row__title { color: var(--pink); }
      .kfl-setting-row__sub    { font-size: 11.5px; color: var(--text-3); margin-top: 1px; line-height: 1.3; }
      .kfl-setting-row__end    { flex-shrink: 0; }

      /* Theme badge */
      .kfl-setting-badge {
        font-size: 10px; font-weight: 700; padding: 3px 9px;
        border-radius: 100px; background: var(--surface-2);
        border: 1px solid var(--border-mid); color: var(--text-3);
      }

      /* Notification toggle switch */
      .kfl-toggle {
        position: relative; width: 40px; height: 22px;
        flex-shrink: 0; cursor: pointer;
      }
      .kfl-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
      .kfl-toggle__track {
        position: absolute; inset: 0; border-radius: 100px;
        background: var(--surface-3); border: 1px solid var(--border-mid);
        transition: background .22s ease, border-color .22s ease;
      }
      .kfl-toggle__thumb {
        position: absolute; top: 3px; left: 3px;
        width: 16px; height: 16px; border-radius: 50%;
        background: var(--text-3);
        box-shadow: 0 1px 4px rgba(0,0,0,.3);
        transition: transform .22s cubic-bezier(.34,1.56,.64,1), background .22s ease;
      }
      .kfl-toggle input:checked ~ .kfl-toggle__track {
        background: var(--accent); border-color: var(--accent);
      }
      .kfl-toggle input:checked ~ .kfl-toggle__thumb {
        transform: translateX(18px); background: #fff;
      }

      /* Ext icon */
      .kfl-setting-ext { font-size: 10px; color: var(--text-3); }

      /* Divider */
      .kfl-dd-divider { height: 1px; background: var(--border); margin: 6px 0; }

      /* Footer */
      .kfl-dd-footer {
        display: flex; align-items: center; gap: 6px;
        padding: 14px 18px 6px; font-size: 11px; color: var(--text-3); font-weight: 500;
      }
      .kfl-dd-footer-dot { opacity: 0.35; }

      @keyframes kflBellShake {
        0%,100%{transform:rotate(0)}20%{transform:rotate(-18deg)}
        40%{transform:rotate(16deg)}60%{transform:rotate(-12deg)}80%{transform:rotate(8deg)}
      }
    `;
    document.head.appendChild(s);
  }

  /* ── TOP BAR ── */
  function buildTopbar() {
    const activeLabel = getActiveLabel();
    const notifOn    = notifGranted();
    const t          = _theme;
    const themeEmoji = t === 'dark' ? '🌙' : '☀️';
    const themeTitle = t === 'dark' ? 'Dark mode'       : 'Light mode';
    const themeSub   = t === 'dark' ? 'Switch to light' : 'Switch to dark';
    const themeBadge = t === 'dark' ? 'Dark'            : 'Light';

    const topbar = `
      <header class="kfl-topbar" role="banner">
        <div class="kfl-topbar__inner">

          <a href="index.html" class="kfl-logo" aria-label="Kopala FPL — Home">
            <img src="/logo.png" alt="Kopala FPL" class="kfl-logo__img">
          </a>

          <div class="kfl-topbar__title" aria-live="polite">
            ${activeLabel ? `<span class="kfl-topbar__page-name">${activeLabel}</span>` : ''}
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
      <div class="kfl-dropdown" id="kfl-dropdown" role="dialog" aria-label="Menu" aria-hidden="true" inert>
        <div class="kfl-dropdown__inner">

          <!-- Header -->
          <div class="kfl-dropdown__header">
            <span class="kfl-dropdown__header-title">Menu</span>
            <button class="kfl-dropdown__close" id="kfl-dropdown-close" aria-label="Close menu">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <!-- Pages list -->
          <p class="kfl-dd-section-label">Pages</p>
          <nav aria-label="Pages">
            ${MENU_LINKS.map(l => `
              <a href="${l.href}"
                 class="kfl-dd-nav-item${isActive(l.href) ? ' is-active' : ''}"
                 ${isActive(l.href) ? 'aria-current="page"' : ''}>
                <div class="kfl-dd-nav-item__icon">
                  <i class="fa-solid ${l.icon}" aria-hidden="true"></i>
                </div>
                <span class="kfl-dd-nav-item__label">${l.label}</span>
                <div class="kfl-dd-nav-item__right">
                  ${l.live ? `<span class="kfl-dd-nav-item__live"><span class="kfl-dd-nav-item__live-dot"></span>Live</span>` : ''}
                  ${isActive(l.href) ? `<span class="kfl-dd-nav-item__check"><i class="fa-solid fa-check"></i></span>` : ''}
                </div>
              </a>`).join('')}
          </nav>

          <!-- Settings accordion -->
          <div class="kfl-dd-divider"></div>

          <button class="kfl-settings-toggle" id="kfl-settings-toggle"
                  aria-expanded="false" type="button">
            <span class="kfl-settings-toggle__label">Settings</span>
            <span class="kfl-settings-toggle__chevron" aria-hidden="true">
              <svg viewBox="0 0 11 11" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="2 3.5 5.5 7.5 9 3.5"/>
              </svg>
            </span>
          </button>

          <div class="kfl-settings-body" id="kfl-settings-body">

            <!-- Notifications -->
            <div class="kfl-setting-row" id="notif-row" tabindex="0" role="button" aria-label="Toggle notifications">
              <div class="kfl-setting-row__icon" style="background:var(--pink-dim);border-color:rgba(255,51,82,.18);color:var(--pink);">
                <i class="fa-solid fa-bell"></i>
              </div>
              <div class="kfl-setting-row__body">
                <div class="kfl-setting-row__title">Notifications</div>
                <div class="kfl-setting-row__sub" id="notif-sub">${notifOn ? 'Enabled — tap to manage' : 'Off — tap to enable'}</div>
              </div>
              <label class="kfl-toggle kfl-setting-row__end" aria-hidden="true">
                <input type="checkbox" id="notif-checkbox" ${notifOn ? 'checked' : ''} tabindex="-1">
                <span class="kfl-toggle__track"></span>
                <span class="kfl-toggle__thumb"></span>
              </label>
            </div>

            <!-- Theme -->
            <button class="kfl-setting-row" id="theme-toggle" type="button">
              <div class="kfl-setting-row__icon" style="background:var(--accent-dim);border-color:var(--accent-glow);color:var(--accent);">
                <span id="theme-emoji" style="font-size:16px;transition:opacity .13s,transform .13s;">${themeEmoji}</span>
              </div>
              <div class="kfl-setting-row__body">
                <div class="kfl-setting-row__title" id="theme-title">${themeTitle}</div>
                <div class="kfl-setting-row__sub"   id="theme-sub">${themeSub}</div>
              </div>
              <div class="kfl-setting-row__end">
                <span class="kfl-setting-badge" id="theme-badge">${themeBadge}</span>
              </div>
            </button>

            <!-- Change Team ID -->
            <button class="kfl-setting-row" id="change-id-btn" type="button">
              <div class="kfl-setting-row__icon">
                <i class="fa-solid fa-id-card"></i>
              </div>
              <div class="kfl-setting-row__body">
                <div class="kfl-setting-row__title">Team ID</div>
                <div class="kfl-setting-row__sub">Change your FPL team</div>
              </div>
            </button>

            <!-- Support -->
            <a href="https://wa.me/260978263899" class="kfl-setting-row"
               target="_blank" rel="noopener noreferrer">
              <div class="kfl-setting-row__icon" style="background:rgba(37,211,102,.1);border-color:rgba(37,211,102,.2);color:#25d366;">
                <i class="fa-brands fa-whatsapp"></i>
              </div>
              <div class="kfl-setting-row__body">
                <div class="kfl-setting-row__title">Contact &amp; Support</div>
                <div class="kfl-setting-row__sub">Chat with us on WhatsApp</div>
              </div>
              <div class="kfl-setting-row__end kfl-setting-ext">
                <i class="fa-solid fa-arrow-up-right-from-square"></i>
              </div>
            </a>

            <div class="kfl-dd-divider"></div>

            <!-- Log Out -->
            <button class="kfl-setting-row kfl-setting-row--danger" id="logout-btn" type="button">
              <div class="kfl-setting-row__icon">
                <i class="fa-solid fa-arrow-right-from-bracket"></i>
              </div>
              <div class="kfl-setting-row__body">
                <div class="kfl-setting-row__title">Log Out</div>
              </div>
            </button>

          </div><!-- /settings-body -->

          <div class="kfl-dd-footer">
            <span>Kopala FPL</span>
            <span class="kfl-dd-footer-dot">·</span>
            <span>🇿🇲</span>
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

  /* ── OVERLAY ── */
  function buildOverlay() {
    return `<div class="kfl-overlay" id="kfl-overlay" aria-hidden="true"></div>`;
  }

  /* ── THEME SETUP ── */
  function setupTheme() {
    const root = document.documentElement;
    const btn  = document.getElementById('theme-toggle');
    if (!btn) return;

    function applyThemeUI(t) {
      const map = {
        dark:  { emoji: '🌙', title: 'Dark mode',  sub: 'Switch to light', badge: 'Dark'  },
        light: { emoji: '☀️', title: 'Light mode', sub: 'Switch to dark',  badge: 'Light' },
      };
      const m = map[t];
      const el = id => document.getElementById(id);
      if (el('theme-title')) el('theme-title').textContent = m.title;
      if (el('theme-sub'))   el('theme-sub').textContent   = m.sub;
      if (el('theme-badge')) el('theme-badge').textContent = m.badge;
      const emoji = el('theme-emoji');
      if (emoji) {
        emoji.style.opacity = '0';
        emoji.style.transform = 'scale(0.4) rotate(-30deg)';
        setTimeout(() => {
          emoji.textContent = m.emoji;
          emoji.style.opacity = '1';
          emoji.style.transform = 'scale(1) rotate(0deg)';
        }, 130);
      }
    }

    btn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('kopala_theme', next);
      applyThemeUI(next);
    });
  }

  /* ── NOTIFICATIONS SETUP ── */
  function setupNotifications() {
    const row      = document.getElementById('notif-row');
    const checkbox = document.getElementById('notif-checkbox');
    const sub      = document.getElementById('notif-sub');
    if (!row) return;

    function updateUI(granted) {
      if (checkbox) checkbox.checked = granted;
      if (sub) sub.textContent = granted ? 'Enabled — tap to manage' : 'Off — tap to enable';
    }

    function handleTap() {
      if (!('Notification' in window)) {
        if (sub) sub.textContent = 'Not supported on this device';
        return;
      }
      if (Notification.permission === 'denied') {
        if (sub) sub.textContent = 'Blocked — enable in browser settings';
        updateUI(false); return;
      }
      if (Notification.permission === 'granted') {
        if (sub) sub.textContent = 'Enabled — manage in browser settings';
        updateUI(true); return;
      }
      Notification.requestPermission().then(p => {
        const ok = p === 'granted';
        updateUI(ok);
        if (ok && window.KopalaNotify?.prompt) window.KopalaNotify.prompt();
      });
    }

    row.addEventListener('click', handleTap);
    row.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTap(); }
    });

    // expose for dropdown open sync
    window._kflSyncNotifUI = () => updateUI(notifGranted());
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
    document.getElementById('kfl-dropdown-close')?.addEventListener('click', close);
    overlay?.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen) close(); });
    document.addEventListener('click', e => {
      if (isOpen && !dropdown.contains(e.target) && !dotsBtn.contains(e.target)) close();
    });

    document.getElementById('change-id-btn')?.addEventListener('click', () => { close(); changeTeamId(); });
    document.getElementById('logout-btn')?.addEventListener('click',    () => { close(); logout(); });
  }

  /* ── AUTH ── */
  const TEAM_ID_KEY = 'kopala_id';

  function isLoggedIn() {
    const id = localStorage.getItem(TEAM_ID_KEY);
    return id && id.trim() !== '';
  }
  function logout() { localStorage.removeItem(TEAM_ID_KEY); showLoginScreen(); }
  function changeTeamId() {
    showLoginScreen();
    const inp = document.getElementById('fpl-id-inp');
    const cur = localStorage.getItem(TEAM_ID_KEY);
    if (inp && cur) { inp.value = cur; inp.select(); }
  }
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
    document.querySelectorAll('.kfl-tab').forEach(tab => {
      const a = tab.getAttribute('href') === page;
      tab.classList.toggle('is-active', a);
      a ? tab.setAttribute('aria-current', 'page') : tab.removeAttribute('aria-current');
    });
    document.querySelectorAll('.kfl-dd-nav-item').forEach(item => {
      const a = item.getAttribute('href') === page;
      item.classList.toggle('is-active', a);
      a ? item.setAttribute('aria-current', 'page') : item.removeAttribute('aria-current');
    });
    const t = document.querySelector('.kfl-topbar__page-name');
    if (t) t.textContent = getActiveLabel();
  }
  function setupTurboSync() {
    document.addEventListener('kopala:page-changed', syncActiveState);
  }

  /* ── AUTH GATE ── */
  function setupAuthGate() {
    if (!isLoggedIn()) showLoginScreen();

    document.querySelectorAll('.kfl-tab').forEach(tab => {
      tab.addEventListener('click', e => {
        if (!isLoggedIn()) {
          e.preventDefault(); e.stopImmediatePropagation();
          if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
          showLoginScreen();
        }
      }, true);
    });
    document.querySelectorAll('.kfl-dd-nav-item[href]').forEach(item => {
      item.addEventListener('click', e => {
        if (!isLoggedIn()) {
          e.preventDefault(); e.stopImmediatePropagation();
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
          href.startsWith('#') || href.startsWith('mailto:') ||
          link.target === '_blank') return;
      e.preventDefault(); e.stopImmediatePropagation();
      showLoginScreen();
    }, true);
  }

  /* ── BOTTOM NAV HAPTIC ── */
  function setupBottomNav() {
    document.querySelectorAll('.kfl-tab').forEach(item => {
      item.addEventListener('click', () => {
        if (navigator.vibrate) navigator.vibrate([6, 0, 12]);
      });
    });
  }

  /* ── SCROLL ── */
  function setupScroll() {
    const topbar = document.querySelector('.kfl-topbar');
    if (!topbar) return;
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          topbar.classList.toggle('is-scrolled', window.scrollY > 40);
          ticking = false;
        });
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
