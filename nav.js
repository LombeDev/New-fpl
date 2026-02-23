(function () {
  'use strict';

  // 1. TOP BAR LINKS (Row 1 - Used for Desktop/Logic)
  const TOP_LINKS = [
    { href: 'index.html', label: 'Home',  icon: 'fa-house' },
    { href: 'squad.html', label: 'Squad', icon: 'fa-shirt' }
  ];

  // 2. SUB-NAV LINKS (Row 2 - The Pills seen in Capture2.PNG)
  const SUB_NAV_LINKS = [
    { href: 'index.html',   label: 'Summary',  icon: 'fa-chart-simple' },
    { href: 'squad.html',     label: 'Squad',    icon: 'fa-futbol' },
    { href: 'captains.html',  label: 'Captains', icon: 'fa-star' },
    { href: 'games.html',     label: 'Live',     icon: 'fa-circle' } // Icon for the red dot
  ];

  // 3. DRAWER LINKS (Hamburger Menu - Capture.PNG & c2.PNG)
  const DRAWER_LINKS = [
    { href: 'index.html',   label: 'Home',     icon: 'fa-house' },
    { href: 'leagues.html', label: 'Leagues',  icon: 'fa-trophy' },
    { href: 'prices.html',  label: 'Prices',   icon: 'fa-dollar-sign' },
    { href: 'games.html',   label: 'Games',    icon: 'fa-futbol' },
    { href: 'team.html',    label: 'My team',  icon: 'fa-shirt' }
  ];

  // --- HELPERS ---
  function currentPage() {
    return window.location.pathname.split('/').pop() || 'index.html';
  }
  function isActive(href) { return href === currentPage(); }

  // Matches the refined Logo CSS
  function logoHTML() {
    return `
      <a href="index.html" class="kfl-logo">
        <div class="kfl-logo__box">
          <img src="logo.png" alt="Kopala FPL" class="kfl-logo__img">
        </div>
      </a>`;
  }

  // --- BUILDERS ---

  function buildTopbar() {
    return `
      <header class="kfl-topbar">
        ${logoHTML()}
        <div class="kfl-topbar__right">
          <button class="kfl-theme-toggle" id="theme-toggle" title="Toggle Theme">
            <i class="fa-solid fa-sun" id="theme-icon"></i>
          </button>
          <button class="kfl-hamburger" id="hamburger" title="Open Menu">
            <i class="fa-solid fa-bars"></i>
          </button>
        </div>
      </header>`;
  }

  function buildSubNav() {
    const links = SUB_NAV_LINKS.map(l => `
      <a href="${l.href}" class="kfl-subnav__link ${isActive(l.href) ? 'is-active' : ''}">
        <i class="fa-solid ${l.icon}"></i>
        <span>${l.label}</span>
      </a>`).join('');
    
    return `<nav class="kfl-subnav"><div class="kfl-subnav__inner">${links}</div></nav>`;
  }

  function buildDrawer() {
    const drawerItems = DRAWER_LINKS.map(l => `
      <a href="${l.href}" class="kfl-drawer__link ${isActive(l.href) ? 'is-active' : ''}">
        <div class="kfl-drawer__icon-box"><i class="fa-solid ${l.icon}"></i></div>
        <span>${l.label}</span>
      </a>`).join('');

    return `
      <div class="kfl-overlay" id="kfl-overlay"></div>
      <div class="kfl-drawer" id="kfl-drawer">
        <div class="kfl-drawer__head">
          ${logoHTML()}
          <button id="drawer-close" title="Close Menu"><i class="fa-solid fa-xmark"></i></button>
        </div>
        <div class="kfl-drawer__content">
          <p class="kfl-drawer__section-title">EXPLORE</p>
          ${drawerItems}
          <div class="kfl-drawer__divider"></div>
          <button class="kfl-drawer__link" id="change-id-btn">
            <div class="kfl-drawer__icon-box"><i class="fa-solid fa-right-from-bracket"></i></div>
            <span>Change Team ID</span>
          </button>
        </div>
      </div>`;
  }

  // --- LOGIC ---
  function setupTheme() {
    const htmlEl = document.documentElement;
    const btn = document.getElementById('theme-toggle');
    const icon = document.getElementById('theme-icon');
    if (!btn) return;
    const apply = (t) => {
      htmlEl.setAttribute('data-theme', t);
      if (icon) icon.className = t === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
      localStorage.setItem('kopala_theme', t);
    };
    const current = localStorage.getItem('kopala_theme') || 'light';
    apply(current);
    btn.onclick = () => apply(htmlEl.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
  }

  function setupDrawer() {
    const drawer = document.getElementById('kfl-drawer');
    const overlay = document.getElementById('kfl-overlay');
    const openBtn = document.getElementById('hamburger');
    const closeBtn = document.getElementById('drawer-close');
    if (!drawer || !openBtn) return;
    const toggle = (state) => {
      drawer.classList.toggle('is-open', state);
      overlay.classList.toggle('is-open', state);
      document.body.style.overflow = state ? 'hidden' : '';
    };
    openBtn.onclick = () => toggle(true);
    if (closeBtn) closeBtn.onclick = () => toggle(false);
    if (overlay) overlay.onclick = () => toggle(false);
  }

  function loadNav() {
    const placeholder = document.getElementById('nav-placeholder');
    if (!placeholder) return;

    placeholder.innerHTML = buildTopbar() + buildSubNav() + buildDrawer();

    setupTheme();
    setupDrawer();
    
    // Re-bind click for ID button
    document.getElementById('change-id-btn')?.addEventListener('click', () => {
       if (confirm('Change your Team ID?')) {
         localStorage.removeItem('kopala_id');
         window.location.href = 'index.html';
       }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNav);
  } else {
    loadNav();
  }
})();
