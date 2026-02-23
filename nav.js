/**
 * nav.js — Kopala FPL Navigation
 * LiveFPL-style: single top bar + secondary tab strip
 * Mobile: top bar + bottom tab bar + slide-in drawer
 * Desktop: top bar (with inline links) + tab strip below
 */

(function () {
  'use strict';

  const NAV_LINKS = [
    { href: 'index.html',   label: 'Home',          icon: 'fa-house' },
    { href: 'leagues.html', label: 'Leagues',        icon: 'fa-trophy' },
    { href: 'prices.html',  label: 'Price Changes',  icon: 'fa-tags' },
    { href: 'games.html',   label: 'Games',          icon: 'fa-gamepad' },
    { href: 'team.html',    label: 'My Team',        icon: 'fa-shirt' },
  ];

  function currentPage() {
    return window.location.pathname.split('/').pop() || 'index.html';
  }

  function isActive(href) {
    return href === currentPage();
  }

  /* ── Logo HTML ──────────────────────────────────────────── */
  function logoHTML() {
    return `
      <a href="index.html" class="kfl-logo">
        <div class="kfl-logo__box">
          <span class="kfl-logo__text">KOPALA</span>
          <span class="kfl-logo__arrow"></span>
          <span class="kfl-logo__text">FPL</span>
        </div>
      </a>`;
  }

  /* ── Top bar ────────────────────────────────────────────── */
  function buildTopbar() {
    const navLinks = NAV_LINKS.slice(1).map(l => `
      <a href="${l.href}" class="kfl-topbar__link ${isActive(l.href) ? 'is-active' : ''}">
        <i class="fa-solid ${l.icon}"></i><span>${l.label}</span>
      </a>`).join('');

    return `
      <header class="kfl-topbar">
        ${logoHTML()}
        <nav class="kfl-topbar__nav" aria-label="Main navigation">${navLinks}</nav>
        <div class="kfl-topbar__right">
          <button class="kfl-btn-ads">
            <i class="fa-solid fa-heart"></i> Remove Ads
          </button>
          <button class="kfl-btn-country" id="country-btn">
            <span>ZM</span>
            <i class="fa-solid fa-chevron-down chevron"></i>
          </button>
          <button class="kfl-theme-toggle" id="theme-toggle" aria-label="Toggle theme">
            <i class="fa-solid fa-sun" id="theme-icon"></i>
          </button>
          <button class="kfl-hamburger" id="hamburger" aria-label="Menu">
            <i class="fa-solid fa-bars"></i>
          </button>
        </div>
      </header>`;
  }

  /* ── Tab bar ─────────────────────────────────────────────── */
  function buildTabbar() {
    const tabs = NAV_LINKS.map(l => `
      <a href="${l.href}" class="kfl-tab ${isActive(l.href) ? 'is-active' : ''}">
        <i class="fa-solid ${l.icon}"></i><span>${l.label}</span>
      </a>`).join('');

    return `
      <nav class="kfl-tabbar" aria-label="Page tabs">
        <div class="kfl-tabbar__inner">${tabs}</div>
      </nav>`;
  }

  /* ── Mobile bottom nav ───────────────────────────────────── */
  function buildBottomNav() {
    const items = NAV_LINKS.map(l => `
      <a href="${l.href}" class="kfl-bottom-nav__item ${isActive(l.href) ? 'is-active' : ''}">
        <i class="fa-solid ${l.icon} kfl-bottom-nav__icon"></i>
        <span class="kfl-bottom-nav__label">${l.label}</span>
      </a>`).join('');

    return `<nav class="kfl-bottom-nav" aria-label="Navigation">${items}</nav>`;
  }

  /* ── Drawer ──────────────────────────────────────────────── */
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
        <button class="kfl-drawer__link" id="change-id-btn" style="background:none;border:none;width:100%;text-align:left;cursor:pointer;font-family:inherit;">
          <i class="fa-solid fa-right-from-bracket"></i>Change Team ID
        </button>
      </div>`;
  }

  /* ── Theme logic ─────────────────────────────────────────── */
  function setupTheme() {
    const html = document.documentElement;
    const btn  = document.getElementById('theme-toggle');
    const icon = document.getElementById('theme-icon');
    if (!btn) return;

    function apply(t) {
      html.setAttribute('data-theme', t);
      icon.className = t === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
      localStorage.setItem('kopala_theme', t);
    }

    const saved = localStorage.getItem('kopala_theme');
    if (saved) apply(saved);

    btn.addEventListener('click', () => {
      apply(html.getAttribute('data-theme') === 'dark' ? 'light' : 'dark');
    });
  }

  /* ── Drawer logic ────────────────────────────────────────── */
  function setupDrawer() {
    const drawer   = document.getElementById('kfl-drawer');
    const overlay  = document.getElementById('kfl-overlay');
    const hamburger = document.getElementById('hamburger');
    const closeBtn  = document.getElementById('drawer-close');
    if (!drawer) return;

    function open()  { drawer.classList.add('is-open'); overlay.classList.add('is-open'); document.body.style.overflow = 'hidden'; }
    function close() { drawer.classList.remove('is-open'); overlay.classList.remove('is-open'); document.body.style.overflow = ''; }

    hamburger?.addEventListener('click', open);
    closeBtn?.addEventListener('click', close);
    overlay?.addEventListener('click', close);
  }

  /* ── Change ID ───────────────────────────────────────────── */
  function setupChangeId() {
    document.getElementById('change-id-btn')?.addEventListener('click', () => {
      if (confirm('Change your Team ID?')) {
        localStorage.removeItem('kopala_id');
        window.location.href = 'index.html';
      }
    });
  }

  /* ── Inject ──────────────────────────────────────────────── */
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

  // Legacy global
  window.resetTeamID = function () {
    if (confirm('Change your Team ID?')) {
      localStorage.removeItem('kopala_id');
      window.location.href = 'index.html';
    }
  };

})();
