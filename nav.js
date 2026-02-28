(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // NAVIGATION LINKS — Fully Independent Configuration
  // ─────────────────────────────────────────────────────────────

  // 1. HAMBURGER MENU LINKS (Drawer Navigation)
  const DRAWER_LINKS = [
    { href: 'index.html',       label: 'Home',       icon: 'fa-house' },
    { href: 'leagues.html',     label: 'Leagues',    icon: 'fa-trophy' },
    { href: 'prices.html',      label: 'Prices',     icon: 'fa-dollar-sign' },
    { href: 'games.html',       label: 'Games',      icon: 'fa-futbol' },
    { href: 'transfers.html',   label: 'Transfers',  icon: 'fa-arrows-rotate' },
    { href: 'fixtures.html',    label: 'Fixtures',   icon: 'fa-calendar' },
    { href: 'statistics.html',  label: 'Statistics', icon: 'fa-chart-line' },
  ];

  // 2. BOTTOM NAV LINKS (Bottom Navigation Bar)
  const BOTTOM_NAV_LINKS = [
    { href: 'index.html',   label: 'Home',    icon: 'fa-house',       emotion: '🏠' },
    { href: 'leagues.html', label: 'Leagues', icon: 'fa-futbol',      emotion: '🏆' },
    { href: 'prices.html',  label: 'Prices',  icon: 'fa-star',        emotion: '📈' },
    { href: 'games.html',   label: 'Games',   icon: 'fa-futbol',      emotion: '⚽' },
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

  // ── BOTTOM NAV ───────────────────────────────────────────
  function buildBottomNav() {
    const navItems = BOTTOM_NAV_LINKS.map(l => `
      <a href="${l.href}"
         class="kfl-bottom-nav__item${isActive(l.href) ? ' is-active' : ''}"
         data-emotion="${l.emotion}"
         ${isActive(l.href) ? 'aria-current="page"' : ''}
         aria-label="${l.label}">
        <div class="kfl-bottom-nav__icon-wrapper">
          <div class="kfl-bottom-nav__icon-bg"></div>
          <i class="fa-solid ${l.icon}" aria-hidden="true"></i>
          <div class="kfl-bottom-nav__glow"></div>
        </div>
        <span class="kfl-bottom-nav__label">${l.label}</span>
        <div class="kfl-bottom-nav__emoji" aria-hidden="true">${l.emotion}</div>
      </a>`).join('');

    return `
      <nav class="kfl-bottom-nav" aria-label="Main navigation" role="navigation">
        <div class="kfl-bottom-nav__inner">
          ${navItems}
        </div>
        <div class="kfl-bottom-nav__exit-prompt" id="exit-prompt" aria-live="polite" aria-atomic="true"></div>
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
      drawer.removeAttribute('inert');
      drawer.setAttribute('aria-hidden', 'false');
      openBtn.setAttribute('aria-expanded', 'true');
      document.body.style.overflow = 'hidden';
      setTimeout(() => closeBtn?.focus(), 50);
    }

    function close() {
      drawer.classList.remove('is-open');
      overlay.classList.remove('is-open');
      drawer.setAttribute('aria-hidden', 'true');
      openBtn.setAttribute('aria-expanded', 'false');
      document.body.style.overflow = '';
      setTimeout(() => drawer.setAttribute('inert', ''), 320);
      openBtn.focus();
    }

    openBtn.addEventListener('click', open);
    closeBtn?.addEventListener('click', close);
    overlay?.addEventListener('click', close);

    document.addEventListener('keydown', e => {
      if (e.key === 'Escape' && drawer.classList.contains('is-open')) close();
    });
  }

  // ── BOTTOM NAV SETUP ─────────────────────────────────────
  function setupBottomNav() {
    const items      = document.querySelectorAll('.kfl-bottom-nav__item');
    const exitPrompt = document.getElementById('exit-prompt');

    items.forEach((item) => {
      // Ripple & scale interaction
      item.addEventListener('click', function (e) {
        const ripple = document.createElement('span');
        ripple.className = 'kfl-bottom-nav__ripple';
        const rect = this.getBoundingClientRect();
        const size = Math.max(rect.width, rect.height);
        ripple.style.width  = ripple.style.height = size + 'px';
        ripple.style.left   = (e.clientX - rect.left - size / 2) + 'px';
        ripple.style.top    = (e.clientY - rect.top  - size / 2) + 'px';
        this.appendChild(ripple);
        setTimeout(() => ripple.remove(), 600);

        this.style.transform = 'scale(0.92)';
        setTimeout(() => { this.style.transform = ''; }, 120);
      });

      item.addEventListener('mouseenter', function () {
        this.classList.add('is-hovered');
      });

      item.addEventListener('mouseleave', function () {
        this.classList.remove('is-hovered');
      });

      if (item.classList.contains('is-active')) {
        setTimeout(() => {
          item.classList.add('is-celebrating');
          setTimeout(() => item.classList.remove('is-celebrating'), 600);
        }, 100);
      }
    });

    window.addEventListener('beforeunload', function () {
      const activeItem = document.querySelector('.kfl-bottom-nav__item.is-active');
      if (activeItem && exitPrompt) {
        exitPrompt.textContent = activeItem.dataset.emotion + ' Come back soon!';
        exitPrompt.classList.add('is-visible');
      }
    });

    const activeItem = document.querySelector('.kfl-bottom-nav__item.is-active');
    if (activeItem) {
      activeItem.classList.add('is-celebrating');
      const emoji = activeItem.querySelector('.kfl-bottom-nav__emoji');
      if (emoji) emoji.style.animation = 'float 2s ease-in-out';
    }
  }

  // ── INIT ─────────────────────────────────────────────────
  function loadNav() {
    const placeholder = document.getElementById('nav-placeholder');
    if (!placeholder) return;

    placeholder.innerHTML = buildTopbar() + buildDrawer() + buildBottomNav();

    setupTheme();
    setupDrawer();
    setupBottomNav();

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
