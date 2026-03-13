/* ============================================================
   KOPALA FPL — NAVIGATION MODULE  v6
   Topbar  : DYNAMIC — title + contextual icons per active page
             (Play Store / WhatsApp / LinkedIn behaviour)
   Menu    : full-screen overlay · large bold links
   Bottom  : Home · Leagues · Prices · Live  (Material Symbols)
   ============================================================ */

(function () {
  'use strict';

  /* ── PAGE CONFIG ─────────────────────────────────────────────
     Each page declares:
       title   : text shown in topbar (null = show logo instead)
       showLogo: show the Kopala logo (true on home only)
       live    : show red LIVE badge next to title
       actions : icon buttons on the RIGHT  { icon, id, label, menuTrigger? }
  ──────────────────────────────────────────────────────────── */
  const PAGE_CONFIG = {
    'index.html': {
      title:    null,
      showLogo: true,
      actions: [
        { icon: 'notifications', id: 'topbar-notif-btn',  label: 'Notifications' },
        { icon: 'more_vert',     id: 'dots-btn',          label: 'Open menu', menuTrigger: true },
      ],
    },
    'leagues.html': {
      title:    'Leagues',
      showLogo: false,
      actions: [
        { icon: 'search',    id: 'topbar-search-btn', label: 'Search leagues' },
        { icon: 'more_vert', id: 'dots-btn',          label: 'Open menu', menuTrigger: true },
      ],
    },
    'prices.html': {
      title:    'Prices',
      showLogo: false,
      actions: [
        { icon: 'filter_list', id: 'topbar-filter-btn', label: 'Filter' },
        { icon: 'more_vert',   id: 'dots-btn',          label: 'Open menu', menuTrigger: true },
      ],
    },
    'games.html': {
      title:    'Live',
      showLogo: false,
      live:     true,
      actions: [
        { icon: 'calendar_today', id: 'topbar-cal-btn', label: 'Fixtures' },
        { icon: 'more_vert',      id: 'dots-btn',       label: 'Open menu', menuTrigger: true },
      ],
    },
    'myteam.html': {
      title:    'My Team',
      showLogo: false,
      actions: [
        { icon: 'swap_horiz', id: 'topbar-transfer-btn', label: 'Transfers' },
        { icon: 'more_vert',  id: 'dots-btn',            label: 'Open menu', menuTrigger: true },
      ],
    },
    'planner.html': {
      title:    'Planner',
      showLogo: false,
      actions: [
        { icon: 'more_vert', id: 'dots-btn', label: 'Open menu', menuTrigger: true },
      ],
    },
  };

  const NAV_LINKS = [
    { href: 'index.html',   label: 'Home',    icon: 'home' },
    { href: 'leagues.html', label: 'Leagues', icon: 'emoji_events' },
    { href: 'prices.html',  label: 'Prices',  icon: 'trending_up' },
    { href: 'games.html',   label: 'Live',    icon: 'sports_soccer', live: true },
  ];

  const MENU_LINKS = [
    { href: 'index.html',   label: 'Home'    },
    { href: 'leagues.html', label: 'Leagues' },
    { href: 'prices.html',  label: 'Prices'  },
    { href: 'games.html',   label: 'Live',   live: true },
  ];

  /* ── THEME ── */
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
  function notifGranted() { return window.Notification && Notification.permission === 'granted'; }
  function getPageConfig() {
    return PAGE_CONFIG[currentPage()] || PAGE_CONFIG['index.html'];
  }

  /* ── META THEME-COLOR ── */
  function injectThemeColorMeta() {
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    function sync() {
      const dark = document.documentElement.getAttribute('data-theme') !== 'light';
      meta.content = dark ? '#060810' : '#ffffff';
    }
    sync();
    new MutationObserver(sync).observe(document.documentElement, {
      attributes: true, attributeFilter: ['data-theme']
    });
  }

  /* ── INJECTED STYLES ── */
  function injectStyles() {
    if (document.getElementById('kfl-nav-v6-styles')) return;


    const s = document.createElement('style');
    s.id = 'kfl-nav-v6-styles';
    s.textContent = `

      /* ── Topbar left slot ── */
      .kfl-topbar__left {
        display: flex; align-items: center;
        justify-content: flex-start; flex-shrink: 0;
      }

      /* ── Topbar title slot ── */
      .kfl-topbar__title-wrap {
        flex: 1; display: flex; align-items: center;
        overflow: hidden; padding: 0 4px;
      }
      .kfl-topbar__title {
        font-family: var(--kfl-font);
        font-size: 20px; font-weight: 800;
        letter-spacing: -0.4px; line-height: 1;
        color: var(--text-1);
        white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
        animation: kflTitleIn 0.3s cubic-bezier(0.22,1,0.36,1) both;
      }
      @keyframes kflTitleIn {
        from { opacity: 0; transform: translateX(-8px); }
        to   { opacity: 1; transform: translateX(0); }
      }

      /* Live badge next to title */
      .kfl-topbar__live-badge {
        display: inline-flex; align-items: center; gap: 4px;
        margin-left: 8px; flex-shrink: 0;
        font-size: 9px; font-weight: 800; letter-spacing: 0.6px;
        text-transform: uppercase; color: var(--pink);
        background: var(--pink-dim);
        border: 1px solid rgba(255,51,82,0.22);
        border-radius: 100px; padding: 2px 7px 2px 5px; line-height: 1;
        animation: kflTitleIn 0.35s cubic-bezier(0.22,1,0.36,1) 0.06s both;
      }
      .kfl-topbar__live-dot {
        width: 5px; height: 5px; border-radius: 50%;
        background: var(--pink); flex-shrink: 0;
        animation: livepulse 1.8s ease-in-out infinite;
      }

      /* ── Topbar right actions ── */
      .kfl-topbar__actions {
        display: flex; align-items: center; gap: 2px; flex-shrink: 0;
        animation: kflActionsIn 0.32s cubic-bezier(0.22,1,0.36,1) 0.05s both;
      }
      @keyframes kflActionsIn {
        from { opacity: 0; transform: translateX(6px); }
        to   { opacity: 1; transform: translateX(0); }
      }

      /* Action icon button */
      .kfl-action-btn {
        width: 40px; height: 40px; border-radius: 50%;
        border: none; background: transparent;
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; color: var(--text-1);
        -webkit-tap-highlight-color: transparent; touch-action: manipulation;
        transition: background 0.14s ease, transform 0.12s var(--kfl-spring);
        position: relative;
      }
      .kfl-action-btn:active {
        transform: scale(0.82);
        background: var(--hover-bg);
      }
      .kfl-action-btn .material-symbols-rounded {
        font-size: 22px;
        font-variation-settings: 'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24;
        transition: font-variation-settings 0.18s ease;
        display: block;
      }
      .kfl-action-btn:active .material-symbols-rounded {
        font-variation-settings: 'FILL' 1, 'wght' 500, 'GRAD' 0, 'opsz' 24;
      }
      .kfl-action-btn.is-active .material-symbols-rounded {
        font-variation-settings: 'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 24;
        color: var(--accent);
      }

      /* Red dot on notification bell */
      .kfl-action-btn__dot {
        position: absolute; top: 7px; right: 7px;
        width: 7px; height: 7px; border-radius: 50%;
        background: var(--pink); border: 1.5px solid var(--bg);
        display: none;
      }
      .kfl-action-btn.has-notif .kfl-action-btn__dot { display: block; }

      /* ── Full-screen overlay ── */
      .kfl-overlay-menu {
        position: fixed; inset: 0; z-index: 1400;
        background: var(--surface);
        display: flex; flex-direction: column;
        overflow-y: auto; overflow-x: hidden;
        opacity: 0; transform: translateY(-100%);
        pointer-events: none;
        transition: opacity 0.28s cubic-bezier(0.22,1,0.36,1),
                    transform 0.32s cubic-bezier(0.22,1,0.36,1);
        will-change: transform, opacity;
      }
      .kfl-overlay-menu.is-open {
        opacity: 1; transform: translateY(0); pointer-events: auto;
      }

      .kfl-overlay-menu__bar {
        display: flex; align-items: center; justify-content: flex-end;
        height: var(--kfl-topbar-h); padding: 0 18px; flex-shrink: 0;
      }
      .kfl-overlay-menu__close {
        display: flex; align-items: center; justify-content: center;
        width: 36px; height: 36px; background: none; border: none;
        color: var(--text-1); cursor: pointer;
        -webkit-tap-highlight-color: transparent; touch-action: manipulation;
        transition: opacity 0.15s ease, transform 0.12s ease;
      }
      .kfl-overlay-menu__close:active { opacity: 0.5; transform: scale(0.85); }
      .kfl-overlay-menu__close .material-symbols-rounded {
        font-size: 24px;
        font-variation-settings: 'FILL' 0, 'wght' 300, 'GRAD' 0, 'opsz' 24;
      }

      .kfl-overlay-menu__body {
        flex: 1; padding: 8px 24px 48px; display: flex; flex-direction: column;
      }

      .kfl-overlay-link {
        display: flex; align-items: center; justify-content: space-between;
        padding: 13px 0; text-decoration: none; color: var(--text-1);
        font-family: var(--kfl-font);
        font-size: 28px; font-weight: 700; letter-spacing: -0.5px; line-height: 1.15;
        border-bottom: none;
        -webkit-tap-highlight-color: transparent; touch-action: manipulation;
        transition: opacity 0.14s ease, color 0.14s ease; cursor: pointer;
      }
      .kfl-overlay-link:last-child { border-bottom: none; }
      .kfl-overlay-link:active { opacity: 0.5; }
      .kfl-overlay-link.is-active { color: var(--accent); }
      .kfl-overlay-link--btn {
        width: 100%; background: none; border: none; text-align: left;
      }
      .kfl-overlay-link--danger { color: var(--pink) !important; }
      .kfl-overlay-link--danger:active { opacity: 0.5; }
      .kfl-overlay-link__label { flex: 1; }
      .kfl-overlay-link__right {
        display: flex; align-items: center; gap: 10px; flex-shrink: 0;
      }
      .kfl-overlay-link__chevron {
        display: flex; align-items: center; color: var(--text-3); flex-shrink: 0;
        transition: transform 0.22s cubic-bezier(0.4,0,0.2,1), color 0.15s ease;
      }
      .kfl-overlay-link__chevron svg { width: 16px; height: 16px; display: block; }
      .kfl-overlay-link--btn.is-open .kfl-overlay-link__chevron {
        transform: rotate(180deg); color: var(--accent);
      }
      .kfl-overlay-link__live {
        display: flex; align-items: center; gap: 4px;
        font-size: 10px; font-weight: 800; letter-spacing: 0.4px;
        text-transform: uppercase; color: var(--pink);
        background: var(--pink-dim); border: 1px solid rgba(255,51,82,0.22);
        border-radius: 100px; padding: 3px 9px 3px 7px; line-height: 1;
      }
      .kfl-overlay-link__live-dot {
        width: 5px; height: 5px; border-radius: 50%;
        background: var(--pink); flex-shrink: 0;
        animation: livepulse 1.8s ease-in-out infinite;
      }
      .kfl-overlay-link__check {
        display: flex; align-items: center;
      }
      .kfl-overlay-link__check .material-symbols-rounded {
        font-size: 18px; color: var(--accent);
        font-variation-settings: 'FILL' 1, 'wght' 600, 'GRAD' 0, 'opsz' 20;
      }

      .kfl-overlay-divider { height: 1px; background: var(--border); margin: 4px 0; }

      .kfl-settings-body {
        overflow: hidden; max-height: 0; opacity: 0;
        transition: max-height 0.3s cubic-bezier(0.4,0,0.2,1), opacity 0.2s ease;
      }
      .kfl-settings-body.is-open { max-height: 400px; opacity: 1; }

      .kfl-setting-row {
        display: flex; align-items: center; padding: 12px 0 12px 16px;
        border: none; background: transparent; width: 100%;
        text-align: left; cursor: pointer;
        font-family: var(--kfl-font); text-decoration: none; color: var(--text-2);
        -webkit-tap-highlight-color: transparent; touch-action: manipulation;
        transition: opacity 0.14s ease;
      }
      .kfl-setting-row:last-child { border-bottom: none; }
      .kfl-setting-row:active { opacity: 0.5; }
      .kfl-setting-row__label { flex: 1; font-size: 18px; font-weight: 600; }
      .kfl-setting-row__end { flex-shrink: 0; display: flex; align-items: center; gap: 8px; }

      .kfl-notif-status { font-size: 12px; font-weight: 600; color: var(--text-3); transition: color 0.2s ease; }

      .kfl-toggle { position: relative; width: 38px; height: 22px; flex-shrink: 0; cursor: pointer; }
      .kfl-toggle input { opacity: 0; width: 0; height: 0; position: absolute; }
      .kfl-toggle__track {
        position: absolute; inset: 0; border-radius: 100px;
        background: var(--surface-3); border: 1px solid var(--border-mid);
        transition: background 0.18s ease, border-color 0.18s ease;
      }
      .kfl-toggle__thumb {
        position: absolute; top: 3px; left: 3px; width: 16px; height: 16px;
        border-radius: 50%; background: var(--text-3); box-shadow: 0 1px 3px rgba(0,0,0,.3);
        transition: transform 0.2s cubic-bezier(0.34,1.56,0.64,1), background 0.18s ease;
      }
      .kfl-toggle input:checked ~ .kfl-toggle__track { background: var(--accent); border-color: var(--accent); }
      .kfl-toggle input:checked ~ .kfl-toggle__thumb { transform: translateX(16px); background: #fff; }

      .kfl-setting-badge {
        font-size: 11px; font-weight: 600; padding: 2px 8px;
        border-radius: 100px; background: var(--surface-2);
        border: 1px solid var(--border-mid); color: var(--text-3);
      }

      .kfl-overlay-footer {
        margin-top: auto; padding-top: 32px;
        display: flex; align-items: center; justify-content: center;
        flex-wrap: wrap; gap: 4px;
        font-size: 11px; font-weight: 500; color: var(--text-3);
      }
      .kfl-overlay-footer__dot { opacity: 0.4; }

      /* Staggered entrance */
      .kfl-overlay-menu.is-open .kfl-overlay-link { animation: kflLinkIn 0.3s cubic-bezier(0.22,1,0.36,1) both; }
      .kfl-overlay-menu.is-open .kfl-overlay-link:nth-child(1) { animation-delay: 0.03s; }
      .kfl-overlay-menu.is-open .kfl-overlay-link:nth-child(2) { animation-delay: 0.07s; }
      .kfl-overlay-menu.is-open .kfl-overlay-link:nth-child(3) { animation-delay: 0.11s; }
      .kfl-overlay-menu.is-open .kfl-overlay-link:nth-child(4) { animation-delay: 0.15s; }
      .kfl-overlay-menu.is-open .kfl-overlay-divider           { animation: kflLinkIn 0.3s cubic-bezier(0.22,1,0.36,1) 0.18s both; }
      .kfl-overlay-menu.is-open .kfl-overlay-link--btn:first-of-type { animation-delay: 0.21s; }
      .kfl-overlay-menu.is-open .kfl-overlay-link--danger      { animation-delay: 0.25s; }
      @keyframes kflLinkIn {
        from { opacity: 0; transform: translateY(12px); }
        to   { opacity: 1; transform: translateY(0); }
      }
      @keyframes livepulse {
        0%,100% { opacity: 1; transform: scale(1); }
        50%     { opacity: 0.3; transform: scale(0.55); }
      }
    `;
    document.head.appendChild(s);
  }

  /* ── BUILD TOPBAR ── */
  function buildTopbar() {
    const cfg     = getPageConfig();
    const notifOn = notifGranted();
    const t       = _theme;
    const themeEmoji = t === 'dark' ? '🌙' : '☀️';
    const themeTitle = t === 'dark' ? 'Dark mode'  : 'Light mode';
    const themeBadge = t === 'dark' ? 'Dark'        : 'Light';

    /* LEFT: logo on home, empty spacer otherwise */
    const leftSlot = cfg.showLogo
      ? `<a href="index.html" class="kfl-logo" aria-label="Kopala FPL — Home">
           <img src="/logo.png" alt="Kopala FPL" class="kfl-logo__img">
         </a>`
      : `<div style="width:4px"></div>`;

    /* CENTER: title (or empty on home since logo takes that role) */
    const titleSlot = cfg.showLogo
      ? `<div class="kfl-topbar__title-wrap"></div>`
      : `<div class="kfl-topbar__title-wrap">
           <span class="kfl-topbar__title">${cfg.title || ''}</span>
           ${cfg.live ? `<span class="kfl-topbar__live-badge"><span class="kfl-topbar__live-dot"></span>Live</span>` : ''}
         </div>`;

    /* RIGHT: contextual action buttons */
    const actionButtons = (cfg.actions || []).map(a => {
      const triggerAttr = a.menuTrigger
        ? `aria-expanded="false" aria-haspopup="true"`
        : '';
      const notifDot = a.icon === 'notifications'
        ? `<span class="kfl-action-btn__dot"></span>`
        : '';
      return `<button class="kfl-action-btn${a.menuTrigger ? ' kfl-menu-trigger' : ''}"
                      id="${a.id}" aria-label="${a.label}" ${triggerAttr} type="button">
                <span class="material-symbols-rounded">${a.icon}</span>
                ${notifDot}
              </button>`;
    }).join('');

    const topbarHTML = `
      <header class="kfl-topbar" role="banner">
        <div class="kfl-topbar__inner">
          <div class="kfl-topbar__left">${leftSlot}</div>
          ${titleSlot}
          <div class="kfl-topbar__actions" role="toolbar" aria-label="Page actions">
            ${actionButtons}
          </div>
        </div>
      </header>`;

    const overlayHTML = `
      <div class="kfl-overlay-menu" id="kfl-overlay-menu" role="dialog"
           aria-label="Navigation menu" aria-hidden="true" inert>

        <div class="kfl-overlay-menu__bar">
          <button class="kfl-overlay-menu__close" id="kfl-menu-close" aria-label="Close menu">
            <span class="material-symbols-rounded">close</span>
          </button>
        </div>

        <div class="kfl-overlay-menu__body">
          ${MENU_LINKS.map(l => `
            <a href="${l.href}"
               class="kfl-overlay-link${isActive(l.href) ? ' is-active' : ''}"
               ${isActive(l.href) ? 'aria-current="page"' : ''}>
              <span class="kfl-overlay-link__label">${l.label}</span>
              <div class="kfl-overlay-link__right">
                ${l.live ? `<span class="kfl-overlay-link__live"><span class="kfl-overlay-link__live-dot"></span>Live</span>` : ''}
                ${isActive(l.href) ? `<span class="kfl-overlay-link__check"><span class="material-symbols-rounded">check</span></span>` : ''}
              </div>
            </a>`).join('')}

          <div class="kfl-overlay-divider"></div>

          <button class="kfl-overlay-link kfl-overlay-link--btn"
                  id="kfl-settings-toggle" aria-expanded="false" type="button">
            <span class="kfl-overlay-link__label">Settings</span>
            <span class="kfl-overlay-link__chevron" aria-hidden="true">
              <svg viewBox="0 0 13 13" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="2 4.5 6.5 9 11 4.5"/>
              </svg>
            </span>
          </button>

          <div class="kfl-settings-body" id="kfl-settings-body">
            <div class="kfl-setting-row" id="notif-row" tabindex="0" role="button" aria-label="Toggle notifications">
              <span class="kfl-setting-row__label">Notifications</span>
              <div class="kfl-setting-row__end">
                <span class="kfl-notif-status" id="notif-status"></span>
                <label class="kfl-toggle" aria-hidden="true">
                  <input type="checkbox" id="notif-checkbox" ${notifOn ? 'checked' : ''} tabindex="-1">
                  <span class="kfl-toggle__track"></span>
                  <span class="kfl-toggle__thumb"></span>
                </label>
              </div>
            </div>

            <button class="kfl-setting-row" id="theme-toggle" type="button">
              <span class="kfl-setting-row__label" id="theme-title">${themeTitle}</span>
              <div class="kfl-setting-row__end">
                <span id="theme-emoji" style="font-size:16px;transition:opacity .12s,transform .12s;">${themeEmoji}</span>
                <span class="kfl-setting-badge" id="theme-badge">${themeBadge}</span>
              </div>
            </button>

            <a href="https://wa.me/260978263899" class="kfl-setting-row" target="_blank" rel="noopener noreferrer">
              <span class="kfl-setting-row__label">Contact &amp; Support</span>
              <div class="kfl-setting-row__end">
                <span class="material-symbols-rounded" style="font-size:14px;color:var(--text-3);font-variation-settings:'FILL' 0,'wght' 400,'GRAD' 0,'opsz' 20">open_in_new</span>
              </div>
            </a>
          </div>

          <button class="kfl-overlay-link kfl-overlay-link--btn kfl-overlay-link--danger" id="logout-btn" type="button">
            <span class="kfl-overlay-link__label">Log Out</span>
          </button>

          <div class="kfl-overlay-footer">
            <span>Kopala FPL</span><span class="kfl-overlay-footer__dot">·</span>
            <span>v1.1</span><span class="kfl-overlay-footer__dot">·</span>
            <span>Built for Zambians 🇿🇲</span>
          </div>
        </div>
      </div>`;

    return topbarHTML + overlayHTML;
  }

  /* ── BOTTOM NAV ── */
  function buildBottomNav() {
    const items = NAV_LINKS.map(l => `
      <a href="${l.href}"
         class="kfl-tab${isActive(l.href) ? ' is-active' : ''}${l.live ? ' kfl-tab--live' : ''}"
         ${isActive(l.href) ? 'aria-current="page"' : ''}
         aria-label="${l.label}">
        <div class="kfl-tab__pill">
          <span class="material-symbols-rounded kfl-tab__icon" aria-hidden="true">${l.icon}</span>
        </div>
        <span class="kfl-tab__label">${l.label}</span>
      </a>`).join('');
    return `<nav class="kfl-bottom-nav" aria-label="Bottom navigation"><div class="kfl-bottom-nav__inner">${items}</div></nav>`;
  }

  function buildOverlay() {
    return `<div class="kfl-overlay" id="kfl-overlay" aria-hidden="true"></div>`;
  }

  /* ── THEME ── */
  function setupTheme() {
    const root = document.documentElement;
    const btn  = document.getElementById('theme-toggle');
    if (!btn) return;
    function applyThemeUI(t) {
      const map = {
        dark:  { emoji: '🌙', title: 'Dark mode',  badge: 'Dark'  },
        light: { emoji: '☀️', title: 'Light mode', badge: 'Light' },
      };
      const m = map[t];
      const el = id => document.getElementById(id);
      if (el('theme-title')) el('theme-title').textContent = m.title;
      if (el('theme-badge')) el('theme-badge').textContent = m.badge;
      const emoji = el('theme-emoji');
      if (emoji) {
        emoji.style.opacity = '0'; emoji.style.transform = 'scale(0.3) rotate(-20deg)';
        setTimeout(() => { emoji.textContent = m.emoji; emoji.style.opacity = '1'; emoji.style.transform = 'scale(1) rotate(0)'; }, 120);
      }
    }
    btn.addEventListener('click', () => {
      const next = root.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      localStorage.setItem('kopala_theme', next);
      applyThemeUI(next);
    });
  }

  /* ── NOTIFICATIONS ── */
  function setupNotifications() {
    const row = document.getElementById('notif-row');
    const checkbox = document.getElementById('notif-checkbox');
    const status   = document.getElementById('notif-status');
    if (!row) return;
    function updateUI() {
      if (!('Notification' in window)) { if (checkbox) checkbox.checked = false; if (status) status.textContent = 'Not supported'; return; }
      const perm = Notification.permission;
      if (perm === 'granted') { if (checkbox) checkbox.checked = true; if (status) { status.textContent = 'On'; status.style.color = 'var(--accent)'; } }
      else if (perm === 'denied') { if (checkbox) checkbox.checked = false; if (status) { status.textContent = 'Blocked'; status.style.color = 'var(--pink)'; } }
      else { if (checkbox) checkbox.checked = false; if (status) { status.textContent = 'Off'; status.style.color = 'var(--text-3)'; } }
    }
    async function handleTap() {
      if (!('Notification' in window)) return;
      if (Notification.permission === 'denied') { if (status) { status.textContent = 'Unblock in browser settings'; status.style.color = 'var(--pink)'; } setTimeout(updateUI, 3000); return; }
      if (Notification.permission === 'granted') { if (window.KopalaNotify?.unsubscribe) await window.KopalaNotify.unsubscribe(); if (checkbox) checkbox.checked = false; if (status) { status.textContent = 'Off'; status.style.color = 'var(--text-3)'; } localStorage.setItem('kopala_notif_pref', 'off'); return; }
      const perm = await Notification.requestPermission();
      if (perm === 'granted') { localStorage.setItem('kopala_notif_pref', 'on'); if (window.KopalaNotify?.prompt) window.KopalaNotify.prompt(); }
      updateUI();
    }
    row.addEventListener('click', handleTap);
    row.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleTap(); } });
    window._kflSyncNotifUI = updateUI;
    updateUI();
  }

  /* ── SETTINGS ACCORDION ── */
  function setupSettingsAccordion() {
    const toggle = document.getElementById('kfl-settings-toggle');
    const body   = document.getElementById('kfl-settings-body');
    if (!toggle || !body) return;
    toggle.addEventListener('click', () => {
      const open = toggle.classList.toggle('is-open');
      body.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', String(open));
    });
  }

  /* ── MENU ── */
  function setupMenu() {
    const menu    = document.getElementById('kfl-overlay-menu');
    const overlay = document.getElementById('kfl-overlay');
    if (!menu) return;
    let isOpen = false;
    function open() {
      isOpen = true; window._kflSyncNotifUI?.();
      menu.classList.add('is-open'); overlay?.classList.add('is-open');
      menu.removeAttribute('inert'); menu.removeAttribute('aria-hidden');
      document.querySelectorAll('.kfl-menu-trigger').forEach(b => { b.setAttribute('aria-expanded', 'true'); b.classList.add('is-active'); });
      document.body.style.overflow = 'hidden';
    }
    function close() {
      isOpen = false;
      menu.classList.remove('is-open'); overlay?.classList.remove('is-open');
      menu.setAttribute('inert', ''); menu.setAttribute('aria-hidden', 'true');
      document.querySelectorAll('.kfl-menu-trigger').forEach(b => { b.setAttribute('aria-expanded', 'false'); b.classList.remove('is-active'); });
      document.body.style.overflow = '';
    }
    document.querySelectorAll('.kfl-menu-trigger').forEach(btn => {
      btn.addEventListener('click', e => { e.stopPropagation(); isOpen ? close() : open(); });
    });
    document.getElementById('kfl-menu-close')?.addEventListener('click', close);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && isOpen) close(); });
    document.getElementById('logout-btn')?.addEventListener('click', () => { close(); logout(); });
  }

  /* ── AUTH ── */
  const TEAM_ID_KEY = 'kopala_id';
  function isLoggedIn() { const id = localStorage.getItem(TEAM_ID_KEY); return id && id.trim() !== ''; }
  function logout() { localStorage.removeItem(TEAM_ID_KEY); showLoginScreen(); }
  function showLoginScreen() {
    const ls = document.getElementById('login-screen');
    if (!ls) return;
    ls.style.display = 'flex';
    const inp = document.getElementById('fpl-id-inp');
    const err = document.getElementById('err-msg');
    if (inp) inp.classList.remove('error');
    if (err) { err.style.display = 'none'; err.textContent = ''; }
    setTimeout(() => inp?.focus(), 100);
  }

  /* ── ACTIVE SYNC ── */
  function syncActiveState() {
    const page = currentPage();
    document.querySelectorAll('.kfl-tab').forEach(el => {
      const a = el.getAttribute('href') === page;
      el.classList.toggle('is-active', a);
      a ? el.setAttribute('aria-current', 'page') : el.removeAttribute('aria-current');
    });
    document.querySelectorAll('.kfl-overlay-link').forEach(el => {
      const a = el.getAttribute('href') === page;
      el.classList.toggle('is-active', a);
      a ? el.setAttribute('aria-current', 'page') : el.removeAttribute('aria-current');
    });
  }
  function setupTurboSync() { document.addEventListener('kopala:page-changed', syncActiveState); }

  /* ── AUTH GATE ── */
  function setupAuthGate() {
    if (!isLoggedIn()) showLoginScreen();
    document.querySelectorAll('.kfl-tab, .kfl-overlay-link').forEach(el => {
      el.addEventListener('click', e => {
        if (!isLoggedIn()) { e.preventDefault(); e.stopImmediatePropagation(); if (navigator.vibrate) navigator.vibrate([10, 30, 10]); showLoginScreen(); }
      }, true);
    });
    document.addEventListener('click', e => {
      if (isLoggedIn()) return;
      const link = e.target.closest('a[href]');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href || href.startsWith('http') || href.startsWith('//') || href.startsWith('#') || href.startsWith('mailto:') || link.target === '_blank') return;
      e.preventDefault(); e.stopImmediatePropagation(); showLoginScreen();
    }, true);
  }

  /* ── BOTTOM NAV HAPTIC ── */
  function setupBottomNav() {
    document.querySelectorAll('.kfl-tab').forEach(item => {
      item.addEventListener('click', () => { if (navigator.vibrate) navigator.vibrate([6, 0, 12]); });
    });
  }

  /* ── SCROLL ── */
  function setupScroll() {
    const topbar = document.querySelector('.kfl-topbar');
    if (!topbar) return;
    let ticking = false;
    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => { topbar.classList.toggle('is-scrolled', window.scrollY > 40); ticking = false; });
        ticking = true;
      }
    }, { passive: true });
  }

  /* ── INIT ── */
  function loadNav() {
    injectStyles();
    injectThemeColorMeta();
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
    setupTheme(); setupNotifications(); setupSettingsAccordion();
    setupMenu(); setupBottomNav(); setupScroll(); setupAuthGate(); setupTurboSync();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadNav);
  } else {
    loadNav();
  }

})();
