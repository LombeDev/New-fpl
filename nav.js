/* ============================================================
   KOPALA FPL — NAVIGATION MODULE
   Layout: [logo LEFT] [active page name CENTER] [⋮ RIGHT]
   Topbar: fully transparent, merges with page background
   Bottom nav: pill highlight in FPL pink
   Dropdown: body-level right drawer (avoids backdrop-filter
             stacking context issues)
   Settings: collapsible accordion with animated chevron
   ============================================================ */

(function () {
  'use strict';

  const NAV_LINKS = [
    { href: 'index.html',      label: 'Home',    icon: 'fa-house' },
    { href: 'leagues.html',    label: 'Leagues', icon: 'fa-trophy' },
    { href: 'prices.html',     label: 'Prices',  icon: 'fa-arrow-trend-up' },
    { href: 'games.html',      label: 'Live',    icon: 'fa-futbol', live: true },
    { href: 'statistics.html', label: 'Stats',   icon: 'fa-chart-line' },
  ];

  const MENU_LINKS = [
    { href: 'index.html',      label: 'Home',       emoji: '🏠' },
    { href: 'leagues.html',    label: 'Leagues',    emoji: '🏆' },
    { href: 'prices.html',     label: 'Prices',     emoji: '📈' },
    { href: 'games.html',      label: 'Live',       emoji: '⚽' },
    { href: 'statistics.html', label: 'Statistics', emoji: '📊' },
  ];

  /* ── THEME ── */
  const ICON_MAP  = { dark: '🌙', light: '☀️' };
  const LABEL_MAP = { dark: 'Switch to Light', light: 'Switch to Dark' };

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

  function getActiveLabel() {
    const active = NAV_LINKS.find(l => isActive(l.href));
    return active ? active.label : '';
  }

  /* ── SETTINGS ACCORDION CSS (injected once) ── */
  function injectSettingsStyles() {
    if (document.getElementById('kfl-settings-styles')) return;
    const style = document.createElement('style');
    style.id = 'kfl-settings-styles';
    style.textContent = `
      /* Settings accordion header */
      .kfl-settings-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 20px 20px 5px;
        cursor: pointer;
        user-select: none;
        -webkit-tap-highlight-color: transparent;
        border: none;
        background: none;
        width: 100%;
        text-align: left;
        font-family: inherit;
      }
      .kfl-settings-header__label {
        font-size: 10.5px;
        font-weight: 800;
        color: var(--text-3);
        letter-spacing: 1px;
        text-transform: uppercase;
      }
      .kfl-settings-header__chevron {
        display: flex;
        align-items: center;
        justify-content: center;
        width: 18px;
        height: 18px;
        color: var(--text-3);
        transition: transform 0.28s cubic-bezier(0.4, 0, 0.2, 1),
                    color 0.18s ease;
        flex-shrink: 0;
      }
      .kfl-settings-header__chevron svg {
        width: 12px;
        height: 12px;
        display: block;
      }
      .kfl-settings-header.is-open .kfl-settings-header__chevron {
        transform: rotate(180deg);
        color: var(--accent);
      }

      /* Accordion body */
      .kfl-settings-body {
        overflow: hidden;
        max-height: 0;
        opacity: 0;
        transition: max-height 0.34s cubic-bezier(0.4, 0, 0.2, 1),
                    opacity   0.24s cubic-bezier(0.4, 0, 0.2, 1);
      }
      .kfl-settings-body.is-open {
        max-height: 400px;
        opacity: 1;
      }
    `;
    document.head.appendChild(style);
  }

  /* ── TOP BAR ── */
  function buildTopbar() {
    const activeLabel = getActiveLabel();

    const topbar = `
      <header class="kfl-topbar" role="banner">
        <div class="kfl-topbar__inner">

          <!-- LEFT: Logo -->
          <a href="index.html" class="kfl-logo" aria-label="Kopala FPL — Home">
            <img src="/logo.png" alt="Kopala FPL" class="kfl-logo__img">
          </a>

          <!-- CENTER: Active page name -->
          <div class="kfl-topbar__title" aria-live="polite">
            ${activeLabel ? `<span class="kfl-topbar__page-name">${activeLabel}</span>` : ''}
          </div>

          <!-- RIGHT: Bell + three-dot menu -->
          <div class="kfl-topbar__right">
            <button class="kfl-icon-btn kfl-bell-btn"
                    id="bell-btn"
                    aria-label="Notifications">
              <i class="fa-solid fa-bell" aria-hidden="true"></i>
              <span class="kfl-notif-badge" id="kfl-notif-badge" aria-hidden="true"></span>
            </button>
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

    /* Dropdown is a sibling of <header> — NOT inside it.
       backdrop-filter on header creates a stacking context
       that clips the dropdown. */
    const teamId = localStorage.getItem('kopala_id') || '—';
    const dropdown = `
      <div class="kfl-dropdown" id="kfl-dropdown" role="menu" aria-hidden="true" inert>
        <div class="kfl-dropdown__inner">

          <!-- Identity card -->
          <div class="kfl-dropdown__card">
            <div class="kfl-dropdown__avatar">⚽</div>
            <div class="kfl-dropdown__card-info">
              <div class="kfl-dropdown__card-name">My FPL Team</div>
              <div class="kfl-dropdown__card-id">Team ID: <strong id="kfl-dd-teamid">${teamId}</strong></div>
            </div>
            <button class="kfl-dropdown__close" id="kfl-dropdown-close" aria-label="Close menu">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <!-- Pages section -->
          <p class="kfl-dropdown__label">Pages</p>
          ${MENU_LINKS.map(l => `
            <a href="${l.href}"
               class="kfl-dropdown__item${isActive(l.href) ? ' is-active' : ''}"
               role="menuitem"
               ${isActive(l.href) ? 'aria-current="page"' : ''}>
              <span class="kfl-dropdown__emoji">${l.emoji}</span>
              <span class="kfl-dropdown__item-text">${l.label}</span>
              ${isActive(l.href) ? '<span class="kfl-dropdown__check"><i class="fa-solid fa-check"></i></span>' : ''}
            </a>`).join('')}

          <!-- Settings accordion -->
          <div class="kfl-dropdown__divider"></div>

          <button class="kfl-settings-header" id="kfl-settings-toggle" aria-expanded="false" type="button">
            <span class="kfl-settings-header__label">Settings</span>
            <span class="kfl-settings-header__chevron" aria-hidden="true">
              <svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2"
                   stroke-linecap="round" stroke-linejoin="round">
                <polyline points="2 4 6 8 10 4"/>
              </svg>
            </span>
          </button>

          <div class="kfl-settings-body" id="kfl-settings-body">

            <button class="kfl-dropdown__item"
                    id="theme-toggle"
                    role="menuitem"
                    type="button">
              <span class="kfl-dropdown__emoji" id="theme-icon">${ICON_MAP[_theme]}</span>
              <span class="kfl-dropdown__item-text" id="theme-label">${LABEL_MAP[_theme]}</span>
              <span class="kfl-dropdown__badge" id="theme-pill">${_theme === 'dark' ? 'Dark' : 'Light'}</span>
            </button>

            <button class="kfl-dropdown__item"
                    id="change-id-btn"
                    role="menuitem"
                    type="button">
              <span class="kfl-dropdown__emoji">🔄</span>
              <span class="kfl-dropdown__item-text">Change Team ID</span>
            </button>

            <a href="https://wa.me/260978263899"
               class="kfl-dropdown__item"
               role="menuitem"
               target="_blank" rel="noopener noreferrer">
              <span class="kfl-dropdown__emoji">💬</span>
              <span class="kfl-dropdown__item-text">Contact &amp; Support</span>
              <span class="kfl-dropdown__ext"><i class="fa-solid fa-arrow-up-right-from-square"></i></span>
            </a>

          </div>

          <div class="kfl-dropdown__divider"></div>

          <button class="kfl-dropdown__item kfl-dropdown__item--danger"
                  id="logout-btn"
                  role="menuitem"
                  type="button">
            <span class="kfl-dropdown__emoji">🚪</span>
            <span class="kfl-dropdown__item-text">Log Out</span>
          </button>

          <!-- Footer -->
          <div class="kfl-dropdown__footer">
            <span>Kopala FPL</span>
            <span class="kfl-dropdown__footer-dot">·</span>
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

  /* ── OVERLAY ── */
  function buildOverlay() {
    return `<div class="kfl-overlay" id="kfl-overlay" aria-hidden="true"></div>`;
  }

  /* ── THEME ── */
  function setupTheme() {
    const root  = document.documentElement;
    const btn   = document.getElementById('theme-toggle');
    const icon  = document.getElementById('theme-icon');
    const label = document.getElementById('theme-label');
    const pill  = document.getElementById('theme-pill');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('kopala_theme', next);
      if (icon) {
        icon.style.opacity = '0';
        icon.style.transform = 'scale(0.5)';
        setTimeout(() => {
          icon.textContent = ICON_MAP[next];
          icon.style.opacity = '1';
          icon.style.transform = 'scale(1)';
        }, 120);
      }
      if (label) label.textContent = LABEL_MAP[next];
      if (pill) pill.textContent = next === 'dark' ? 'Dark' : 'Light';
    });
  }

  /* ── SETTINGS ACCORDION ── */
  function setupSettingsAccordion() {
    const toggle = document.getElementById('kfl-settings-toggle');
    const body   = document.getElementById('kfl-settings-body');
    if (!toggle || !body) return;

    toggle.addEventListener('click', () => {
      const isOpen = toggle.classList.toggle('is-open');
      body.classList.toggle('is-open', isOpen);
      toggle.setAttribute('aria-expanded', String(isOpen));
    });
  }

  /* ── BELL ── */
  function setupBell() {
    const bell = document.getElementById('bell-btn');
    if (!bell) return;
    bell.addEventListener('click', () => {
      if (navigator.vibrate) navigator.vibrate([8, 40, 8]);
      const i = bell.querySelector('.fa-solid');
      if (i) {
        i.style.animation = 'none';
        // Force reflow then re-apply
        void i.offsetWidth;
        i.style.animation = 'kflBellShake 0.4s ease';
        setTimeout(() => { i.style.animation = ''; }, 400);
      }
      if (window.KopalaNotify?.prompt) {
        window.KopalaNotify.prompt();
      } else {
        if ('Notification' in window && Notification.permission === 'default') {
          Notification.requestPermission().then(p => {
            if (p === 'granted') updateBellState();
          });
        }
      }
    });
    updateBellState();
    if (!document.getElementById('kfl-bell-kf')) {
      const s = document.createElement('style');
      s.id = 'kfl-bell-kf';
      s.textContent = '@keyframes kflBellShake{0%,100%{transform:rotate(0)}20%{transform:rotate(-18deg)}40%{transform:rotate(16deg)}60%{transform:rotate(-12deg)}80%{transform:rotate(8deg)}}';
      document.head.appendChild(s);
    }
  }

  function updateBellState() {
    const badge = document.getElementById('kfl-notif-badge');
    if (!badge) return;
    const granted = window.Notification && Notification.permission === 'granted';
    badge.classList.toggle('has-notif', !granted);
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
      const teamIdEl = document.getElementById('kfl-dd-teamid');
      if (teamIdEl) teamIdEl.textContent = localStorage.getItem('kopala_id') || '—';
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

    document.getElementById('change-id-btn')?.addEventListener('click', () => {
      close();
      changeTeamId();
    });

    document.getElementById('logout-btn')?.addEventListener('click', () => {
      close();
      logout();
    });
  }

  /* ── AUTH HELPERS ── */
  const TEAM_ID_KEY = 'kopala_id';

  function isLoggedIn() {
    const id = localStorage.getItem(TEAM_ID_KEY);
    return id && id.trim() !== '';
  }

  function logout() {
    localStorage.removeItem(TEAM_ID_KEY);
    showLoginScreen();
  }

  function changeTeamId() {
    showLoginScreen();
    const inp = document.getElementById('fpl-id-inp');
    const current = localStorage.getItem(TEAM_ID_KEY);
    if (inp && current) {
      inp.value = current;
      inp.select();
    }
  }

  function showLoginScreen() {
    const loginScreen = document.getElementById('login-screen');
    if (!loginScreen) return;
    loginScreen.style.display = 'flex';
    const inp = document.getElementById('fpl-id-inp');
    const err = document.getElementById('err-msg');
    if (inp) inp.classList.remove('error');
    if (err) { err.style.display = 'none'; err.textContent = ''; }
    setTimeout(() => inp?.focus(), 100);
  }

  /* ── ACTIVE STATE SYNC ──
     pwa.js fires 'kopala:page-changed' after every content swap. */
  function syncActiveState() {
    const page = currentPage();
    document.querySelectorAll('.kfl-tab').forEach(tab => {
      const active = tab.getAttribute('href') === page;
      tab.classList.toggle('is-active', active);
      if (active) tab.setAttribute('aria-current', 'page');
      else tab.removeAttribute('aria-current');
    });
    document.querySelectorAll('.kfl-dropdown__item[href]').forEach(link => {
      const active = link.getAttribute('href') === page;
      link.classList.toggle('is-active', active);
      if (active) link.setAttribute('aria-current', 'page');
      else link.removeAttribute('aria-current');
    });
    const titleEl = document.querySelector('.kfl-topbar__page-name');
    if (titleEl) titleEl.textContent = getActiveLabel();
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
          e.preventDefault();
          e.stopImmediatePropagation();
          if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
          showLoginScreen();
        }
      }, true);
    });

    document.querySelectorAll('.kfl-dropdown__item[href]').forEach(link => {
      link.addEventListener('click', e => {
        if (!isLoggedIn()) {
          e.preventDefault();
          e.stopImmediatePropagation();
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
      e.preventDefault();
      e.stopImmediatePropagation();
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
    injectSettingsStyles();

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
    setupSettingsAccordion();
    setupDropdown();
    setupBottomNav();
    setupBell();
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
