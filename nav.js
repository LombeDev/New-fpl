/* ============================================================
   KOPALA FPL — NAVIGATION MODULE
   Layout: [LOGO left] [spacer] [⋮ dots right]
   Theme toggle lives inside the dropdown menu
   ============================================================ */

(function () {
  'use strict';

  const BOTTOM_NAV_LINKS = [
    { href: 'index.html',      label: 'Home',    icon: 'home' },
    { href: 'leagues.html',    label: 'Leagues', icon: 'leaderboard' },
    { href: 'prices.html',     label: 'Prices',  icon: 'sell' },
    { href: 'games.html',      label: 'Live',    icon: 'sports_soccer', live: true },
    { href: 'statistics.html', label: 'Stats',   icon: 'monitoring' },
  ];

  const MENU_LINKS = [
    { href: 'index.html',      label: 'Home',        icon: 'home' },
    { href: 'leagues.html',    label: 'Leagues',     icon: 'leaderboard' },
    { href: 'prices.html',     label: 'Prices',      icon: 'sell' },
    { href: 'games.html',      label: 'Live Action', icon: 'sports_soccer' },
    { href: 'statistics.html', label: 'Statistics',  icon: 'monitoring' },
  ];

  /* ── THEME ── */
  const ICON_MAP = { dark: 'dark_mode', light: 'light_mode' };
  const LABEL_MAP = { dark: 'Switch to Light', light: 'Switch to Dark' };

  function getInitialTheme() {
    const stored = localStorage.getItem('kopala_theme');
    if (stored === 'dark' || stored === 'light') return stored;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  const _initialTheme = getInitialTheme();
  document.documentElement.setAttribute('data-theme', _initialTheme);

  function currentPage() {
    const p = window.location.pathname.split('/').pop() || 'index.html';
    return p === '' ? 'index.html' : p;
  }
  function isActive(href) { return href === currentPage(); }

  /* ── TOP BAR ── */
  function buildTopbar() {
    const dropdown = `
      <div class="kfl-dropdown" id="kfl-dropdown" role="menu" aria-hidden="true" inert>
        <div class="kfl-dropdown__inner">

          <p class="kfl-dropdown__label">Navigate</p>
          ${MENU_LINKS.map(l => `
            <a href="${l.href}"
               class="kfl-dropdown__item${isActive(l.href) ? ' is-active' : ''}"
               role="menuitem"
               ${isActive(l.href) ? 'aria-current="page"' : ''}>
              <span class="material-symbols-rounded">${l.icon}</span>
              <span>${l.label}</span>
              ${isActive(l.href) ? '<span class="kfl-dropdown__dot"></span>' : ''}
            </a>`).join('')}

          <div class="kfl-dropdown__divider"></div>
          <p class="kfl-dropdown__label">Settings</p>

          <button class="kfl-dropdown__item kfl-dropdown__item--theme"
                  id="theme-toggle"
                  role="menuitem"
                  type="button">
            <span class="material-symbols-rounded" id="theme-icon">${ICON_MAP[_initialTheme]}</span>
            <span id="theme-label">${LABEL_MAP[_initialTheme]}</span>
            <span class="kfl-dropdown__theme-pill" id="theme-pill">${_initialTheme === 'dark' ? 'Dark' : 'Light'}</span>
          </button>

          <a href="https://wa.me/260978263899"
             class="kfl-dropdown__item"
             role="menuitem"
             target="_blank"
             rel="noopener noreferrer">
            <span class="material-symbols-rounded">chat</span>
            <span>Contact Us</span>
          </a>

          <button class="kfl-dropdown__item"
                  id="change-id-btn"
                  role="menuitem"
                  type="button">
            <span class="material-symbols-rounded">swap_horiz</span>
            <span>Change Team ID</span>
          </button>

        </div>
      </div>`;

    // Dropdown is a sibling of <header>, NOT a child — avoids backdrop-filter stacking context trap
    return `
      <header class="kfl-topbar" role="banner">
        <div class="kfl-topbar__inner">

          <a href="index.html" class="kfl-logo" aria-label="Kopala FPL — Home">
            <img src="/logo.png" alt="Kopala FPL" class="kfl-logo__img">
          </a>

          <div class="kfl-topbar__spacer"></div>

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
      </header>
      ${dropdown}`;
  }

  /* ── BOTTOM NAV ── */
  function buildBottomNav() {
    const items = BOTTOM_NAV_LINKS.map(l => `
      <a href="${l.href}"
         class="kfl-tab${isActive(l.href) ? ' is-active' : ''}${l.live ? ' kfl-tab--live' : ''}"
         ${isActive(l.href) ? 'aria-current="page"' : ''}
         aria-label="${l.label}">
        <div class="kfl-tab__icon">
          <span class="material-symbols-rounded" aria-hidden="true">${l.icon}</span>
          ${isActive(l.href) ? '<span class="kfl-tab__pip"></span>' : ''}
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

  /* ── THEME LOGIC ── */
  function setupTheme() {
    const root      = document.documentElement;
    const btn       = document.getElementById('theme-toggle');
    const icon      = document.getElementById('theme-icon');
    const label     = document.getElementById('theme-label');
    const pill      = document.getElementById('theme-pill');
    if (!btn) return;

    btn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('kopala_theme', next);
      if (icon)  { icon.style.opacity = '0'; icon.style.transform = 'rotate(180deg) scale(0.5)'; }
      setTimeout(() => {
        if (icon)  { icon.textContent = ICON_MAP[next]; icon.style.opacity = '1'; icon.style.transform = 'rotate(0) scale(1)'; }
        if (label) label.textContent = LABEL_MAP[next];
        if (pill)  pill.textContent  = next === 'dark' ? 'Dark' : 'Light';
      }, 150);
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
      if (isOpen && !dropdown.contains(e.target) && e.target !== dotsBtn) close();
    });

    // Change Team ID
    document.getElementById('change-id-btn')?.addEventListener('click', () => {
      close();
      const loginScreen = document.getElementById('login-screen');
      if (loginScreen) {
        loginScreen.style.display = 'flex';
        const inp = document.getElementById('fpl-id-inp');
        const err = document.getElementById('err-msg');
        if (inp) { inp.value = ''; inp.classList.remove('error'); }
        if (err) { err.style.display = 'none'; err.textContent = ''; }
        setTimeout(() => inp?.focus(), 100);
      }
    });
  }

  /* ── BOTTOM NAV HAPTIC ── */
  function setupBottomNav() {
    document.querySelectorAll('.kfl-tab').forEach(item => {
      item.addEventListener('click', () => { if (navigator.vibrate) navigator.vibrate(8); });
    });
  }

  /* ── SCROLL TOPBAR ── */
  function setupScroll() {
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

  /* ── INIT ── */
  function loadNav() {
    const topbarTarget  = document.getElementById('kfl-topbar-mount');
    const bottomTarget  = document.getElementById('kfl-bottom-nav-mount');
    const overlayTarget = document.getElementById('kfl-overlay-mount');

    // buildTopbar() now returns <header>...</header> + <div.kfl-dropdown>
    // so injecting via outerHTML replaces the mount with both elements
    if (topbarTarget)  topbarTarget.outerHTML  = buildTopbar();
    if (bottomTarget)  bottomTarget.outerHTML  = buildBottomNav();
    if (overlayTarget) overlayTarget.outerHTML = buildOverlay();

    if (!topbarTarget && !bottomTarget) {
      document.body.insertAdjacentHTML('afterbegin', buildOverlay() + buildTopbar());
      document.body.insertAdjacentHTML('beforeend', buildBottomNav());
    }

    setupTheme();
    setupDropdown();
    setupBottomNav();
    setupScroll();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNav);
  } else {
    loadNav();
  }

})();
