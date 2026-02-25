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
          // Check for updates silently in background
          reg.addEventListener('updatefound', () => {
            const worker = reg.installing;
            worker?.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                // New version available — show a subtle in-app nudge (not a progress bar)
                showUpdateNudge();
              }
            });
          });
        })
        .catch(err => console.warn('[SW] Registration failed:', err));

      // When a new SW takes over, reload for fresh assets
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

    // Show our own install button after a short delay if not already installed
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

  /* ── 3. INSTALL TOAST (bottom-of-screen, dismissible) ── */
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

    // Animate in
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
      // Don't show again for 7 days
      localStorage.setItem('kfl_install_dismissed', Date.now().toString());
    });
  }

  function hideInstallToast() {
    const toast = document.getElementById('kfl-install-toast');
    if (!toast) return;
    toast.classList.remove('kfl-install-toast--visible');
    setTimeout(() => toast.remove(), 350);
  }

  /* ── 4. UPDATE NUDGE (subtle top banner) ─────────────── */
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
  // Removes the 300ms click delay on all touch devices without FastClick overhead
  document.addEventListener('touchstart', function () {}, { passive: true });

  // Remove highlight flash on tap for nav elements
  const tapStyle = document.createElement('style');
  tapStyle.textContent = `
    a, button, [role="button"], .kfl-subnav__link, .kfl-drawer__link {
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
  `;
  document.head.appendChild(tapStyle);

  /* ── 6. NATIVE-FEEL: Overscroll & pull-to-refresh ───── */
  // Prevent the browser's pull-to-refresh from triggering while scrolling content
  document.body.style.overscrollBehaviorY = 'contain';

  // Allow momentum scrolling on iOS
  document.documentElement.style.webkitOverflowScrolling = 'touch';

  /* ── 7. NATIVE-FEEL: SPA navigation — kills the progress bar ── */
  // Strategy: fetch the new page HTML, then use document.open/write to
  // replace the entire document. This runs ALL scripts exactly as a real
  // page load would — DOMContentLoaded fires, <head> scripts load, data
  // fetches run — but the browser never navigates so no progress bar appears.

  const _pageCache = new Map();
  let   _navigating = false;

  async function kflNavigate(href) {
    if (_navigating) return;
    _navigating = true;

    // Subtle dim to signal something is happening
    const main = document.querySelector('.page-content') || document.body;
    main.style.transition = 'opacity 0.1s ease';
    main.style.opacity    = '0.55';

    try {
      let html = _pageCache.get(href);
      if (!html) {
        const res = await fetch(href);
        if (!res.ok) throw new Error('HTTP ' + res.status);
        html = await res.text();
        _pageCache.set(href, html);
      }

      // Push URL BEFORE the document replace so history is correct
      history.pushState({ href }, '', href);

      // document.open/write completely replaces the document — every script
      // in <head> and <body> runs fresh, DOMContentLoaded fires, exactly
      // like a real page load. No manual script re-execution needed.
      document.open();
      document.write(html);
      document.close();

    } catch (err) {
      console.warn('[KFL] Navigate failed, falling back:', err);
      window.location.href = href;
    } finally {
      _navigating = false;
    }
  }

  // Intercept all local link clicks (capture phase catches nav.js links too)
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

  // Browser back/forward — no page load
  window.addEventListener('popstate', e => {
    const href = e.state?.href || window.location.pathname + window.location.search;
    // Only intercept if it's a state we pushed (avoid double-firing on first load)
    if (e.state?.href) kflNavigate(href);
  });

  // Prefetch on hover/touchstart so the fetch is already done by tap time
  function _prefetch(href) {
    if (!href || _pageCache.has(href) || href.startsWith('http') ||
        href.startsWith('#') || href.startsWith('mailto') || href.startsWith('tel')) return;
    fetch(href).then(r => r.text()).then(h => _pageCache.set(href, h)).catch(() => {});
  }
  document.addEventListener('mouseover', e => {
    const a = e.target.closest('a[href]');
    if (a) _prefetch(a.getAttribute('href'));
  });
  document.addEventListener('touchstart', e => {
    const a = e.target.closest('a[href]');
    if (a) _prefetch(a.getAttribute('href'));
  }, { passive: true });

  // Fade in on first cold load
  window.addEventListener('pageshow', () => {
    document.body.style.opacity    = '1';
    document.body.style.transition = 'opacity 0.15s ease';
  });

  /* ── 8. NATIVE-FEEL: Status bar color sync ──────────── */
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

  // Sync on load and on theme toggle
  document.addEventListener('DOMContentLoaded', syncStatusBar);
  const observer = new MutationObserver(syncStatusBar);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ── 9. NATIVE-FEEL: Back gesture support ───────────── */
  // Tracks history so Android back button works naturally inside the SPA
  if (isInstalled()) {
    // Pre-populate history on first load so back button has somewhere to go
    if (window.history.length <= 1) {
      history.replaceState({ page: 'home' }, '', window.location.href);
    }
  }

  /* ── 10. STYLES injected for install toast & nudge ──── */
  const pwaStyles = document.createElement('style');
  pwaStyles.textContent = `
    /* Install Toast */
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
    .kfl-install-toast__text {
      flex: 1;
      min-width: 0;
    }
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
      border: none;
      border-radius: 8px;
      padding: 8px 14px;
      font-size: 0.8rem;
      font-weight: 700;
      cursor: pointer;
      flex-shrink: 0;
      font-family: inherit;
      transition: opacity 0.15s;
    }
    .kfl-install-toast__btn:hover { opacity: 0.85; }
    .kfl-install-toast__close {
      background: none; border: none;
      color: var(--kfl-text-3, #4a5f7a);
      cursor: pointer;
      padding: 4px;
      font-size: 0.9rem;
      flex-shrink: 0;
      transition: color 0.15s;
    }
    .kfl-install-toast__close:hover { color: var(--kfl-text-1, #eef2ff); }

    /* Update Nudge */
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
      font-size: 0.8rem;
      font-weight: 600;
    }
    #kfl-update-btn {
      background: rgba(0,0,0,0.15);
      border: 1px solid rgba(0,0,0,0.2);
      color: inherit;
      border-radius: 6px;
      padding: 4px 12px;
      font-size: 0.78rem;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
    }

    /* Safe area bottom padding for fixed navs */
    .kfl-subnav {
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }

    /* iOS home-indicator clearance for bottom-fixed elements */
    .toast {
      bottom: calc(80px + env(safe-area-inset-bottom, 0px)) !important;
    }
  `;
  document.head.appendChild(pwaStyles);

})();
