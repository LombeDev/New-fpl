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
    { href: 'index.html',   label: 'Home',    icon: 'fa-house' },
    { href: 'leagues.html', label: 'Leagues', icon: 'fa-trophy' },
    { href: 'prices.html',  label: 'Prices',  icon: 'fa-arrow-trend-up' },
    { href: 'games.html',   label: 'Live',    icon: 'fa-futbol', live: true },
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
    const s = document.createElement('style');
    s.id = 'kfl-nav-v5-styles';
    s.textContent = `

      /* ── Full-screen overlay ── */
      .kfl-overlay-menu {
        position: fixed; inset: 0;
        z-index: 1400;
        background: var(--surface);
        display: flex; flex-direction: column;
        overflow-y: auto; overflow-x: hidden;
        /* slide in from top */
        opacity: 0;
        transform: translateY(-100%);
        pointer-events: none;
        transition:
          opacity 0.28s cubic-bezier(0.22,1,0.36,1),
          transform 0.32s cubic-bezier(0.22,1,0.36,1);
        will-change: transform, opacity;
      }
      .kfl-overlay-menu.is-open {
        opacity: 1;
        transform: translateY(0);
        pointer-events: auto;
      }

      /* ── Overlay top bar (X button) ── */
      .kfl-overlay-menu__bar {
        display: flex;
        align-items: center;
        justify-content: flex-end;
        height: var(--kfl-topbar-h);
        padding: 0 18px;
        flex-shrink: 0;
      }
      .kfl-overlay-menu__close {
        display: flex; align-items: center; justify-content: center;
        width: 36px; height: 36px;
        background: none; border: none;
        color: var(--text-1); font-size: 22px;
        cursor: pointer; -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        transition: opacity 0.15s ease, transform 0.12s ease;
      }
      .kfl-overlay-menu__close:active { opacity: 0.6; transform: scale(0.88); }

      /* ── Nav links (Apple-style large bold) ── */
      .kfl-overlay-menu__links {
        flex: 1;
        padding: 12px 24px 24px;
        display: flex; flex-direction: column;
      }
      .kfl-overlay-link {
        display: flex; align-items: center; justify-content: space-between;
        padding: 14px 0;
        text-decoration: none;
        color: var(--text-1);
        font-family: var(--kfl-font);
        font-size: 28px;
        font-weight: 700;
        letter-spacing: -0.5px;
        line-height: 1.15;
        border-bottom: 1px solid var(--border);
        -webkit-tap-highlight-color: transparent;
        touch-action: manipulation;
        transition: color 0.14s ease, opacity 0.14s ease;
      }
      .kfl-overlay-link:last-child { border-bottom: none; }
      .kfl-overlay-link:active { opacity: 0.55; }
      .kfl-overlay-link.is-active { color: var(--accent); }
      .kfl-overlay-link__right {
        display: flex; align-items: center; gap: 10px; flex-shrink: 0;
      }
      .kfl-overlay-link__live {
        display: flex; align-items: center; gap: 4px;
        font-size: 10px; font-weight: 800; letter-spacing: 0.4px;
        text-transform: uppercase; color: var(--pink);
        background: var(--pink-dim); border: 1px solid rgba(255,51,82,0.22);
        border-radius: 100px; padding: 3px 8px 3px 6px; line-height: 1;
      }
      .kfl-overlay-link__live-dot {
        width: 5px; height: 5px; border-radius: 50%;
        background: var(--pink); flex-shrink: 0;
        animation: livepulse 1.8s ease-in-out infinite;
      }
      .kfl-overlay-link__check {
        font-size: 14px; color: var(--accent);
      }

      /* ── Settings section inside overlay ── */
      .kfl-overlay-menu__settings {
        padding: 0 24px 40px;
        border-top: 1px solid var(--border);
        margin-top: 4px;
      }
      .kfl-overlay-settings-title {
        font-size: 10px; font-weight: 800; letter-spacing: 1px;
        text-transform: uppercase; color: var(--text-3);
        padding: 20px 0 8px; margin: 0;
      }

      /* Settings accordion toggle */
      .kfl-settings-toggle {
        display: flex; align-items: center; gap: 12px;
        padding: 11px 0; width: 100%;
        border: none; background: none; cursor: pointer;
        font-family: var(--kfl-font); text-align: left; color: var(--text-1);
        -webkit-tap-highlight-color: transparent;
        border-bottom: 1px solid var(--border);
        transition: opacity 0.14s ease;
      }
      .kfl-settings-toggle:active { opacity: 0.6; }
      .kfl-settings-toggle:last-child { border-bottom: none; }
      .kfl-settings-toggle__icon { font-size: 15px; color: var(--text-3); flex-shrink: 0; }
      .kfl-settings-toggle__label { flex: 1; font-size: 15px; font-weight: 500; }
      .kfl-settings-toggle__chevron {
        color: var(--text-3); flex-shrink: 0; display: flex; align-items: center;
        transition: transform 0.22s cubic-bezier(0.4,0,0.2,1), color 0.15s ease;
      }
      .kfl-settings-toggle__chevron svg { width: 13px; height: 13px; display: block; }
      .kfl-settings-toggle.is-open .kfl-settings-toggle__chevron {
        transform: rotate(180deg); color: var(--accent);
      }

      /* Settings accordion body */
      .kfl-settings-body {
        overflow: hidden; max-height: 0; opacity: 0;
        transition: max-height 0.28s cubic-bezier(0.4,0,0.2,1), opacity 0.18s ease;
      }
      .kfl-settings-body.is-open { max-height: 400px; opacity: 1; }

      /* Setting rows */
      .kfl-setting-row {
        display: flex; align-items: center; gap: 12px;
        padding: 11px 0;
        border: none; background: transparent; width: 100%;
        text-align: left; cursor: pointer;
        font-family: var(--kfl-font); text-decoration: none; color: var(--text-1);
        -webkit-tap-highlight-color: transparent; touch-action: manipulation;
        border-bottom: 1px solid var(--border);
        transition: opacity 0.14s ease;
      }
      .kfl-setting-row:last-child { border-bottom: none; }
      .kfl-setting-row:active { opacity: 0.6; }
      .kfl-setting-row--danger { color: var(--pink) !important; }
      .kfl-setting-row__icon { font-size: 15px; color: var(--text-3); flex-shrink: 0; }
      .kfl-setting-row--danger .kfl-setting-row__icon { color: var(--pink); }
      .kfl-setting-row__label { flex: 1; font-size: 15px; font-weight: 500; }
      .kfl-setting-row--danger .kfl-setting-row__label { color: var(--pink); }
      .kfl-setting-row__end { flex-shrink: 0; display: flex; align-items: center; gap: 7px; }

      /* Toggle switch */
      .kfl-toggle { position: relative; width: 36px; height: 20px; flex-shrink: 0; cursor: pointer; }
      .kfl-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
      .kfl-toggle__track {
        position: absolute; inset: 0; border-radius: 100px;
        background: var(--surface-3); border: 1px solid var(--border-mid);
        transition: background 0.18s ease, border-color 0.18s ease;
      }
      .kfl-toggle__thumb {
        position: absolute; top: 3px; left: 3px;
        width: 14px; height: 14px; border-radius: 50%;
        background: var(--text-3); box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), background 0.18s ease;
      }
      .kfl-toggle input:checked ~ .kfl-toggle__track { background: var(--accent); border-color: var(--accent); }
      .kfl-toggle input:checked ~ .kfl-toggle__thumb { transform: translateX(16px); background: #fff; }

      /* Theme badge */
      .kfl-setting-badge {
        font-size: 10px; font-weight: 600; padding: 2px 8px;
        border-radius: 100px; background: var(--surface-2);
        border: 1px solid var(--border-mid); color: var(--text-3);
      }
      .kfl-setting-ext { font-size: 11px; color: var(--text-3); }

      /* Staggered link entrance */
      .kfl-overlay-menu.is-open .kfl-overlay-link {
        animation: kflLinkIn 0.32s cubic-bezier(0.22,1,0.36,1) both;
      }
      .kfl-overlay-menu.is-open .kfl-overlay-link:nth-child(1) { animation-delay: 0.04s; }
      .kfl-overlay-menu.is-open .kfl-overlay-link:nth-child(2) { animation-delay: 0.08s; }
      .kfl-overlay-menu.is-open .kfl-overlay-link:nth-child(3) { animation-delay: 0.12s; }
      .kfl-overlay-menu.is-open .kfl-overlay-link:nth-child(4) { animation-delay: 0.16s; }
      @keyframes kflLinkIn {
        from { opacity: 0; transform: translateY(14px); }
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

          <!-- CENTER: empty -->
          <div></div>

          <!-- RIGHT: hamburger only -->
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

        <!-- Large nav links -->
        <nav class="kfl-overlay-menu__links" aria-label="Pages">
          ${MENU_LINKS.map(l => `
            <a href="${l.href}"
               class="kfl-overlay-link${isActive(l.href) ? ' is-active' : ''}"
               ${isActive(l.href) ? 'aria-current="page"' : ''}>
              ${l.label}
              <div class="kfl-overlay-link__right">
                ${l.live ? `<span class="kfl-overlay-link__live"><span class="kfl-overlay-link__live-dot"></span>Live</span>` : ''}
                ${isActive(l.href) ? `<span class="kfl-overlay-link__check"><i class="fa-solid fa-check"></i></span>` : ''}
              </div>
            </a>`).join('')}
        </nav>

        <!-- Settings -->
        <div class="kfl-overlay-menu__settings">

          <button class="kfl-settings-toggle" id="kfl-settings-toggle"
                  aria-expanded="false" type="button">
            <span class="kfl-settings-toggle__icon">
              <i class="fa-solid fa-gear"></i>
            </span>
            <span class="kfl-settings-toggle__label">Settings</span>
            <span class="kfl-settings-toggle__chevron" aria-hidden="true">
              <svg viewBox="0 0 13 13" fill="none" stroke="currentColor"
                   stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="2 4.5 6.5 9 11 4.5"/>
              </svg>
            </span>
          </button>

          <div class="kfl-settings-body" id="kfl-settings-body">

            <!-- Notifications -->
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

            <!-- Theme -->
            <button class="kfl-setting-row" id="theme-toggle" type="button">
              <span class="kfl-setting-row__icon">
                <span id="theme-emoji" style="font-size:15px;transition:opacity .12s,transform .12s;">${themeEmoji}</span>
              </span>
              <span class="kfl-setting-row__label" id="theme-title">${themeTitle}</span>
              <div class="kfl-setting-row__end">
                <span class="kfl-setting-badge" id="theme-badge">${themeBadge}</span>
              </div>
            </button>

            <!-- Support -->
            <a href="https://wa.me/260978263899" class="kfl-setting-row"
               target="_blank" rel="noopener noreferrer">
              <span class="kfl-setting-row__icon" style="color:#25d366;">
                <i class="fa-brands fa-whatsapp"></i>
              </span>
              <span class="kfl-setting-row__label">Contact &amp; Support</span>
              <div class="kfl-setting-row__end kfl-setting-ext">
                <i class="fa-solid fa-arrow-up-right-from-square"></i>
              </div>
            </a>

          </div><!-- /settings-body -->

          <!-- Log Out (always visible) -->
          <button class="kfl-setting-row kfl-setting-row--danger" id="logout-btn" type="button">
            <span class="kfl-setting-row__icon">
              <i class="fa-solid fa-arrow-right-from-bracket"></i>
            </span>
            <span class="kfl-setting-row__label">Log Out</span>
          </button>

        </div><!-- /settings -->

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
