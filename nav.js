/* ============================================================
   KOPALA FPL — NAVIGATION MODULE
   FPL.team / LiveFPL premium aesthetic edition
   ============================================================ */

(function () {
  'use strict';

  /* ── NAV LINK DEFINITIONS ────────────────────────────── */

  const DRAWER_LINKS = [
    { href: 'index.html',      label: 'Home',        icon: 'home' },
    { href: 'leagues.html',    label: 'Leagues',     icon: 'leaderboard' },
    { href: 'prices.html',     label: 'Prices',      icon: 'sell' },
    { href: 'games.html',      label: 'Live Action', icon: 'sports_soccer' },
    { href: 'statistics.html', label: 'Statistics',  icon: 'monitoring' },
  ];

  const BOTTOM_NAV_LINKS = [
    { href: 'index.html',   label: 'Home',    icon: 'home' },
    { href: 'leagues.html', label: 'Leagues', icon: 'leaderboard' },
    { href: 'prices.html',  label: 'Prices',  icon: 'sell' },
    { href: 'games.html',   label: 'Live',    icon: 'sports_soccer' },
  ];

  const DESKTOP_NAV_LINKS = [
    { href: 'index.html',      label: 'Home',    icon: 'home' },
    { href: 'leagues.html',    label: 'Leagues', icon: 'leaderboard' },
    { href: 'prices.html',     label: 'Prices',  icon: 'sell' },
    { href: 'games.html',      label: 'Live',    icon: 'sports_soccer' },
    { href: 'statistics.html', label: 'Stats',   icon: 'monitoring' },
  ];

  /* ── THEME (runs immediately — before DOM inject) ────── */
  // Apply theme from storage ASAP to avoid flash of wrong theme.
  // This must run before buildTopbar() so the icon renders correctly.

  const ICON_MAP = { dark: 'dark_mode', light: 'light_mode' };

  function getInitialTheme() {
    const stored = localStorage.getItem('kopala_theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  const _initialTheme = getInitialTheme();
  document.documentElement.setAttribute('data-theme', _initialTheme);

  /* ── HELPERS ─────────────────────────────────────────── */

  function currentPage() {
    const p = window.location.pathname.split('/').pop() || 'index.html';
    return p === '' ? 'index.html' : p;
  }

  function isActive(href) {
    return href === currentPage();
  }

  /* ── LOGO HTML ───────────────────────────────────────── */

  function logoHTML() {
    return `
      <a href="index.html" class="kfl-logo" aria-label="Kopala FPL — Home">
        <div class="kfl-logo__box">
          <img src="/logo.png" alt="Kopala FPL" class="kfl-logo__img">
        </div>
      </a>`;
  }

  /* ── TOP BAR ─────────────────────────────────────────── */

  function buildTopbar() {
    const desktopLinks = DESKTOP_NAV_LINKS.map(l => `
      <a href="${l.href}"
         class="kfl-topbar__nav-link${isActive(l.href) ? ' is-active' : ''}"
         ${isActive(l.href) ? 'aria-current="page"' : ''}>
        <span class="material-symbols-rounded" aria-hidden="true">${l.icon}</span>
        ${l.label}
      </a>`).join('');

    // Icon reflects actual theme — no flash
    const themeIcon = ICON_MAP[_initialTheme];

    return `
      <header class="kfl-topbar" role="banner">
        <div class="kfl-topbar__inner">
          ${logoHTML()}

          <nav class="kfl-topbar__nav" aria-label="Primary navigation">
            ${desktopLinks}
          </nav>

          <div class="kfl-topbar__right">
            <button class="kfl-topbar__btn"
                    id="theme-toggle"
                    title="Toggle theme"
                    aria-label="Toggle dark/light mode">
              <span class="material-symbols-rounded" id="theme-icon">${themeIcon}</span>
            </button>
            <button class="kfl-topbar__btn kfl-hamburger"
                    id="hamburger"
                    title="Open menu"
                    aria-label="Open navigation menu"
                    aria-expanded="false"
                    aria-controls="kfl-drawer">
              <span class="material-symbols-rounded">menu</span>
            </button>
          </div>
        </div>
      </header>`;
  }

  /* ── DRAWER ──────────────────────────────────────────── */

  function buildDrawer() {
    const navItems = DRAWER_LINKS.map(l => `
      <a href="${l.href}"
         class="kfl-drawer__link${isActive(l.href) ? ' is-active' : ''}"
         ${isActive(l.href) ? 'aria-current="page"' : ''}
         aria-label="${l.label}">
        <div class="kfl-drawer__icon-box" aria-hidden="true">
          <span class="material-symbols-rounded">${l.icon}</span>
        </div>
        <span>${l.label}</span>
      </a>`).join('');

    return `
      <div class="kfl-overlay" id="kfl-overlay" role="presentation" aria-hidden="true"></div>

      <nav class="kfl-drawer"
           id="kfl-drawer"
           aria-label="Drawer navigation"
           aria-hidden="true"
           inert>

        <div class="kfl-drawer__head">
          ${logoHTML()}
          <button class="kfl-drawer__close"
                  id="drawer-close"
                  title="Close menu"
                  aria-label="Close navigation menu">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>

        <div class="kfl-drawer__content">
          <p class="kfl-drawer__section-title" aria-hidden="true">Explore</p>
          ${navItems}

          <div class="kfl-drawer__divider" aria-hidden="true"></div>

          <p class="kfl-drawer__section-title" aria-hidden="true">Support</p>

          <a href="https://wa.me/260978263899"
             class="kfl-drawer__link"
             target="_blank"
             rel="noopener noreferrer"
             aria-label="Contact us on WhatsApp">
            <div class="kfl-drawer__icon-box" aria-hidden="true">
              <span class="material-symbols-rounded">chat</span>
            </div>
            <span>Contact Us</span>
          </a>

          <button class="kfl-drawer__link"
                  id="change-id-btn"
                  type="button"
                  aria-label="Change Team ID">
            <div class="kfl-drawer__icon-box" aria-hidden="true">
              <span class="material-symbols-rounded">swap_horiz</span>
            </div>
            <span>Change Team ID</span>
          </button>
        </div>
      </nav>`;
  }

  /* ── BOTTOM NAV ──────────────────────────────────────── */

  function buildBottomNav() {
    const items = BOTTOM_NAV_LINKS.map(l => `
      <a href="${l.href}"
         class="kfl-bottom-nav__item${isActive(l.href) ? ' is-active' : ''}"
         ${isActive(l.href) ? 'aria-current="page"' : ''}
         aria-label="${l.label}">
        <div class="kfl-bottom-nav__icon-wrapper">
          <div class="kfl-bottom-nav__icon-bg" aria-hidden="true"></div>
          <span class="material-symbols-rounded" aria-hidden="true">${l.icon}</span>
        </div>
        <span class="kfl-bottom-nav__label">${l.label}</span>
      </a>`).join('');

    return `
      <nav class="kfl-bottom-nav" aria-label="Bottom navigation">
        <div class="kfl-bottom-nav__inner">
          ${items}
        </div>
      </nav>`;
  }

  /* ── THEME TOGGLE ────────────────────────────────────── */

  function setupTheme() {
    const root = document.documentElement;
    const btn  = document.getElementById('theme-toggle');
    const icon = document.getElementById('theme-icon');
    if (!btn) return;

    function applyTheme(theme, animate) {
      root.setAttribute('data-theme', theme);
      localStorage.setItem('kopala_theme', theme);
      if (!icon) return;
      if (animate) {
        icon.style.opacity   = '0';
        icon.style.transform = 'rotate(90deg) scale(0.7)';
        setTimeout(() => {
          icon.textContent     = ICON_MAP[theme];
          icon.style.opacity   = '1';
          icon.style.transform = 'rotate(0deg) scale(1)';
        }, 180);
      } else {
        icon.textContent = ICON_MAP[theme];
      }
    }

    // Icon already set correctly in buildTopbar() — just wire the click
    btn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next, true);
    });
  }

  /* ── DRAWER CONTROLS ─────────────────────────────────── */

  function setupDrawer() {
    const hamburger = document.getElementById('hamburger');
    const closeBtn  = document.getElementById('drawer-close');
    const overlay   = document.getElementById('kfl-overlay');
    const drawer    = document.getElementById('kfl-drawer');
    if (!hamburger || !drawer) return;

    let isOpen = false;

    function openDrawer() {
      isOpen = true;
      drawer.classList.add('is-open');
      overlay.classList.add('is-open');
      drawer.removeAttribute('inert');
      drawer.removeAttribute('aria-hidden');
      hamburger.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      setTimeout(() => closeBtn?.focus(), 50);
    }

    function closeDrawer() {
      isOpen = false;
      drawer.classList.remove('is-open');
      overlay.classList.remove('is-open');
      drawer.setAttribute('inert', '');
      drawer.setAttribute('aria-hidden', 'true');
      hamburger.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      hamburger.focus();
    }

    hamburger.addEventListener('click', () => isOpen ? closeDrawer() : openDrawer());
    closeBtn?.addEventListener('click', closeDrawer);
    overlay.addEventListener('click', closeDrawer);
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && isOpen) closeDrawer();
    });

    // Change Team ID — show login screen
    const changeIdBtn = document.getElementById('change-id-btn');
    changeIdBtn?.addEventListener('click', () => {
      closeDrawer();
      const loginScreen = document.getElementById('login-screen');
      if (loginScreen) {
        loginScreen.style.display = 'flex';
        // Clear previous input and errors
        const inp = document.getElementById('fpl-id-inp');
        const err = document.getElementById('err-msg');
        if (inp) { inp.value = ''; inp.classList.remove('error'); }
        if (err) { err.style.display = 'none'; err.textContent = ''; }
        setTimeout(() => inp?.focus(), 100);
      }
    });
  }

  /* ── BOTTOM NAV HAPTIC ───────────────────────────────── */

  function setupBottomNav() {
    document.querySelectorAll('.kfl-bottom-nav__item').forEach(item => {
      item.addEventListener('click', () => {
        if (navigator.vibrate) navigator.vibrate(8);
      });
    });
  }

  /* ── SCROLL-AWARE TOPBAR ─────────────────────────────── */

  function setupScrollBehavior() {
    const topbar = document.querySelector('.kfl-topbar');
    if (!topbar) return;

    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          topbar.classList.toggle('is-scrolled', window.scrollY > 8);
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ── INIT ────────────────────────────────────────────── */

  function loadNav() {
    const topbarTarget = document.getElementById('kfl-topbar-mount');
    const drawerTarget = document.getElementById('kfl-drawer-mount');
    const bottomTarget = document.getElementById('kfl-bottom-nav-mount');

    if (topbarTarget) topbarTarget.outerHTML = buildTopbar();
    if (drawerTarget) drawerTarget.outerHTML = buildDrawer();
    if (bottomTarget) bottomTarget.outerHTML = buildBottomNav();

    // Fallback: no mount points
    if (!topbarTarget && !drawerTarget && !bottomTarget) {
      document.body.insertAdjacentHTML('afterbegin', buildTopbar() + buildDrawer());
      document.body.insertAdjacentHTML('beforeend', buildBottomNav());
    }

    setupTheme();
    setupDrawer();
    setupBottomNav();
    setupScrollBehavior();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNav);
  } else {
    loadNav();
  }

})();
