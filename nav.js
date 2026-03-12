/* ============================================================
   KOPALA FPL — NAVIGATION MODULE  v5
   Topbar  : logo LEFT · icons RIGHT (no center content)
   Menu    : full-screen overlay · large bold links · X top-right
   Style   : Apple.com mobile nav
   Bottom  : Home · Leagues · Prices · Live
   ============================================================ */

(function () {
  'use strict';

  const NAV_LINKS = [
    { href: 'index.html',   label: 'Home',    icon: 'home' },
    { href: 'leagues.html', label: 'Leagues', icon: 'emoji_events' },
    { href: 'prices.html',  label: 'Prices',  icon: 'trending_up' },
    { href: 'games.html',   label: 'Live',    icon: 'sports_soccer', live: true },
  ];

  const MENU_LINKS = [
    { href: 'index.html',   label: 'Home'    },
    { href: 'leagues.html', label: 'Leagues' },
    { href: 'prices.html',  label: 'Prices'  },
    { href: 'games.html',   label: 'Live',   live: true },
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
  function isActive(href) { return href === currentPage(); }
  function notifGranted() { return window.Notification && Notification.permission === 'granted'; }

  /* ── META THEME-COLOR (status bar matches nav) ── */
  function injectThemeColorMeta() {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    function sync() {
      const dark = document.documentElement.getAttribute('data-theme') !== 'light';
      meta.content = dark ? '#060810' : '#ffffff';
    }
    sync();
    // Re-sync whenever theme changes
    new MutationObserver(sync).observe(document.documentElement, {
      attributes: true, attributeFilter: ['data-theme']
    });
  }

  /* ── INJECTED STYLES ── */
  function injectStyles() {
    if (document.getElementById('kfl-nav-v5-styles')) return;
    /* ── Load Material Symbols Rounded variable font ── */
    if (!document.getElementById('kfl-material-symbols')) {
      const link = document.createElement('link');
      link.id   = 'kfl-material-symbols';
      link.rel  = 'stylesheet';
      link.href = 'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=swap';
      document.head.appendChild(link);
    }
    const s = document.createElement('style');
    s.id = 'kfl-nav-v5-styles';
    s.textContent = `

      /* ── Full-screen overlay ── */
      .kfl-overlay-menu {
        position: fixed; inset: 0; z-index: 1400;
        background: var(--surface);
        display: flex; flex-direction: column;
        overflow-y: auto; overflow-x: hidden;
        opacity: 0; transform: translateY(-100%);
        pointer-events: none;
        transition: opacity 0.28s cubic-bezier(0.22,1,0.36,1),
                    transform 0.32s cubic-bezier(0.22,1,0.36,1);
        will-change: transform, opacity;
      }
      .kfl-overlay-menu.is-open {
        opacity: 1; transform: translateY(0); pointer-events: auto;
      }

      /* Close bar */
      .kfl-overlay-menu__bar {
        display: flex; align-items: center; justify-content: flex-end;
        height: var(--kfl-topbar-h); padding: 0 18px; flex-shrink: 0;
      }
      .kfl-overlay-menu__close {
        display: flex; align-items: center; justify-content: center;
        width: 36px; height: 36px; background: none; border: none;
        color: var(--text-1); font-size: 22px; cursor: pointer;
        -webkit-tap-highlight-color: transparent; touch-action: manipulation;
        transition: opacity 0.15s ease, transform 0.12s ease;
      }
      .kfl-overlay-menu__close:active { opacity: 0.5; transform: scale(0.85); }

      /* Body scroll container */
      .kfl-overlay-menu__body {
        flex: 1; padding: 8px 24px 48px; display: flex; flex-direction: column;
      }

      /* ── Every link/button in the menu — same size ── */
      .kfl-overlay-link {
        display: flex; align-items: center; justify-content: space-between;
        padding: 13px 0;
        text-decoration: none;
        color: var(--text-1);
        font-family: var(--kfl-font);
        font-size: 28px; font-weight: 700; letter-spacing: -0.5px; line-height: 1.15;
        border-bottom: none;
        -webkit-tap-highlight-color: transparent; touch-action: manipulation;
        transition: opacity 0.14s ease, color 0.14s ease;
        cursor: pointer;
      }
      .kfl-overlay-link:last-child { border-bottom: none; }
      .kfl-overlay-link:active { opacity: 0.5; }
      .kfl-overlay-link.is-active { color: var(--accent); }

      /* Button reset for Settings / Logout */
      .kfl-overlay-link--btn {
        width: 100%; background: none; border-top: none; border-left: none;
        border-right: none; text-align: left;
      }
      .kfl-overlay-link--danger { color: var(--pink) !important; }
      .kfl-overlay-link--danger:active { opacity: 0.5; }

      /* Label span (so flex layout works with the right slot) */
      .kfl-overlay-link__label { flex: 1; }

      /* Right slot — live badge, check, chevron */
      .kfl-overlay-link__right {
        display: flex; align-items: center; gap: 10px; flex-shrink: 0;
      }
      .kfl-overlay-link__chevron {
        display: flex; align-items: center; color: var(--text-3); flex-shrink: 0;
        transition: transform 0.22s cubic-bezier(0.4,0,0.2,1), color 0.15s ease;
      }
      .kfl-overlay-link__chevron svg { width: 16px; height: 16px; display: block; }
      .kfl-overlay-link--btn.is-open .kfl-overlay-link__chevron {
        transform: rotate(180deg); color: var(--accent);
      }
      .kfl-overlay-link__live {
        display: flex; align-items: center; gap: 4px;
        font-size: 10px; font-weight: 800; letter-spacing: 0.4px;
        text-transform: uppercase; color: var(--pink);
        background: var(--pink-dim); border: 1px solid rgba(255,51,82,0.22);
        border-radius: 100px; padding: 3px 9px 3px 7px; line-height: 1;
      }
      .kfl-overlay-link__live-dot {
        width: 5px; height: 5px; border-radius: 50%;
        background: var(--pink); flex-shrink: 0;
        animation: livepulse 1.8s ease-in-out infinite;
      }
      .kfl-overlay-link__check { font-size: 16px; color: var(--accent); }

      /* Divider between pages and settings */
      .kfl-overlay-divider { height: 1px; background: var(--border); margin: 4px 0; }

      /* ── Settings sub-rows (accordion body) ── */
      .kfl-settings-body {
        overflow: hidden; max-height: 0; opacity: 0;
        transition: max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease;
      }
      .kfl-settings-body.is-open { max-height: 400px; opacity: 1; }

      .kfl-setting-row {
        display: flex; align-items: center;
        padding: 12px 0 12px 16px;
        border: none; background: transparent; width: 100%;
        text-align: left; cursor: pointer;
        font-family: var(--kfl-font); text-decoration: none; color: var(--text-2);
        -webkit-tap-highlight-color: transparent; touch-action: manipulation;
        transition: opacity 0.14s ease;
      }
      .kfl-setting-row:last-child { border-bottom: none; }
      .kfl-setting-row:active { opacity: 0.5; }
      .kfl-setting-row__label { flex: 1; font-size: 18px; font-weight: 600; }
      .kfl-setting-row__end { flex-shrink: 0; display: flex; align-items: center; gap: 8px; }

      /* Notification status text */
      .kfl-notif-status {
        font-size: 12px; font-weight: 600; color: var(--text-3);
        transition: color 0.2s ease;
      }

      /* Toggle */
      .kfl-toggle { position: relative; width: 38px; height: 22px; flex-shrink: 0; cursor: pointer; }
      .kfl-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
      .kfl-toggle__track {
        position: absolute; inset: 0; border-radius: 100px;
        background: var(--surface-3); border: 1px solid var(--border-mid);
        transition: background 0.18s ease, border-color 0.18s ease;
      }
      .kfl-toggle__thumb {
        position: absolute; top: 3px; left: 3px; width: 16px; height: 16px;
        border-radius: 50%; background: var(--text-3); box-shadow: 0 1px 3px rgba(0,0,0,.3);
        transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), background 0.18s ease;
      }
      .kfl-toggle input:checked ~ .kfl-toggle__track { background: var(--accent); border-color: var(--accent); }
      .kfl-toggle input:checked ~ .kfl-toggle__thumb { transform: translateX(16px); background: #fff; }

      /* Theme badge */
      .kfl-setting-badge {
        font-size: 11px; font-weight: 600; padding: 2px 8px;
        border-radius: 100px; background: var(--surface-2);
        border: 1px solid var(--border-mid); color: var(--text-3);
      }

      /* Footer */
      .kfl-overlay-footer {
        margin-top: auto; padding-top: 32px;
        display: flex; align-items: center; justify-content: center;
        flex-wrap: wrap; gap: 4px;
        font-size: 11px; font-weight: 500; color: var(--text-3);
      }
      .kfl-overlay-footer__dot { opacity: 0.4; }

      /* Staggered entrance */
      .kfl-overlay-menu.is-open .kfl-overlay-link {
        animation: kflLinkIn 0.3s cubic-bezier(0.22,1,0.36,1) both;
      }
      .kfl-overlay-menu.is-open .kfl-overlay-link:nth-child(1) { animation-delay: 0.03s; }
      .kfl-overlay-menu.is-open .kfl-overlay-link:nth-child(2) { animation-delay: 0.07s; }
      .kfl-overlay-menu.is-open .kfl-overlay-link:nth-child(3) { animation-delay: 0.11s; }
      .kfl-overlay-menu.is-open .kfl-overlay-link:nth-child(4) { animation-delay: 0.15s; }
      .kfl-overlay-menu.is-open .kfl-overlay-divider       { animation: kflLinkIn 0.3s cubic-bezier(0.22,1,0.36,1) 0.18s both; }
      .kfl-overlay-menu.is-open .kfl-overlay-link--btn:first-of-type { animation-delay: 0.21s; }
      .kfl-overlay-menu.is-open .kfl-overlay-link--danger  { animation-delay: 0.25s; }
      @keyframes kflLinkIn {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
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

          <!-- LEFT: Logo -->
          <a href="index.html" class="kfl-logo" aria-label="Kopala FPL — Home">
            <img src="/logo.png" alt="Kopala FPL" class="kfl-logo__img">
          </a>

          <!-- CENTER: desktop nav links (hidden on mobile via CSS) -->
          <div class="kfl-topbar__center">
          <nav class="kfl-desktop-links" aria-label="Main navigation">
            ${MENU_LINKS.map(l => `
              <a href="${l.href}"
                 class="kfl-desktop-link${isActive(l.href) ? ' is-active' : ''}"
                 ${isActive(l.href) ? 'aria-current="page"' : ''}>
                ${l.label}
              </a>`).join('')}
          </nav>
          </div>

          <!-- RIGHT: settings/auth buttons + mobile hamburger -->
          <div class="kfl-topbar__right">
            <!-- Mobile hamburger only — hidden on desktop -->
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

    /* Full-screen overlay — sibling of header */
    const overlay = `
      <div class="kfl-overlay-menu" id="kfl-overlay-menu" role="dialog"
           aria-label="Navigation menu" aria-hidden="true" inert>

        <!-- Top bar with X -->
        <div class="kfl-overlay-menu__bar">
          <button class="kfl-overlay-menu__close" id="kfl-menu-close" aria-label="Close menu">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>

        <!-- Unified list — all items same visual weight -->
        <div class="kfl-overlay-menu__body">

          <!-- Page links -->
          ${MENU_LINKS.map(l => `
            <a href="${l.href}"
               class="kfl-overlay-link${isActive(l.href) ? ' is-active' : ''}"
               ${isActive(l.href) ? 'aria-current="page"' : ''}>
              <span class="kfl-overlay-link__label">${l.label}</span>
              <div class="kfl-overlay-link__right">
                ${isActive(l.href) ? `<span class="kfl-overlay-link__check"><i class="fa-solid fa-check"></i></span>` : ''}
              </div>
            </a>`).join('')}

          <div class="kfl-overlay-divider"></div>

          <!-- Settings — same font, accordion -->
          <button class="kfl-overlay-link kfl-overlay-link--btn"
                  id="kfl-settings-toggle" aria-expanded="false" type="button">
            <span class="kfl-overlay-link__label">Settings</span>
            <span class="kfl-overlay-link__chevron" aria-hidden="true">
              <svg viewBox="0 0 13 13" fill="none" stroke="currentColor"
                   stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="2 4.5 6.5 9 11 4.5"/>
              </svg>
            </span>
          </button>

          <!-- Sub-rows (indented, slightly smaller) -->
          <div class="kfl-settings-body" id="kfl-settings-body">

            <div class="kfl-setting-row" id="notif-row"
                 tabindex="0" role="button" aria-label="Toggle notifications">
              <span class="kfl-setting-row__label">Notifications</span>
              <div class="kfl-setting-row__end">
                <span class="kfl-notif-status" id="notif-status"></span>
                <label class="kfl-toggle" aria-hidden="true">
                  <input type="checkbox" id="notif-checkbox" ${notifOn ? 'checked' : ''} tabindex="-1">
                  <span class="kfl-toggle__track"></span>
                  <span class="kfl-toggle__thumb"></span>
                </label>
              </div>
            </div>

            <button class="kfl-setting-row" id="theme-toggle" type="button">
              <span class="kfl-setting-row__label" id="theme-title">${themeTitle}</span>
              <div class="kfl-setting-row__end">
                <span id="theme-emoji" style="font-size:16px;transition:opacity .12s,transform .12s;">${themeEmoji}</span>
                <span class="kfl-setting-badge" id="theme-badge">${themeBadge}</span>
              </div>
            </button>

            <a href="https://wa.me/260978263899" class="kfl-setting-row"
               target="_blank" rel="noopener noreferrer">
              <span class="kfl-setting-row__label">Contact &amp; Support</span>
              <div class="kfl-setting-row__end">
                <i class="fa-solid fa-arrow-up-right-from-square" style="font-size:12px;color:var(--text-3);"></i>
              </div>
            </a>

          </div>

          <!-- Log Out — same size, red -->
          <button class="kfl-overlay-link kfl-overlay-link--btn kfl-overlay-link--danger"
                  id="logout-btn" type="button">
            <span class="kfl-overlay-link__label">Log Out</span>
          </button>

          <!-- Footer -->
          <div class="kfl-overlay-footer">
            <span>Kopala FPL</span>
            <span class="kfl-overlay-footer__dot">·</span>
            <span>v1.1</span>
            <span class="kfl-overlay-footer__dot">·</span>
            <span>Built for Zambians 🇿🇲</span>
          </div>

        </div>

      </div>`;

    return topbar + overlay;
  }

  /* ── BOTTOM NAV ── */
  function buildBottomNav() {
    const items = NAV_LINKS.map(l => `
      <a href="${l.href}"
         class="kfl-tab${isActive(l.href) ? ' is-active' : ''}${l.live ? ' kfl-tab--live' : ''}"
         ${isActive(l.href) ? 'aria-current="page"' : ''}
         aria-label="${l.label}">
        <div class="kfl-tab__pill">
          <span class="material-symbols-rounded kfl-tab__icon" aria-hidden="true">${l.icon}</span>
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
        dark:  { emoji: '🌙', title: 'Dark mode',  badge: 'Dark'  },
        light: { emoji: '☀️', title: 'Light mode', badge: 'Light' },
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
    const row      = document.getElementById('notif-row');
    const checkbox = document.getElementById('notif-checkbox');
    const status   = document.getElementById('notif-status');
    if (!row) return;

    function updateUI() {
      if (!('Notification' in window)) {
        if (checkbox) checkbox.checked = false;
        if (status) status.textContent = 'Not supported';
        return;
      }
      const perm = Notification.permission;
      if (perm === 'granted') {
        if (checkbox) checkbox.checked = true;
        if (status) { status.textContent = 'On'; status.style.color = 'var(--accent)'; }
      } else if (perm === 'denied') {
        if (checkbox) checkbox.checked = false;
        if (status) { status.textContent = 'Blocked'; status.style.color = 'var(--pink)'; }
      } else {
        if (checkbox) checkbox.checked = false;
        if (status) { status.textContent = 'Off'; status.style.color = 'var(--text-3)'; }
      }
    }

    async function handleTap() {
      if (!('Notification' in window)) return;

      if (Notification.permission === 'denied') {
        // Can't programmatically unblock — guide user
        if (status) { status.textContent = 'Unblock in browser settings'; status.style.color = 'var(--pink)'; }
        setTimeout(updateUI, 3000);
        return;
      }

      if (Notification.permission === 'granted') {
        // Toggle off — we can't revoke permission programmatically,
        // but we can unsubscribe the push subscription if present
        if (window.KopalaNotify?.unsubscribe) {
          await window.KopalaNotify.unsubscribe();
        }
        // Visually reflect off state (permission stays granted in browser)
        if (checkbox) checkbox.checked = false;
        if (status) { status.textContent = 'Off'; status.style.color = 'var(--text-3)'; }
        localStorage.setItem('kopala_notif_pref', 'off');
        return;
      }

      // permission === 'default' — request it
      const perm = await Notification.requestPermission();
      if (perm === 'granted') {
        localStorage.setItem('kopala_notif_pref', 'on');
        if (window.KopalaNotify?.prompt) window.KopalaNotify.prompt();
      }
      updateUI();
    }

    row.addEventListener('click', handleTap);
    row.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTap(); }
    });
    window._kflSyncNotifUI = updateUI;
    updateUI();
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

  /* ── MENU (overlay open/close) ── */
  function setupMenu() {
    const dotsBtn = document.getElementById('dots-btn');
    const menu    = document.getElementById('kfl-overlay-menu');
    const overlay = document.getElementById('kfl-overlay');
    if (!dotsBtn || !menu) return;

    let isOpen = false;

    function open() {
      isOpen = true;
      window._kflSyncNotifUI?.();
      menu.classList.add('is-open');
      overlay?.classList.add('is-open');
      menu.removeAttribute('inert');
      menu.removeAttribute('aria-hidden');
      dotsBtn.setAttribute('aria-expanded', 'true');
      dotsBtn.classList.add('is-active');
      document.body.style.overflow = 'hidden'; // prevent scroll behind
    }
    function close() {
      isOpen = false;
      menu.classList.remove('is-open');
      overlay?.classList.remove('is-open');
      menu.setAttribute('inert', '');
      menu.setAttribute('aria-hidden', 'true');
      dotsBtn.setAttribute('aria-expanded', 'false');
      dotsBtn.classList.remove('is-active');
      document.body.style.overflow = '';
      dotsBtn.focus();
    }

    dotsBtn.addEventListener('click', e => { e.stopPropagation(); isOpen ? close() : open(); });
    document.getElementById('kfl-menu-close')?.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen) close(); });
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
    document.querySelectorAll('.kfl-tab').forEach(el => {
      const a = el.getAttribute('href') === page;
      el.classList.toggle('is-active', a);
      a ? el.setAttribute('aria-current', 'page') : el.removeAttribute('aria-current');
    });
    document.querySelectorAll('.kfl-overlay-link').forEach(el => {
      const a = el.getAttribute('href') === page;
      el.classList.toggle('is-active', a);
      a ? el.setAttribute('aria-current', 'page') : el.removeAttribute('aria-current');
    });
  }
  function setupTurboSync() { document.addEventListener('kopala:page-changed', syncActiveState); }

  /* ── AUTH GATE ── */
  function setupAuthGate() {
    if (!isLoggedIn()) showLoginScreen();
    document.querySelectorAll('.kfl-tab, .kfl-overlay-link').forEach(el => {
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
    injectThemeColorMeta();

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
    setupMenu();
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
