(function () {
  'use strict';

  // 1. SUB-NAV LINKS (Row 2 — The Pills)
  const SUB_NAV_LINKS = [
    { href: 'index.html',    label: 'Summary',  icon: 'fa-chart-simple' },
    { href: 'squad.html',    label: 'Squad',    icon: 'fa-futbol' },
    { href: 'captains.html', label: 'Captains', icon: 'fa-star' },
    { href: 'games.html',    label: 'Live',     icon: 'fa-circle' }
  ];

  // 2. DRAWER LINKS (Hamburger Menu)
  const DRAWER_LINKS = [
    { href: 'index.html',   label: 'Home',     icon: 'fa-house' },
    { href: 'leagues.html', label: 'Leagues',  icon: 'fa-trophy' },
    { href: 'prices.html',  label: 'Prices',   icon: 'fa-dollar-sign' },
    { href: 'games.html',   label: 'Games',    icon: 'fa-futbol' },
  ];

  // ── HELPERS ──────────────────────────────────────────────
  function currentPage() {
    return window.location.pathname.split('/').pop() || 'index.html';
  }

  function isActive(href) {
    return href === currentPage();
  }

  function logoHTML() {
    return `
      <a href="index.html" class="kfl-logo" aria-label="Kopala FPL Home">
        <div class="kfl-logo__box">
          <img src="logo.png" alt="Kopala FPL" class="kfl-logo__img"
               onerror="this.style.display='none'; this.nextElementSibling.style.display='block'">
          <span class="kfl-logo__text" style="display:none">Kopala <span>FPL</span></span>
        </div>
      </a>`;
  }

  // ── BUILDERS ─────────────────────────────────────────────

  function buildTopbar() {
    return `
      <header class="kfl-topbar" role="banner">
        ${logoHTML()}
        <div class="kfl-topbar__right">
          <button class="kfl-theme-toggle" id="theme-toggle" title="Toggle Theme" aria-label="Toggle dark/light mode">
            <i class="fa-solid fa-sun" id="theme-icon" aria-hidden="true"></i>
          </button>
          <button class="kfl-hamburger" id="hamburger" title="Open Menu"
                  aria-label="Open navigation menu" aria-expanded="false" aria-controls="kfl-drawer">
            <i class="fa-solid fa-bars" aria-hidden="true"></i>
          </button>
        </div>
      </header>`;
  }

  function buildSubNav() {
    const links = SUB_NAV_LINKS.map(l => `
      <a href="${l.href}"
         class="kfl-subnav__link${isActive(l.href) ? ' is-active' : ''}"
         ${isActive(l.href) ? 'aria-current="page"' : ''}>
        <i class="fa-solid ${l.icon}" aria-hidden="true"></i>
        <span>${l.label}</span>
      </a>`).join('');

    return `
      <nav class="kfl-subnav" aria-label="Primary navigation">
        <div class="kfl-subnav__inner">${links}</div>
      </nav>`;
  }

  function buildDrawer() {
    const drawerItems = DRAWER_LINKS.map(l => `
      <a href="${l.href}"
         class="kfl-drawer__link${isActive(l.href) ? ' is-active' : ''}"
         ${isActive(l.href) ? 'aria-current="page"' : ''}>
        <div class="kfl-drawer__icon-box" aria-hidden="true">
          <i class="fa-solid ${l.icon}"></i>
        </div>
        <span>${l.label}</span>
      </a>`).join('');

    return `
      <div class="kfl-overlay" id="kfl-overlay" role="presentation"></div>
      <nav class="kfl-drawer" id="kfl-drawer"
           aria-label="Drawer navigation"
           aria-hidden="true"
           inert>
        <div class="kfl-drawer__head">
          ${logoHTML()}
          <button id="drawer-close" title="Close Menu" aria-label="Close navigation menu">
            <i class="fa-solid fa-xmark" aria-hidden="true"></i>
          </button>
        </div>
        <div class="kfl-drawer__content">
          <p class="kfl-drawer__section-title" aria-hidden="true">Explore</p>
          ${drawerItems}
          <button class="kfl-drawer__link" id="change-id-btn" type="button">
            <div class="kfl-drawer__icon-box" aria-hidden="true">
              <i class="fa-solid fa-right-from-bracket"></i>
            </div>
            <span>Change Team ID</span>
          </button>
        </div>
      </nav>`;
  }

  // ── THEME ─────────────────────────────────────────────────
  function setupTheme() {
    const htmlEl = document.documentElement;
    const btn    = document.getElementById('theme-toggle');
    const icon   = document.getElementById('theme-icon');
    if (!btn) return;

    function applyTheme(t) {
      htmlEl.setAttribute('data-theme', t);
      if (icon) {
        icon.style.transform = 'rotate(360deg) scale(0.5)';
        icon.style.opacity   = '0';
        setTimeout(() => {
          icon.className = t === 'dark' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
          icon.style.transform = '';
          icon.style.opacity   = '';
        }, 180);
      }
      localStorage.setItem('kopala_theme', t);
    }

    if (icon) {
      icon.style.transition = 'transform 0.18s ease, opacity 0.18s ease';
    }

    const saved = localStorage.getItem('kopala_theme') ||
                  (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(saved);

    btn.onclick = () => {
      const next = htmlEl.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      applyTheme(next);
    };
  }

  // ── DRAWER ───────────────────────────────────────────────
  function setupDrawer() {
    const drawer   = document.getElementById('kfl-drawer');
    const overlay  = document.getElementById('kfl-overlay');
    const openBtn  = document.getElementById('hamburger');
    const closeBtn = document.getElementById('drawer-close');
    if (!drawer || !openBtn) return;

    function open() {
      drawer.classList.add('is-open');
      overlay.classList.add('is-open');
      // Remove inert BEFORE aria update so AT picks up the change correctly
      drawer.removeAttribute('inert');
      drawer.setAttribute('aria-hidden', 'false');
      openBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      // Move focus into the drawer after the CSS transition starts
      setTimeout(() => closeBtn?.focus(), 50);
    }

    function close() {
      drawer.classList.remove('is-open');
      overlay.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      openBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      // Re-apply inert AFTER transition so the closing animation still plays
      // (inert during transition would freeze it in some browsers)
      setTimeout(() => drawer.setAttribute('inert', ''), 320);
      // Return focus to the trigger
      openBtn.focus();
    }

    openBtn.addEventListener('click', open);
    closeBtn?.addEventListener('click', close);
    overlay?.addEventListener('click', close);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) close();
    });
  }

  // ── SUBNAV: scroll active pill into view ────────────────
  function scrollActiveIntoView() {
    const active = document.querySelector('.kfl-subnav__link.is-active');
    if (active) {
      active.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' });
    }
  }

  // ── RIPPLE on pill tap ───────────────────────────────────
  function setupRipples() {
    document.querySelectorAll('.kfl-subnav__link').forEach(link => {
      link.addEventListener('click', function () {
        this.style.transform = 'scale(0.96)';
        setTimeout(() => { this.style.transform = ''; }, 150);
      });
    });
  }

  // ── INIT ─────────────────────────────────────────────────
  function loadNav() {
    const placeholder = document.getElementById('nav-placeholder');
    if (!placeholder) return;

    placeholder.innerHTML = buildTopbar() + buildSubNav() + buildDrawer();

    setupTheme();
    setupDrawer();
    scrollActiveIntoView();
    setupRipples();

    document.getElementById('change-id-btn')?.addEventListener('click', () => {
      if (confirm('Are you sure you want to change your Team ID?')) {
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
