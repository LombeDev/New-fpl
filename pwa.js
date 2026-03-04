/* ============================================================
   KOPALA FPL — PWA.JS
   Service Worker registration + native-feel enhancements
   No progress bars. No splash. Instant. Native.
   ============================================================ */

(function () {
  'use strict';

  const PBS_TAG             = 'fpl-bootstrap-sync';
  const PBS_MIN_INTERVAL_MS = 3  * 60 * 60 * 1000; // 3 hours
  const PBS_PRICE_TAG       = 'fpl-price-sync';
  const PBS_PRICE_INTERVAL  = 12 * 60 * 60 * 1000; // 12 hours

  /* ── 1. REGISTER SERVICE WORKER ──────────────────────── */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(async reg => {
          // Check for updates silently in background
          reg.addEventListener('updatefound', () => {
            const worker = reg.installing;
            worker?.addEventListener('statechange', () => {
              if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                showUpdateNudge();
              }
            });
          });

          // Register Periodic Background Sync once SW is active
          await waitForActive(reg);
          registerPeriodicSync(reg);
        })
        .catch(err => console.warn('[SW] Registration failed:', err));

      // When a new SW takes over, reload for fresh assets
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });

      // Listen for messages from SW (e.g. fresh bootstrap data available)
      navigator.serviceWorker.addEventListener('message', event => {
        const { type, ts } = event.data || {};
        if (type === 'BOOTSTRAP_UPDATED') {
          console.log('[PWA] Fresh bootstrap-static in cache', ts ? new Date(ts).toLocaleTimeString() : '');
          // Let kopala-notify.js / badge.js react without a full reload
          window.dispatchEvent(new CustomEvent('kopala:bootstrap-updated', { detail: { ts } }));
        }
        if (type === 'RUN_PRICE_CHECK') {
          console.log('[PWA] SW requested price check');
          // kopala-notify.js listens for this event and runs checkPriceChanges()
          window.dispatchEvent(new CustomEvent('kopala:run-price-check', { detail: { ts } }));
        }
      });
    });
  }

  /* ── 2. PERIODIC BACKGROUND SYNC ─────────────────────── */
  async function registerPeriodicSync(reg) {
    if (!('periodicSync' in reg)) {
      console.log('[PWA] Periodic Background Sync not supported');
      return;
    }

    try {
      const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (status.state !== 'granted') {
        // Normal on first visit — granted automatically once PWA is installed
        console.log('[PWA] Periodic sync permission:', status.state);
        return;
      }

      const tags = await reg.periodicSync.getTags();

      // Bootstrap warm-up — every 3h
      if (!tags.includes(PBS_TAG)) {
        await reg.periodicSync.register(PBS_TAG, { minInterval: PBS_MIN_INTERVAL_MS });
        console.log('[PWA] Bootstrap sync registered — min interval: 3h');
      } else {
        console.log('[PWA] Bootstrap sync already registered');
      }

      // Morning price digest — every 12h
      if (!tags.includes(PBS_PRICE_TAG)) {
        await reg.periodicSync.register(PBS_PRICE_TAG, { minInterval: PBS_PRICE_INTERVAL });
        console.log('[PWA] Price sync registered — min interval: 12h');
      } else {
        console.log('[PWA] Price sync already registered');
      }

    } catch (err) {
      // Silently fails in non-installed PWA contexts — expected
      console.log('[PWA] Periodic sync skipped:', err.message);
    }
  }

  function waitForActive(reg) {
    return new Promise(resolve => {
      if (reg.active) { resolve(reg); return; }
      const sw = reg.installing || reg.waiting;
      if (!sw)  { resolve(reg); return; }
      sw.addEventListener('statechange', function handler() {
        if (this.state === 'activated') {
          sw.removeEventListener('statechange', handler);
          resolve(reg);
        }
      });
    });
  }

  /* ── 3. INSTALL PROMPT (Add to Home Screen) ─────────── */
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

  /* ── 4. INSTALL TOAST ────────────────────────────────── */
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

  /* ── 5. UPDATE NUDGE ─────────────────────────────────── */
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

  /* ── 6. NATIVE-FEEL: Instant tap response ───────────── */
  document.addEventListener('touchstart', function () {}, { passive: true });

  const tapStyle = document.createElement('style');
  tapStyle.textContent = `
    a, button, [role="button"], .kfl-subnav__link, .kfl-drawer__link {
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
  `;
  document.head.appendChild(tapStyle);

  /* ── 7. NATIVE-FEEL: Overscroll & pull-to-refresh ───── */
  document.body.style.overscrollBehaviorY = 'contain';
  document.documentElement.style.webkitOverflowScrolling = 'touch';

  /* ── 8. NATIVE-FEEL: Page transitions ───────────────── */
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href]');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href || href.startsWith('http') || href.startsWith('#') || href.startsWith('mailto')) return;
    if (link.target === '_blank') return;
    if (e.metaKey || e.ctrlKey || e.shiftKey) return;

    e.preventDefault();

    document.body.style.transition = 'opacity 0.12s ease';
    document.body.style.opacity    = '0.85';

    setTimeout(() => { window.location.href = href; }, 80);
  });

  window.addEventListener('pageshow', () => {
    document.body.style.opacity    = '1';
    document.body.style.transition = 'opacity 0.15s ease';
  });

  /* ── 9. NATIVE-FEEL: Status bar color sync ──────────── */
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
  const observer = new MutationObserver(syncStatusBar);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ── 10. NATIVE-FEEL: Back gesture support ──────────── */
  if (isInstalled()) {
    if (window.history.length <= 1) {
      history.replaceState({ page: 'home' }, '', window.location.href);
    }
  }

  /* ── 11. STYLES ──────────────────────────────────────── */
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

    /* Safe area clearance */
    .kfl-subnav {
      padding-bottom: env(safe-area-inset-bottom, 0px);
    }
    .toast {
      bottom: calc(80px + env(safe-area-inset-bottom, 0px)) !important;
    }
  `;
  document.head.appendChild(pwaStyles);

})();
