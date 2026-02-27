/**
 * KOPALA FPL — BOTTOM NAV
 * Emotional, premium, playful mobile navigation.
 * Drop this <script src="nav-bottom.js"></script> AFTER nav.js in your HTML.
 */
(function () {
  'use strict';

  /* ── SAME links as the drawer ─────────────────────────── */
  const BOTTOM_NAV_LINKS = [
    { href: 'index.html',   label: 'Home',    icon: 'fa-house'      },
    { href: 'leagues.html', label: 'Leagues', icon: 'fa-trophy'     },
    { href: 'prices.html',  label: 'Prices',  icon: 'fa-dollar-sign'},
    { href: 'games.html',   label: 'Games',   icon: 'fa-futbol'     },
  ];

  function currentPage() {
    return window.location.pathname.split('/').pop() || 'index.html';
  }

  function buildBottomNav() {
    const activeIndex = BOTTOM_NAV_LINKS.findIndex(l => l.href === currentPage());

    const items = BOTTOM_NAV_LINKS.map((l, i) => {
      const active = i === activeIndex;
      return `
        <a href="${l.href}"
           class="kfl-bnav__item${active ? ' is-active' : ''}"
           data-index="${i}"
           ${active ? 'aria-current="page"' : ''}
           aria-label="${l.label}">
          <span class="kfl-bnav__blob" aria-hidden="true"></span>
          <span class="kfl-bnav__icon-wrap" aria-hidden="true">
            <i class="fa-solid ${l.icon}"></i>
          </span>
          <span class="kfl-bnav__label">${l.label}</span>
        </a>`;
    }).join('');

    /* Sliding pill indicator — absolutely positioned */
    const indicatorHtml = `<span class="kfl-bnav__indicator" id="kfl-bnav-indicator" aria-hidden="true"></span>`;

    const nav = document.createElement('nav');
    nav.className = 'kfl-bnav';
    nav.id        = 'kfl-bnav';
    nav.setAttribute('aria-label', 'Mobile bottom navigation');
    nav.innerHTML = indicatorHtml + items;
    document.body.appendChild(nav);

    /* Position the indicator on load */
    requestAnimationFrame(() => positionIndicator(activeIndex, false));
  }

  function positionIndicator(index, animate = true) {
    const nav       = document.getElementById('kfl-bnav');
    const indicator = document.getElementById('kfl-bnav-indicator');
    if (!nav || !indicator) return;

    const items = nav.querySelectorAll('.kfl-bnav__item');
    if (!items[index]) return;

    const item    = items[index];
    const navRect = nav.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();

    const left  = itemRect.left - navRect.left + itemRect.width / 2;

    indicator.style.transition = animate
      ? 'left 0.45s cubic-bezier(0.34,1.56,0.64,1), opacity 0.2s'
      : 'none';
    indicator.style.left    = left + 'px';
    indicator.style.opacity = '1';
  }

  function setupInteractions() {
    const nav   = document.getElementById('kfl-bnav');
    if (!nav) return;

    nav.querySelectorAll('.kfl-bnav__item').forEach((item, i) => {
      /* Tap: slide indicator + springy icon */
      item.addEventListener('click', function (e) {
        const alreadyActive = this.classList.contains('is-active');

        /* Slide indicator */
        positionIndicator(i, true);

        /* Spring pop on icon */
        const wrap = this.querySelector('.kfl-bnav__icon-wrap');
        if (wrap) {
          wrap.style.transform = 'scale(0.72) translateY(4px)';
          wrap.style.transition = 'transform 0.08s ease';
          setTimeout(() => {
            wrap.style.transition = 'transform 0.45s cubic-bezier(0.34,1.56,0.64,1)';
            wrap.style.transform  = alreadyActive ? 'scale(1.25) translateY(-4px)' : 'scale(1.15) translateY(-3px)';
          }, 80);
          setTimeout(() => {
            wrap.style.transform = '';
          }, 500);
        }

        /* Blob burst */
        const blob = this.querySelector('.kfl-bnav__blob');
        if (blob) {
          blob.classList.remove('burst');
          void blob.offsetWidth; /* reflow to restart */
          blob.classList.add('burst');
        }
      });

      /* Long-press: wobble Easter egg */
      let pressTimer;
      item.addEventListener('pointerdown', () => {
        pressTimer = setTimeout(() => {
          const wrap = item.querySelector('.kfl-bnav__icon-wrap');
          if (wrap) {
            wrap.style.animation = 'kfl-bnav-wobble 0.5s ease';
            setTimeout(() => { wrap.style.animation = ''; }, 500);
          }
        }, 500);
      });
      item.addEventListener('pointerup',    () => clearTimeout(pressTimer));
      item.addEventListener('pointerleave', () => clearTimeout(pressTimer));
    });
  }

  function init() {
    buildBottomNav();
    setupInteractions();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
