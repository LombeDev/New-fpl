/**
 * nav.js — Kopala FPL Navigation
 * LiveFPL-style: top bar + secondary tab strip
 * Dark = Telegram Night Mode (#17212b / #232e3c / #2b3f52 — blue-navy, NOT grey)
 *
 * IMPORTANT: To prevent theme flash on page load, add this to your <head>
 * BEFORE your stylesheet link:
 *
 *   <script>
 *     (function(){
 *       var t = localStorage.getItem('kopala_theme');
 *       if(t) document.documentElement.setAttribute('data-theme', t);
 *     })();
 *   </script>
 */

(function () {
  'use strict';

  // 1. MAIN LINKS (Visible in Top/Bottom/Tab bars)
  const NAV_LINKS = [
    { href: 'index.html',     label: 'Home',      icon: 'fa-house' },
    { href: 'squad.html',     label: 'Squad',     icon: 'fa-shirt' },
    { href: 'games.html',     label: 'Live',      icon: 'fa-fire' }
  ];

  // 2. DRAWER-ONLY LINKS (Visible only in Hamburger menu)
  const DRAWER_LINKS = [
    { href: 'index.html',      label: 'Home',           icon: 'fa-house' },
    { href: 'rankings.html',   label: 'Global Rank',    icon: 'fa-trophy' },
    { href: 'leagues.html',    label: 'Mini-Leagues',   icon: 'fa-users' },
    { href: 'tools.html',      label: 'FPL Tools',      icon: 'fa-screwdriver-wrench' },
    { href: 'https://fpl.com', label: 'Official Site',  icon: 'fa-arrow-up-right-from-square' }
  ];

  // ... [Keep your existing isActive() and logoHTML() functions] ...

  function buildDrawer() {
    // We use DRAWER_LINKS here instead of NAV_LINKS
    const drawerItems = DRAWER_LINKS.map(l => `
      <a href="${l.href}" class="kfl-drawer__link ${isActive(l.href) ? 'is-active' : ''}">
        <div class="kfl-drawer__icon-box"><i class="fa-solid ${l.icon}"></i></div>
        <span>${l.label}</span>
      </a>`).join('');

    return `
      <div class="kfl-overlay" id="kfl-overlay"></div>
      <div class="kfl-drawer" id="kfl-drawer">
        <div class="kfl-drawer__header">
          ${logoHTML()}
          <button id="drawer-close"><i class="fa-solid fa-xmark"></i></button>
        </div>
        
        <div class="kfl-drawer__scroll-area">
          <p class="kfl-drawer__label-tiny">BROWSE KOPALA</p>
          ${drawerItems}
          
          <div class="kfl-drawer__divider"></div>
          
          <p class="kfl-drawer__label-tiny">ACCOUNT</p>
          <button class="kfl-drawer__link" id="change-id-btn">
            <div class="kfl-drawer__icon-box"><i class="fa-solid fa-id-card"></i></div>
            <span>Switch Team ID</span>
          </button>
        </div>
      </div>`;
  }

  // ... [Keep the rest of your setup and loading logic] ...
})();
  function buildTabbar() {
    const tabs = NAV_LINKS.map(l => `
      <a href="${l.href}" class="kfl-tab ${isActive(l.href) ? 'is-active' : ''}">
        <i class="fa-solid ${l.icon}"></i><span>${l.label}</span>
      </a>`).join('');
    return `<nav class="kfl-tabbar" aria-label="Page tabs"><div class="kfl-tabbar__inner">${tabs}</div></nav>`;
  }

  function buildBottomNav() {
    const items = NAV_LINKS.map(l => `
      <a href="${l.href}" class="kfl-bottom-nav__item ${isActive(l.href) ? 'is-active' : ''}">
        <i class="fa-solid ${l.icon} kfl-bottom-nav__icon"></i>
        <span class="kfl-bottom-nav__label">${l.label}</span>
      </a>`).join('');
    return `<nav class="kfl-bottom-nav" aria-label="Navigation">${items}</nav>`;
  }

  function buildDrawer() {
    const links = NAV_LINKS.map(l => `
      <a href="${l.href}" class="kfl-drawer__link ${isActive(l.href) ? 'is-active' : ''}">
        <i class="fa-solid ${l.icon}"></i>${l.label}
      </a>`).join('');
    return `
      <div class="kfl-overlay" id="kfl-overlay"></div>
      <div class="kfl-drawer" id="kfl-drawer" role="dialog" aria-label="Menu">
        <div class="kfl-drawer__head">
          ${logoHTML()}
          <button class="kfl-drawer__close" id="drawer-close">
            <i class="fa-solid fa-xmark"></i>
          </button>
        </div>
        <p class="kfl-drawer__section-title">Navigation</p>
        ${links}
        <div class="kfl-drawer__divider"></div>
        <p class="kfl-drawer__section-title">Account</p>
        <button class="kfl-drawer__link" id="change-id-btn">
          <i class="fa-solid fa-right-from-bracket"></i>Change Team ID
        </button>
      </div>`;
  }

  function setupTheme() {
    const htmlEl    = document.documentElement;
    const btn       = document.getElementById('theme-toggle');
    const icon      = document.getElementById('theme-icon');
    if (!btn) return;

    function apply(t) {
      htmlEl.setAttribute('data-theme', t);
      icon.className = t === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
      localStorage.setItem('kopala_theme', t);
    }

    // Sync icon with whatever theme is currently set (may have been set by inline script)
    const current = htmlEl.getAttribute('data-theme') || localStorage.getItem('kopala_theme') || 'light';
    apply(current);

    btn.addEventListener('click', () => {
      apply(htmlEl.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  }

  function setupDrawer() {
    const drawer    = document.getElementById('kfl-drawer');
    const overlay   = document.getElementById('kfl-overlay');
    const hamburger = document.getElementById('hamburger');
    const closeBtn  = document.getElementById('drawer-close');
    if (!drawer) return;

    const open  = () => { drawer.classList.add('is-open'); overlay.classList.add('is-open'); document.body.style.overflow = 'hidden'; };
    const close = () => { drawer.classList.remove('is-open'); overlay.classList.remove('is-open'); document.body.style.overflow = ''; };

    hamburger?.addEventListener('click', open);
    closeBtn?.addEventListener('click', close);
    overlay?.addEventListener('click', close);
  }

  function setupChangeId() {
    document.getElementById('change-id-btn')?.addEventListener('click', () => {
      if (confirm('Change your Team ID?')) {
        localStorage.removeItem('kopala_id');
        window.location.href = 'index.html';
      }
    });
  }

  function loadNav() {
    const placeholder = document.getElementById('nav-placeholder');
    if (!placeholder) return;

    placeholder.innerHTML =
      buildTopbar() +
      buildTabbar() +
      buildBottomNav() +
      buildDrawer();

    setupTheme();
    setupDrawer();
    setupChangeId();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNav);
  } else {
    loadNav();
  }

  window.resetTeamID = function () {
    if (confirm('Change your Team ID?')) {
      localStorage.removeItem('kopala_id');
      window.location.href = 'index.html';
    }
  };
})();
