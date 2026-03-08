/* ============================================================
   KOPALA FPL — NAVIGATION MODULE
   Layout: [logo LEFT] [active page name CENTER] [⋮ RIGHT]
   Topbar: fully transparent, merges with page background
   Bottom nav: WhatsApp pill highlight in FPL pink
   Dropdown: body-level sibling (not inside header) to avoid
             backdrop-filter stacking context issues
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
    { href: 'index.html',      label: 'Home',       icon: 'fa-house' },
    { href: 'leagues.html',    label: 'Leagues',    icon: 'fa-trophy' },
    { href: 'prices.html',     label: 'Prices',     icon: 'fa-arrow-trend-up' },
    { href: 'games.html',      label: 'Live Action',icon: 'fa-futbol' },
    { href: 'statistics.html', label: 'Statistics', icon: 'fa-chart-line' },
  ];

  /* ── THEME ── */
  const ICON_MAP  = { dark: 'fa-moon',        light: 'fa-sun' };
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

          <!-- RIGHT: Three-dot menu -->
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

    /* Dropdown is a sibling of <header> — NOT inside it.
       backdrop-filter on header would create a stacking context
       that blurs and breaks pointer events on the dropdown. */
    const dropdown = `
      <div class="kfl-dropdown" id="kfl-dropdown" role="menu" aria-hidden="true" inert>
        <div class="kfl-dropdown__inner">

          <p class="kfl-dropdown__label">Navigate</p>
          ${MENU_LINKS.map(l => `
            <a href="${l.href}"
               class="kfl-dropdown__item${isActive(l.href) ? ' is-active' : ''}"
               role="menuitem"
               ${isActive(l.href) ? 'aria-current="page"' : ''}>
              <i class="fa-solid ${l.icon}"></i>
              <span>${l.label}</span>
              ${isActive(l.href) ? '<span class="kfl-dropdown__dot"></span>' : ''}
            </a>`).join('')}

          <div class="kfl-dropdown__divider"></div>
          <p class="kfl-dropdown__label">Settings</p>

          <button class="kfl-dropdown__item"
                  id="theme-toggle"
                  role="menuitem"
                  type="button">
            <i class="fa-solid ${ICON_MAP[_theme]}" id="theme-icon"></i>
            <span id="theme-label">${LABEL_MAP[_theme]}</span>
            <span class="kfl-dropdown__theme-pill" id="theme-pill">${_theme === 'dark' ? 'Dark' : 'Light'}</span>
          </button>

          <a href="https://wa.me/260978263899"
             class="kfl-dropdown__item"
             role="menuitem"
             target="_blank" rel="noopener noreferrer">
            <i class="fa-brands fa-whatsapp"></i>
            <span>Contact Us</span>
          </a>

          <button class="kfl-dropdown__item"
                  id="change-id-btn"
                  role="menuitem"
                  type="button">
            <i class="fa-solid fa-right-left"></i>
            <span>Change Team ID</span>
          </button>

          <button class="kfl-dropdown__item kfl-dropdown__item--danger"
                  id="logout-btn"
                  role="menuitem"
                  type="button">
            <i class="fa-solid fa-arrow-right-from-bracket"></i>
            <span>Log Out</span>
          </button>

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
        icon.style.transform = 'rotate(180deg) scale(0.5)';
        setTimeout(() => {
          // Swap FA class
          icon.className = `fa-solid ${ICON_MAP[next]}`;
          icon.style.opacity = '1';
          icon.style.transform = 'rotate(0) scale(1)';
        }, 150);
      }
      if (label) label.textContent = LABEL_MAP[next];
      if (pill)  pill.textContent  = next === 'dark' ? 'Dark' : 'Light';
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

  /* Show login screen but keep existing value so user can re-enter a different ID */
  function changeTeamId() {
    showLoginScreen();
    const inp = document.getElementById('fpl-id-inp');
    // Pre-fill with current ID so user sees what they're changing from
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
    if (inp) { inp.classList.remove('error'); }
    if (err) { err.style.display = 'none'; err.textContent = ''; }
    setTimeout(() => inp?.focus(), 100);
  }

  /* ── ACTIVE STATE SYNC (Turbo / pwa.js navigation) ──
     pwa.js fires 'kopala:page-changed' after every content swap.
     Re-apply is-active classes so the bottom nav stays correct. */
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

  /* ── AUTH GATE ──
     On load: redirect to login if no team ID stored.
     On every nav click: block and show login if unauthenticated.
     Uses capture phase so it fires before all other handlers. */
  function setupAuthGate() {
    if (!isLoggedIn()) showLoginScreen();

    // Intercept bottom nav tabs
    document.querySelectorAll('.kfl-tab').forEach(tab => {
      tab.addEventListener('click', e => {
        if (!isLoggedIn()) {
          e.preventDefault();
          e.stopImmediatePropagation();
          if (navigator.vibrate) navigator.vibrate([10, 30, 10]);
          showLoginScreen();
        }
      }, true); // capture phase — fires before haptic handler
    });

    // Intercept dropdown nav links
    document.querySelectorAll('.kfl-dropdown__item[href]').forEach(link => {
      link.addEventListener('click', e => {
        if (!isLoggedIn()) {
          e.preventDefault();
          e.stopImmediatePropagation();
          showLoginScreen();
        }
      }, true);
    });

    // Intercept all <a href> clicks (catches pwa.js page transitions too)
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
      item.addEventListener('click', () => { if (navigator.vibrate) navigator.vibrate(8); });
    });
  }

  /* ── SCROLL (subtle shadow on scroll only) ── */
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

  /* ── INJECT MATERIAL SYMBOLS ──
     Loaded as a <link> (not @import) so it's non-blocking.
     Only injected once — idempotent. */
  /* ── INIT ── */
  function loadNav() {
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
