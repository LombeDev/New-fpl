/**
 * nav.js — Kopala FPL Navigation
 * Mobile: sticky top bar + fixed bottom tab bar
 * Desktop: fixed top bar + fixed sidebar
 */

(function () {
  'use strict';

  const NAV_LINKS = [
    { href: 'index.html',   label: 'Home',    icon: 'fa-house' },
    { href: 'leagues.html', label: 'Leagues', icon: 'fa-trophy' },
    { href: 'prices.html',  label: 'Prices',  icon: 'fa-tags' },
    { href: 'games.html',   label: 'Games',   icon: 'fa-gamepad' },
    { href: 'prizes.html',  label: 'Prizes',  icon: 'fa-gift' },
  ];

  // Get current page filename
  function currentPage() {
    return window.location.pathname.split('/').pop() || 'index.html';
  }

  function isActive(href) {
    return href === currentPage();
  }

  // Build mobile top bar
  function buildMobileTopbar() {
    return `
      <header class="mobile-topbar">
        <img src="logo.png" alt="Kopala FPL" class="mobile-topbar__logo">
        <div class="mobile-topbar__actions">
          <button class="icon-btn" id="change-id-btn" title="Change Team ID" aria-label="Change Team ID">
            <i class="fa-solid fa-right-from-bracket"></i>
          </button>
        </div>
      </header>
    `;
  }

  // Build mobile bottom tab bar
  function buildBottomNav() {
    const items = NAV_LINKS.map(link => `
      <a href="${link.href}" class="bottom-nav__item ${isActive(link.href) ? 'active' : ''}">
        <i class="fa-solid ${link.icon} bottom-nav__icon"></i>
        <span class="bottom-nav__label">${link.label}</span>
      </a>
    `).join('');

    return `<nav class="bottom-nav" role="navigation" aria-label="Main navigation">${items}</nav>`;
  }

  // Build desktop top bar
  function buildDesktopTopbar() {
    const links = NAV_LINKS.slice(0, 3).map(link => `
      <a href="${link.href}" class="desktop-topbar__link ${isActive(link.href) ? 'active' : ''}">
        <i class="fa-solid ${link.icon}"></i>
        ${link.label}
      </a>
    `).join('');

    return `
      <header class="desktop-topbar" role="banner">
        <img src="logo.png" alt="Kopala FPL" class="desktop-topbar__logo">
        <div class="desktop-topbar__divider"></div>
        <nav class="desktop-topbar__links" aria-label="Quick nav">${links}</nav>
        <div class="desktop-topbar__right">
          <button class="topbar-id-btn" id="change-id-btn-desktop">
            <i class="fa-solid fa-right-from-bracket"></i>
            Change ID
          </button>
        </div>
      </header>
    `;
  }

  // Build desktop sidebar
  function buildDesktopSidebar() {
    const links = NAV_LINKS.map(link => `
      <a href="${link.href}" class="sidebar-link ${isActive(link.href) ? 'active' : ''}">
        <i class="fa-solid ${link.icon}"></i>
        ${link.label}
      </a>
    `).join('');

    return `
      <aside class="desktop-sidebar" role="complementary" aria-label="Site navigation">
        <p class="sidebar-section-title">Menu</p>
        ${links}
        <div class="sidebar-divider"></div>
        <p class="sidebar-section-title">Account</p>
        <button class="sidebar-link" style="background:none;border:none;width:100%;text-align:left;cursor:pointer;" id="change-id-btn-sidebar">
          <i class="fa-solid fa-right-from-bracket"></i>
          Change ID
        </button>
      </aside>
    `;
  }

  // Wire up change-ID buttons
  function setupChangeId() {
    const ids = ['change-id-btn', 'change-id-btn-desktop', 'change-id-btn-sidebar'];
    ids.forEach(id => {
      const btn = document.getElementById(id);
      if (btn) {
        btn.addEventListener('click', () => {
          if (confirm('Change your Team ID?')) {
            localStorage.removeItem('kopala_id');
            window.location.href = 'index.html';
          }
        });
      }
    });
  }

  // Inject everything
  function loadNav() {
    const placeholder = document.getElementById('nav-placeholder');
    if (!placeholder) return;

    placeholder.innerHTML =
      buildMobileTopbar() +
      buildBottomNav() +
      buildDesktopTopbar() +
      buildDesktopSidebar();

    setupChangeId();
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNav);
  } else {
    loadNav();
  }

  // Expose resetTeamID globally for any legacy inline calls
  window.resetTeamID = function () {
    if (confirm('Change your Team ID?')) {
      localStorage.removeItem('kopala_id');
      window.location.href = 'index.html';
    }
  };
})();
