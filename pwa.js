/* ============================================================
   KOPALA FPL — PWA.JS
   Service Worker registration + native-feel enhancements
   No progress bars. No splash. Instant. Native.
   ============================================================ */

(function () {
  'use strict';

  /* ── 1. REGISTER SERVICE WORKER ──────────────────────── */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(reg => {
          reg.addEventListener('updatefound', () => {
            const worker = reg.installing;
            worker?.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                showUpdateNudge();
              }
            });
          });
        })
        .catch(err => console.warn('[SW] Registration failed:', err));

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    });
  }

  /* ── 2. INSTALL PROMPT (Add to Home Screen) ─────────── */
  let _deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _deferredPrompt = e;
    setTimeout(() => {
      if (!isInstalled()) showInstallToast();
    }, 4000);
  });

  window.addEventListener('appinstalled', () => {
    _deferredPrompt = null;
    hideInstallToast();
  });

  function isInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://');
  }

  /* ── 3. INSTALL TOAST ───────────────────────────────── */
  function showInstallToast() {
    if (document.getElementById('kfl-install-toast')) return;
    if (isInstalled()) return;

    const toast = document.createElement('div');
    toast.id = 'kfl-install-toast';
    toast.innerHTML = `
      <div class="kfl-install-toast__icon">
        <i class="fa-solid fa-futbol"></i>
      </div>
      <div class="kfl-install-toast__text">
        <strong>Add to Home Screen</strong>
        <span>Get the full app experience</span>
      </div>
      <button class="kfl-install-toast__btn" id="kfl-install-btn">Install</button>
      <button class="kfl-install-toast__close" id="kfl-install-close" aria-label="Dismiss">
        <i class="fa-solid fa-xmark"></i>
      </button>
    `;
    document.body.appendChild(toast);

    requestAnimationFrame(() => toast.classList.add('kfl-install-toast--visible'));

    document.getElementById('kfl-install-btn')?.addEventListener('click', async () => {
      if (!_deferredPrompt) return;
      _deferredPrompt.prompt();
      const { outcome } = await _deferredPrompt.userChoice;
      _deferredPrompt = null;
      if (outcome === 'accepted') hideInstallToast();
    });

    document.getElementById('kfl-install-close')?.addEventListener('click', () => {
      hideInstallToast();
      localStorage.setItem('kfl_install_dismissed', Date.now().toString());
    });
  }

  function hideInstallToast() {
    const toast = document.getElementById('kfl-install-toast');
    if (!toast) return;
    toast.classList.remove('kfl-install-toast--visible');
    setTimeout(() => toast.remove(), 350);
  }

  /* ── 4. UPDATE NUDGE ────────────────────────────────── */
  function showUpdateNudge() {
    if (document.getElementById('kfl-update-nudge')) return;
    const bar = document.createElement('div');
    bar.id = 'kfl-update-nudge';
    bar.innerHTML = `
      <span><i class="fa-solid fa-rotate" style="margin-right:6px"></i>Update available</span>
      <button id="kfl-update-btn">Reload</button>
    `;
    document.body.prepend(bar);
    document.getElementById('kfl-update-btn')?.addEventListener('click', () => window.location.reload());
  }

  /* ── 5. NATIVE-FEEL: Instant tap response ───────────── */
  document.addEventListener('touchstart', function () {}, { passive: true });

  const tapStyle = document.createElement('style');
  tapStyle.textContent = `
    a, button, [role="button"], .kfl-subnav__link, .kfl-drawer__link {
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
  `;
  document.head.appendChild(tapStyle);

  /* ── 6. NATIVE-FEEL: Overscroll & pull-to-refresh ───── */
  document.body.style.overscrollBehaviorY = 'contain';
  document.documentElement.style.webkitOverflowScrolling = 'touch';

  /* ── 7. SHIMMER SKELETON ────────────────────────────── */
  // Shown instantly on tap — before any network response arrives.
  // Detects which page is being loaded and renders a matching skeleton
  // so the layout shift is minimal when real content swaps in.

  function _getShimmerHTML(href) {
    const page = href.replace(/^\//, '').replace('.html', '');

    // Shared shimmer card block
    const card = (lines = 3) => `
      <div class="kfl-shimmer-card">
        <div class="kfl-shimmer kfl-shimmer--avatar"></div>
        <div class="kfl-shimmer-card__lines">
          ${Array.from({ length: lines }, (_, i) =>
            `<div class="kfl-shimmer kfl-shimmer--line" style="width:${i === 0 ? '60%' : i === lines - 1 ? '40%' : '85%'}"></div>`
          ).join('')}
        </div>
      </div>`;

    const row = (wide = false) => `
      <div class="kfl-shimmer-row">
        <div class="kfl-shimmer kfl-shimmer--circle"></div>
        <div class="kfl-shimmer-row__lines">
          <div class="kfl-shimmer kfl-shimmer--line" style="width:${wide ? '70%' : '55%'}"></div>
          <div class="kfl-shimmer kfl-shimmer--line" style="width:${wide ? '45%' : '35%'}"></div>
        </div>
        <div class="kfl-shimmer kfl-shimmer--chip"></div>
      </div>`;

    const skeletons = {
      leagues: `
        <div class="kfl-shimmer-header">
          <div class="kfl-shimmer kfl-shimmer--line" style="width:45%;height:1.4rem"></div>
          <div class="kfl-shimmer kfl-shimmer--chip"></div>
        </div>
        ${Array.from({ length: 6 }, () => row(true)).join('')}`,

      prices: `
        <div class="kfl-shimmer-header">
          <div class="kfl-shimmer kfl-shimmer--line" style="width:38%;height:1.4rem"></div>
          <div class="kfl-shimmer kfl-shimmer--chip"></div>
        </div>
        <div class="kfl-shimmer-tabs">
          ${Array.from({ length: 4 }, () =>
            `<div class="kfl-shimmer kfl-shimmer--tab"></div>`).join('')}
        </div>
        ${Array.from({ length: 7 }, () => row()).join('')}`,

      games: `
        <div class="kfl-shimmer-header">
          <div class="kfl-shimmer kfl-shimmer--line" style="width:42%;height:1.4rem"></div>
        </div>
        ${Array.from({ length: 4 }, () => card(2)).join('')}`,

      index: `
        ${Array.from({ length: 3 }, () => card(3)).join('')}`,
    };

    return `
      <div id="kfl-shimmer-overlay" class="kfl-shimmer-overlay" aria-hidden="true">
        <div class="kfl-shimmer-body">
          ${skeletons[page] || skeletons.index}
        </div>
      </div>`;
  }

  function showShimmer(href) {
    // Remove any existing shimmer first
    document.getElementById('kfl-shimmer-overlay')?.remove();
    const wrap = document.createElement('div');
    wrap.innerHTML = _getShimmerHTML(href);
    const el = wrap.firstElementChild;
    document.body.appendChild(el);
    // Animate in next frame
    requestAnimationFrame(() => el.classList.add('kfl-shimmer-overlay--visible'));
  }

  function hideShimmer() {
    const el = document.getElementById('kfl-shimmer-overlay');
    if (!el) return;
    el.classList.add('kfl-shimmer-overlay--out');
    setTimeout(() => el.remove(), 200);
  }

  /* ── 8. SPA NAVIGATION ──────────────────────────────── */
  // Strategy: INSTANT-FROM-CACHE + background revalidate.
  //
  // • If the page is already in _pageCache (warmed on login or previously
  //   visited) → render it immediately (zero wait) then silently fetch a
  //   fresh copy in the background and update the cache for next time.
  //   No shimmer needed — the user sees content in <16ms.
  //
  // • If the page is NOT in cache yet → show a shimmer skeleton instantly
  //   (immediate visual feedback), fetch the HTML, then swap in real content.
  //   No more "dim + wait" — the shimmer makes it feel native.
  //
  // Either way, users always get fresh HTML on every navigation cycle.

  const _pageCache = new Map();
  let   _navigating = false;

  // Swap real HTML into the document after a fetch
  async function _applyHTML(html, href) {
    const parser = new DOMParser();
    const newDoc = parser.parseFromString(html, 'text/html');

    document.title = newDoc.title;

    const newThemeMeta = newDoc.querySelector('meta[name="theme-color"]');
    if (newThemeMeta) {
      let existing = document.querySelector('meta[name="theme-color"]');
      if (!existing) {
        existing = document.createElement('meta');
        existing.name = 'theme-color';
        document.head.appendChild(existing);
      }
      existing.content = newThemeMeta.content;
    }

    document.body.innerHTML = newDoc.body.innerHTML;

    Array.from(newDoc.body.attributes).forEach(attr => {
      document.body.setAttribute(attr.name, attr.value);
    });

    // Re-execute scripts — DOMParser doesn't run them
    const scripts = Array.from(document.body.querySelectorAll('script'));
    for (const oldScript of scripts) {
      const newScript = document.createElement('script');
      Array.from(oldScript.attributes).forEach(attr => {
        newScript.setAttribute(attr.name, attr.value);
      });
      if (!oldScript.src) newScript.textContent = oldScript.textContent;
      oldScript.parentNode.replaceChild(newScript, oldScript);
      if (newScript.src) {
        await new Promise(resolve => {
          newScript.onload  = resolve;
          newScript.onerror = resolve;
        });
      }
    }

    window.scrollTo(0, 0);
    document.body.style.opacity    = '1';
    document.body.style.transition = 'opacity 0.15s ease';
    window.dispatchEvent(new CustomEvent('kfl:navigate', { detail: { href } }));
  }

  // Silently fetch fresh HTML and update cache — no UI changes
  function _revalidate(href) {
    fetch(href, { cache: 'no-store' })
      .then(r => r.ok ? r.text() : null)
      .then(h => { if (h) _pageCache.set(href, h); })
      .catch(() => {});
  }

  async function kflNavigate(href) {
    if (_navigating) return;
    _navigating = true;

    const cached = _pageCache.get(href);

    if (cached) {
      // ── INSTANT PATH: render cached HTML immediately ──────
      // No shimmer, no opacity fade — content appears in one frame.
      // Kick off a background revalidation so cache stays fresh.
      history.pushState({ href }, '', href);
      try {
        await _applyHTML(cached, href);
        _revalidate(href); // update cache silently in background
      } catch (err) {
        console.warn('[KFL] Apply failed:', err);
        window.location.href = href;
      } finally {
        _navigating = false;
      }
    } else {
      // ── SHIMMER PATH: nothing cached yet — show skeleton, fetch, swap ──
      showShimmer(href);
      history.pushState({ href }, '', href);
      try {
        const res = await fetch(href, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        const html = await res.text();
        _pageCache.set(href, html);
        hideShimmer();
        await _applyHTML(html, href);
      } catch (err) {
        hideShimmer();
        console.warn('[KFL] Navigate failed, falling back:', err);
        window.location.href = href;
      } finally {
        _navigating = false;
      }
    }
  }

  // Intercept all local link clicks
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href]');
    if (!link) return;
    const href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('#') ||
        href.startsWith('mailto') || href.startsWith('tel')) return;
    if (link.target === '_blank') return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    kflNavigate(href);
  }, true);

  // Browser back/forward
  window.addEventListener('popstate', e => {
    if (e.state?.href) kflNavigate(e.state.href);
  });

  /* ── 9. PREFETCH on hover/touchstart ────────────────── */
  const _deadLinks = new Set();

  function _prefetch(href) {
    if (!href || _pageCache.has(href) || _deadLinks.has(href)) return;
    if (href.startsWith('http') || href.startsWith('#') ||
        href.startsWith('mailto') || href.startsWith('tel')) return;

    _deadLinks.add(href); // in-flight guard

    fetch(href, { cache: 'no-store' })
      .then(r => {
        if (!r.ok) return;
        _deadLinks.delete(href);
        return r.text().then(h => _pageCache.set(href, h));
      })
      .catch(() => {});
  }

  document.addEventListener('mouseover', e => {
    const a = e.target.closest('a[href]');
    if (a) _prefetch(a.getAttribute('href'));
  });
  document.addEventListener('touchstart', e => {
    const a = e.target.closest('a[href]');
    if (a) _prefetch(a.getAttribute('href'));
  }, { passive: true });

  /* ── 10. STATUS BAR COLOR SYNC ──────────────────────── */
  function syncStatusBar() {
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    const color = theme === 'dark' ? '#0d1520' : '#ffffff';
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = color;
  }

  document.addEventListener('DOMContentLoaded', syncStatusBar);
  const themeObserver = new MutationObserver(syncStatusBar);
  themeObserver.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ── 11. FADE IN ON COLD LOAD ───────────────────────── */
  window.addEventListener('pageshow', () => {
    document.body.style.opacity    = '1';
    document.body.style.transition = 'opacity 0.15s ease';
  });

  /* ── 12. BACK GESTURE SUPPORT ───────────────────────── */
  if (isInstalled()) {
    if (window.history.length <= 1) {
      history.replaceState({ href: window.location.pathname }, '', window.location.href);
    }
  }

  /* ── 13. WARM CACHE ON LOGIN ────────────────────────── */
  // Fetch the four core pages in the background at idle time so
  // first navigation to any of them is instant (cache hit → no shimmer).
  const WARM_PAGES = [
    '/index.html',
    '/leagues.html',
    '/games.html',
    '/prices.html',
  ];

  function _warmCache() {
    WARM_PAGES.forEach(href => {
      if (_pageCache.has(href) || _deadLinks.has(href)) return;
      _deadLinks.add(href);
      fetch(href, { cache: 'no-store' })
        .then(r => {
          if (!r.ok) return;
          _deadLinks.delete(href);
          return r.text().then(h => {
            _pageCache.set(href, h);
            console.info('[KFL] Warmed:', href);
          });
        })
        .catch(() => {});
    });
  }

  if ('requestIdleCallback' in window) {
    requestIdleCallback(_warmCache, { timeout: 3000 });
  } else {
    setTimeout(_warmCache, 1500);
  }

  /* ── 14. STYLES ─────────────────────────────────────── */
  const pwaStyles = document.createElement('style');
  pwaStyles.textContent = `

    /* ── Shimmer skeleton ── */
    @keyframes kfl-shimmer-sweep {
      0%   { background-position: -400px 0; }
      100% { background-position:  400px 0; }
    }

    .kfl-shimmer-overlay {
      position: fixed;
      inset: 0;
      z-index: 8000;
      background: var(--kfl-bg, #0a1120);
      overflow-y: auto;
      opacity: 0;
      transition: opacity 0.12s ease;
      pointer-events: none;
    }
    .kfl-shimmer-overlay--visible {
      opacity: 1;
      pointer-events: auto;
    }
    .kfl-shimmer-overlay--out {
      opacity: 0;
      transition: opacity 0.18s ease;
    }

    .kfl-shimmer-body {
      padding: 72px 16px 120px;
      max-width: 600px;
      margin: 0 auto;
    }

    .kfl-shimmer {
      background: linear-gradient(
        90deg,
        var(--kfl-shimmer-base, rgba(255,255,255,0.04)) 25%,
        var(--kfl-shimmer-shine, rgba(255,255,255,0.10)) 50%,
        var(--kfl-shimmer-base, rgba(255,255,255,0.04)) 75%
      );
      background-size: 800px 100%;
      animation: kfl-shimmer-sweep 1.4s ease-in-out infinite;
      border-radius: 6px;
    }

    .kfl-shimmer--line  { height: 0.75rem; margin-bottom: 8px; border-radius: 4px; }
    .kfl-shimmer--avatar { width: 44px; height: 44px; border-radius: 10px; flex-shrink: 0; }
    .kfl-shimmer--circle { width: 36px; height: 36px; border-radius: 50%; flex-shrink: 0; }
    .kfl-shimmer--chip  { width: 52px; height: 24px; border-radius: 20px; flex-shrink: 0; }
    .kfl-shimmer--tab   { height: 32px; border-radius: 8px; flex: 1; }

    .kfl-shimmer-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 20px;
      gap: 12px;
    }

    .kfl-shimmer-tabs {
      display: flex;
      gap: 8px;
      margin-bottom: 20px;
    }

    .kfl-shimmer-card {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 14px 0;
      border-bottom: 1px solid var(--kfl-border, rgba(255,255,255,0.06));
    }
    .kfl-shimmer-card__lines {
      flex: 1;
      padding-top: 4px;
    }

    .kfl-shimmer-row {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 11px 0;
      border-bottom: 1px solid var(--kfl-border, rgba(255,255,255,0.06));
    }
    .kfl-shimmer-row__lines {
      flex: 1;
    }
    .kfl-shimmer-row__lines .kfl-shimmer--line:last-child {
      margin-bottom: 0;
    }

    /* ── Install Toast ── */
    #kfl-install-toast {
      position: fixed;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 80px);
      left: 12px; right: 12px;
      background: var(--kfl-surface, #141e2d);
      border: 1px solid var(--kfl-border, rgba(255,255,255,0.1));
      border-radius: 16px;
      padding: 14px 14px 14px 16px;
      display: flex;
      align-items: center;
      gap: 12px;
      z-index: 9999;
      box-shadow: 0 8px 40px rgba(0,0,0,0.5);
      transform: translateY(120%);
      opacity: 0;
      transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease;
      max-width: 480px;
      margin: 0 auto;
    }
    #kfl-install-toast.kfl-install-toast--visible {
      transform: translateY(0);
      opacity: 1;
    }
    .kfl-install-toast__icon {
      width: 40px; height: 40px;
      border-radius: 10px;
      background: var(--kfl-green-dim, rgba(0,200,90,0.12));
      color: var(--kfl-green, #00c85a);
      display: flex; align-items: center; justify-content: center;
      font-size: 1rem;
      flex-shrink: 0;
    }
    .kfl-install-toast__text { flex: 1; min-width: 0; }
    .kfl-install-toast__text strong {
      display: block;
      font-size: 0.88rem;
      font-weight: 700;
      color: var(--kfl-text-1, #eef2ff);
      margin-bottom: 2px;
    }
    .kfl-install-toast__text span {
      font-size: 0.72rem;
      color: var(--kfl-text-3, #4a5f7a);
    }
    .kfl-install-toast__btn {
      background: var(--kfl-green, #00c85a);
      color: var(--kfl-pill-fg, #fff);
      border: none; border-radius: 8px;
      padding: 8px 14px;
      font-size: 0.8rem; font-weight: 700;
      cursor: pointer; flex-shrink: 0;
      font-family: inherit;
      transition: opacity 0.15s;
    }
    .kfl-install-toast__btn:hover { opacity: 0.85; }
    .kfl-install-toast__close {
      background: none; border: none;
      color: var(--kfl-text-3, #4a5f7a);
      cursor: pointer; padding: 4px;
      font-size: 0.9rem; flex-shrink: 0;
      transition: color 0.15s;
    }
    .kfl-install-toast__close:hover { color: var(--kfl-text-1, #eef2ff); }

    /* ── Update Nudge ── */
    #kfl-update-nudge {
      position: fixed;
      top: 0; left: 0; right: 0;
      z-index: 9998;
      background: var(--kfl-green, #00c85a);
      color: var(--kfl-pill-fg, #021409);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 16px;
      font-size: 0.8rem; font-weight: 600;
    }
    #kfl-update-btn {
      background: rgba(0,0,0,0.15);
      border: 1px solid rgba(0,0,0,0.2);
      color: inherit; border-radius: 6px;
      padding: 4px 12px;
      font-size: 0.78rem; font-weight: 700;
      cursor: pointer; font-family: inherit;
    }

    /* ── Safe area ── */
    .kfl-subnav { padding-bottom: env(safe-area-inset-bottom, 0px); }
    .toast      { bottom: calc(80px + env(safe-area-inset-bottom, 0px)) !important; }
  `;
  document.head.appendChild(pwaStyles);

})();
