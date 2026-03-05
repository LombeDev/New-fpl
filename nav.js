(function () {
  'use strict';

  // 1. Updated Icon Names for Material Symbols
  const DRAWER_LINKS = [
    { href: 'index.html',       label: 'Home',        icon: 'home' },
    { href: 'leagues.html',     label: 'Leagues',     icon: 'leaderboard' },
    { href: 'prices.html',      label: 'Prices',      icon: 'sell' },
    { href: 'games.html',       label: 'Live Action', icon: 'sports_soccer' },
    { href: 'statistics.html',  label: 'Statistics',  icon: 'monitoring' },
  ];

  const BOTTOM_NAV_LINKS = [
    { href: 'index.html',   label: 'Home',        icon: 'home'  },
    { href: 'leagues.html', label: 'Leagues',     icon: 'leaderboard' },
    { href: 'prices.html',  label: 'Prices',      icon: 'sell'   },
    { href: 'games.html',   label: 'Live Action', icon: 'sports_soccer' },
  ];

  // ... (currentPage and isActive functions remain the same)

  // 2. Updated Topbar (Theme & Hamburger icons)
  function buildTopbar() {
    return `
      <header class="kfl-topbar" role="banner">
        ${logoHTML()}
        <div class="kfl-topbar__right">
          <button class="kfl-theme-toggle" id="theme-toggle" title="Toggle Theme" aria-label="Toggle dark/light mode">
            <span class="material-symbols-rounded" id="theme-icon">light_mode</span>
          </button>
          <button class="kfl-hamburger" id="hamburger" title="Open Menu"
                  aria-label="Open navigation menu" aria-expanded="false" aria-controls="kfl-drawer">
            <span class="material-symbols-rounded">menu</span>
          </button>
        </div>
      </header>`;
  }

  // 3. Updated Drawer (Icon generation)
  function buildDrawer() {
    const drawerItems = DRAWER_LINKS.map(l => `
      <a href="${l.href}"
         class="kfl-drawer__link${isActive(l.href) ? ' is-active' : ''}"
         ${isActive(l.href) ? 'aria-current="page"' : ''}>
        <div class="kfl-drawer__icon-box" aria-hidden="true">
          <span class="material-symbols-rounded">${l.icon}</span>
        </div>
        <span>${l.label}</span>
      </a>`).join('');

    return `
      <div class="kfl-overlay" id="kfl-overlay" role="presentation"></div>
      <nav class="kfl-drawer" id="kfl-drawer" aria-label="Drawer navigation" aria-hidden="true" inert>
        <div class="kfl-drawer__head">
          ${logoHTML()}
          <button id="drawer-close" title="Close Menu" aria-label="Close navigation menu">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>
        <div class="kfl-drawer__content">
          <p class="kfl-drawer__section-title" aria-hidden="true">Explore</p>
          ${drawerItems}
          <p class="kfl-drawer__section-title" aria-hidden="true">Support</p>
          <a href="https://wa.me/260978263899" class="kfl-drawer__link" target="_blank">
            <div class="kfl-drawer__icon-box"><span class="material-symbols-rounded">chat</span></div>
            <span>Contact Us</span>
          </a>
          <button class="kfl-drawer__link" id="change-id-btn" type="button">
            <div class="kfl-drawer__icon-box"><span class="material-symbols-rounded">logout</span></div>
            <span>Change Team ID</span>
          </button>
        </div>
      </nav>`;
  }

  // 4. Updated Bottom Nav (Icon generation)
  function buildBottomNav() {
    const navItems = BOTTOM_NAV_LINKS.map(l => `
      <a href="${l.href}"
         class="kfl-bottom-nav__item${isActive(l.href) ? ' is-active' : ''}"
         ${isActive(l.href) ? 'aria-current="page"' : ''}
         aria-label="${l.label}">
        <div class="kfl-bottom-nav__icon-wrapper">
          <div class="kfl-bottom-nav__icon-bg"></div>
          <span class="material-symbols-rounded">${l.icon}</span>
          <div class="kfl-bottom-nav__glow"></div>
        </div>
        <span class="kfl-bottom-nav__label">${l.label}</span>
      </a>`).join('');

    return `<nav class="kfl-bottom-nav">${navItems}</nav>`;
  }

  // 5. Updated Theme Toggle Logic (Icon name swap)
  function setupTheme() {
    const htmlEl = document.documentElement;
    const btn    = document.getElementById('theme-toggle');
    const icon   = document.getElementById('theme-icon');
    if (!btn) return;

    function applyTheme(t) {
      htmlEl.setAttribute('data-theme', t);
      if (icon) {
        icon.style.opacity = '0';
        setTimeout(() => {
          icon.textContent = t === 'dark' ? 'dark_mode' : 'light_mode';
          icon.style.opacity = '1';
        }, 180);
      }
      localStorage.setItem('kopala_theme', t);
    }
    // ... (rest of setupTheme remains same)
  }

  // ... (setupDrawer, setupBottomNav, and loadNav remain the same)
})();
