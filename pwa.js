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

          // Listen for a new SW installing
          reg.addEventListener('updatefound', () => {
            const worker = reg.installing;
            if (!worker) return;

            worker.addEventListener('statechange', () => {
              // Only show nudge if there's already a controller (i.e. not first install)
              if (worker.state === 'installed' && navigator.serviceWorker.controller) {
                showUpdateNudge();
              }
            });
          });

          await waitForActive(reg);
          registerPeriodicSync(reg);
        })
        .catch(err => console.warn('[SW] Registration failed:', err));

      // ── FIX: only reload if a *previous* controller existed ──
      // Tracks whether there was a controller before the page loaded.
      // Without this guard, the first SW install triggers a reload loop.
      let previousController = !!navigator.serviceWorker.controller;

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (previousController) {
          // A new SW has taken over — reload once for fresh assets
          window.location.reload();
        } else {
          // First install — no reload needed, just mark it
          previousController = true;
        }
      });

      // Messages from SW
      navigator.serviceWorker.addEventListener('message', event => {
        const { type, ts } = event.data || {};

        if (type === 'BOOTSTRAP_UPDATED') {
          console.log('[PWA] Fresh bootstrap-static in cache', ts ? new Date(ts).toLocaleTimeString() : '');
          window.dispatchEvent(new CustomEvent('kopala:bootstrap-updated', { detail: { ts } }));
        }

        if (type === 'RUN_PRICE_CHECK') {
          console.log('[PWA] SW requested price check');
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
        console.log('[PWA] Periodic sync permission:', status.state);
        return;
      }

      const tags = await reg.periodicSync.getTags();

      if (!tags.includes(PBS_TAG)) {
        await reg.periodicSync.register(PBS_TAG, { minInterval: PBS_MIN_INTERVAL_MS });
        console.log('[PWA] Bootstrap sync registered — min interval: 3h');
      } else {
        console.log('[PWA] Bootstrap sync already registered');
      }

      if (!tags.includes(PBS_PRICE_TAG)) {
        await reg.periodicSync.register(PBS_PRICE_TAG, { minInterval: PBS_PRICE_INTERVAL });
        console.log('[PWA] Price sync registered — min interval: 12h');
      } else {
        console.log('[PWA] Price sync already registered');
      }

    } catch (err) {
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

    // Only show if not already installed and not recently dismissed
    const dismissed = localStorage.getItem('kfl_install_dismissed');
    const cooldown  = 3 * 24 * 60 * 60 * 1000; // 3 days
    if (dismissed && Date.now() - parseInt(dismissed, 10) < cooldown) return;

    setTimeout(() => {
      if (!isInstalled()) showInstallToast();
    }, 4000);
  });

  window.addEventListener('appinstalled', () => {
    _deferredPrompt = null;
    hideInstallToast();
    localStorage.removeItem('kfl_install_dismissed');
    console.log('[PWA] App installed');
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
        <span class="material-symbols-rounded">sports_soccer</span>
      </div>
      <div class="kfl-install-toast__text">
        <strong>Add to Home Screen</strong>
        <span>Get the full app experience</span>
      </div>
      <button class="kfl-install-toast__btn" id="kfl-install-btn">Install</button>
      <button class="kfl-install-toast__close" id="kfl-install-close" aria-label="Dismiss">
        <span class="material-symbols-rounded">close</span>
      </button>
    `;
    document.body.appendChild(toast);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => toast.classList.add('kfl-install-toast--visible'));
    });

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
      <span>
        <span class="material-symbols-rounded" style="font-size:16px;vertical-align:-3px;margin-right:6px">refresh</span>
        Update available
      </span>
      <button id="kfl-update-btn">Reload</button>
    `;
    document.body.prepend(bar);
    document.getElementById('kfl-update-btn')?.addEventListener('click', () => window.location.reload());
  }

  /* ── 6. NATIVE-FEEL: Instant tap response ───────────── */
  document.addEventListener('touchstart', function () {}, { passive: true });

  const tapStyle = document.createElement('style');
  tapStyle.textContent = `
    a, button, [role="button"], .kfl-drawer__link, .kfl-bottom-nav__item, .kfl-topbar__nav-link {
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
  `;
  document.head.appendChild(tapStyle);

  /* ── 7. NATIVE-FEEL: Overscroll & pull-to-refresh ───── */
  document.body.style.overscrollBehaviorY = 'contain';

  /* ── 8. NATIVE-FEEL: Page transitions ───────────────── */
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href]');
    if (!link) return;

    const href = link.getAttribute('href');
    if (!href) return;
    if (href.startsWith('http') || href.startsWith('//')) return;
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return;
    if (link.target === '_blank') return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    e.preventDefault();

    document.body.style.transition = 'opacity 0.1s ease';
    document.body.style.opacity    = '0.8';

    setTimeout(() => { window.location.href = href; }, 70);
  });

  window.addEventListener('pageshow', e => {
    // pageshow fires on bfcache restore too — always restore opacity
    document.body.style.opacity    = '1';
    document.body.style.transition = 'opacity 0.15s ease';
  });

  /* ── 9. NATIVE-FEEL: Status bar color sync ──────────── */
  // Matches the new dark/light theme surface colors from nav.css
  const THEME_COLORS = {
    dark:  '#0e0d1a',  // --kfl-bg dark
    light: '#f4f2ff',  // --kfl-bg light
  };

  function syncStatusBar() {
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    const color = THEME_COLORS[theme] || THEME_COLORS.dark;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = color;
  }

  // Run immediately (theme may already be set from localStorage before DOMContentLoaded)
  syncStatusBar();
  document.addEventListener('DOMContentLoaded', syncStatusBar);
  new MutationObserver(syncStatusBar)
    .observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ── 10. NATIVE-FEEL: Back gesture support ──────────── */
  if (isInstalled()) {
    if (window.history.length <= 1) {
      history.replaceState({ page: 'home' }, '', window.location.href);
    }
  }

  /* ── 11. STYLES ──────────────────────────────────────── */
  const pwaStyles = document.createElement('style');
  pwaStyles.textContent = `

    /* ── Install Toast ── */
    #kfl-install-toast {
      position: fixed;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 76px);
      left: 12px;
      right: 12px;
      background: var(--kfl-surface, #13112a);
      border: 1px solid var(--kfl-border, rgba(255,255,255,0.08));
      border-radius: 14px;
      padding: 13px 13px 13px 15px;
      display: flex;
      align-items: center;
      gap: 11px;
      z-index: 9999;
      box-shadow: 0 12px 48px rgba(0,0,0,0.55);
      transform: translateY(120%);
      opacity: 0;
      transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease;
      max-width: 480px;
      margin: 0 auto;
    }

    /* On desktop (no bottom nav) — anchor to bottom-right */
    @media (min-width: 768px) {
      #kfl-install-toast {
        left: auto;
        bottom: 24px;
        right: 24px;
        width: 320px;
        max-width: 320px;
      }
    }

    #kfl-install-toast.kfl-install-toast--visible {
      transform: translateY(0);
      opacity: 1;
    }

    .kfl-install-toast__icon {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: var(--kfl-accent-dim, rgba(212,240,0,0.1));
      color: var(--kfl-accent, #d4f000);
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }

    .kfl-install-toast__icon .material-symbols-rounded {
      font-size: 18px;
      font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
    }

    .kfl-install-toast__text {
      flex: 1;
      min-width: 0;
    }

    .kfl-install-toast__text strong {
      display: block;
      font-size: 13px;
      font-weight: 700;
      color: var(--kfl-text-1, #f0eeff);
      margin-bottom: 2px;
    }

    .kfl-install-toast__text span {
      font-size: 11.5px;
      color: var(--kfl-text-3, #5c5585);
    }

    .kfl-install-toast__btn {
      background: var(--kfl-accent, #d4f000);
      color: var(--kfl-accent-text, #0e0d1a);
      border: none;
      border-radius: 8px;
      padding: 8px 14px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      flex-shrink: 0;
      font-family: inherit;
      letter-spacing: 0.2px;
      transition: opacity 0.15s;
    }

    .kfl-install-toast__btn:hover { opacity: 0.85; }

    .kfl-install-toast__close {
      background: none;
      border: none;
      color: var(--kfl-text-3, #5c5585);
      cursor: pointer;
      padding: 4px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      transition: color 0.15s;
      border-radius: 6px;
    }

    .kfl-install-toast__close:hover { color: var(--kfl-text-1, #f0eeff); }

    .kfl-install-toast__close .material-symbols-rounded {
      font-size: 18px;
    }

    /* ── Update Nudge ── */
    #kfl-update-nudge {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      z-index: 9998;
      background: var(--kfl-accent, #d4f000);
      color: var(--kfl-accent-text, #0e0d1a);
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 9px 16px;
      font-size: 12.5px;
      font-weight: 600;
      letter-spacing: 0.1px;
    }

    #kfl-update-btn {
      background: rgba(0,0,0,0.12);
      border: 1px solid rgba(0,0,0,0.18);
      color: inherit;
      border-radius: 6px;
      padding: 4px 12px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      font-family: inherit;
      transition: background 0.15s;
    }

    #kfl-update-btn:hover {
      background: rgba(0,0,0,0.22);
    }

    /* ── Safe area clearance ── */
    .toast {
      bottom: calc(76px + env(safe-area-inset-bottom, 0px)) !important;
    }
  `;
  document.head.appendChild(pwaStyles);

})();
