/* ============================================================
   KOPALA FPL — PWA.JS
   Service Worker registration + native-feel enhancements
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

  /* ── 2. INSTALL PROMPT ──────────────────────────────── */
  let _deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _deferredPrompt = e;
    setTimeout(() => { if (!isInstalled()) showInstallToast(); }, 4000);
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
      <div class="kfl-install-toast__icon"><i class="fa-solid fa-futbol"></i></div>
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

  /* ── 5. NATIVE FEEL ─────────────────────────────────── */
  document.addEventListener('touchstart', function () {}, { passive: true });

  const tapStyle = document.createElement('style');
  tapStyle.textContent = `
    a, button, [role="button"], .kfl-subnav__link, .kfl-drawer__link {
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
  `;
  document.head.appendChild(tapStyle);

  document.body.style.overscrollBehaviorY = 'contain';
  document.documentElement.style.webkitOverflowScrolling = 'touch';

  /* ── 6. SPA NAVIGATION ──────────────────────────────── */
  // HTML is never served from cache — always fetched fresh.
  // _pageCache is an in-memory store only used as an offline
  // fallback if the network fails mid-session.

  const _pageCache = new Map();
  let   _navigating = false;

  async function _applyHTML(html, href) {
    const parser = new DOMParser();
    const newDoc = parser.parseFromString(html, 'text/html');

    document.title = newDoc.title;

    const newThemeMeta = newDoc.querySelector('meta[name="theme-color"]');
    if (newThemeMeta) {
      let m = document.querySelector('meta[name="theme-color"]');
      if (!m) { m = document.createElement('meta'); m.name = 'theme-color'; document.head.appendChild(m); }
      m.content = newThemeMeta.content;
    }

    document.body.innerHTML = newDoc.body.innerHTML;
    Array.from(newDoc.body.attributes).forEach(attr => document.body.setAttribute(attr.name, attr.value));

    // Re-execute scripts (DOMParser doesn't run them)
    const scripts = Array.from(document.body.querySelectorAll('script'));
    for (const old of scripts) {
      const s = document.createElement('script');
      Array.from(old.attributes).forEach(attr => s.setAttribute(attr.name, attr.value));
      if (!old.src) s.textContent = old.textContent;
      old.parentNode.replaceChild(s, old);
      if (s.src) await new Promise(r => { s.onload = r; s.onerror = r; });
    }

    window.scrollTo(0, 0);
    window.dispatchEvent(new CustomEvent('kfl:navigate', { detail: { href } }));
  }

  async function kflNavigate(href) {
    if (_navigating) return;
    _navigating = true;

    try {
      // Always fetch fresh — never serve HTML from any cache
      let html;
      try {
        const res = await fetch(href, { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP ' + res.status);
        html = await res.text();
        _pageCache.set(href, html); // keep for offline fallback only
      } catch (netErr) {
        html = _pageCache.get(href);
        if (!html) throw netErr;
        console.info('[KFL] Offline fallback:', href);
      }

      history.pushState({ href }, '', href);
      await _applyHTML(html, href);

    } catch (err) {
      console.warn('[KFL] Navigate failed, falling back:', err);
      window.location.href = href;
    } finally {
      _navigating = false;
    }
  }

  // Intercept local link clicks
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

  // Back/forward
  window.addEventListener('popstate', e => {
    if (e.state?.href) kflNavigate(e.state.href);
  });



  /* ── 8. STATUS BAR SYNC ─────────────────────────────── */
  function syncStatusBar() {
    const theme = document.documentElement.getAttribute('data-theme') || 'light';
    const color = theme === 'dark' ? '#0d1520' : '#ffffff';
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
    meta.content = color;
  }
  document.addEventListener('DOMContentLoaded', syncStatusBar);
  new MutationObserver(syncStatusBar).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ── 9. COLD LOAD FADE ──────────────────────────────── */
  window.addEventListener('pageshow', () => {
    document.body.style.opacity    = '1';
    document.body.style.transition = 'opacity 0.15s ease';
  });

  /* ── 10. BACK GESTURE ───────────────────────────────── */
  if (isInstalled() && window.history.length <= 1) {
    history.replaceState({ href: window.location.pathname }, '', window.location.href);
  }

  /* ── 11. STYLES ─────────────────────────────────────── */
  const pwaStyles = document.createElement('style');
  pwaStyles.textContent = `
    #kfl-install-toast {
      position: fixed;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 80px);
      left: 12px; right: 12px;
      background: var(--kfl-surface, #141e2d);
      border: 1px solid var(--kfl-border, rgba(255,255,255,0.1));
      border-radius: 16px;
      padding: 14px 14px 14px 16px;
      display: flex; align-items: center; gap: 12px;
      z-index: 9999;
      box-shadow: 0 8px 40px rgba(0,0,0,0.5);
      transform: translateY(120%); opacity: 0;
      transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease;
      max-width: 480px; margin: 0 auto;
    }
    #kfl-install-toast.kfl-install-toast--visible { transform: translateY(0); opacity: 1; }
    .kfl-install-toast__icon {
      width: 40px; height: 40px; border-radius: 10px;
      background: var(--kfl-green-dim, rgba(0,200,90,0.12));
      color: var(--kfl-green, #00c85a);
      display: flex; align-items: center; justify-content: center;
      font-size: 1rem; flex-shrink: 0;
    }
    .kfl-install-toast__text { flex: 1; min-width: 0; }
    .kfl-install-toast__text strong {
      display: block; font-size: 0.88rem; font-weight: 700;
      color: var(--kfl-text-1, #eef2ff); margin-bottom: 2px;
    }
    .kfl-install-toast__text span { font-size: 0.72rem; color: var(--kfl-text-3, #4a5f7a); }
    .kfl-install-toast__btn {
      background: var(--kfl-green, #00c85a); color: var(--kfl-pill-fg, #fff);
      border: none; border-radius: 8px; padding: 8px 14px;
      font-size: 0.8rem; font-weight: 700; cursor: pointer;
      flex-shrink: 0; font-family: inherit; transition: opacity 0.15s;
    }
    .kfl-install-toast__btn:hover { opacity: 0.85; }
    .kfl-install-toast__close {
      background: none; border: none; color: var(--kfl-text-3, #4a5f7a);
      cursor: pointer; padding: 4px; font-size: 0.9rem;
      flex-shrink: 0; transition: color 0.15s;
    }
    .kfl-install-toast__close:hover { color: var(--kfl-text-1, #eef2ff); }

    #kfl-update-nudge {
      position: fixed; top: 0; left: 0; right: 0; z-index: 9998;
      background: var(--kfl-green, #00c85a); color: var(--kfl-pill-fg, #021409);
      display: flex; align-items: center; justify-content: space-between;
      padding: 10px 16px; font-size: 0.8rem; font-weight: 600;
    }
    #kfl-update-btn {
      background: rgba(0,0,0,0.15); border: 1px solid rgba(0,0,0,0.2);
      color: inherit; border-radius: 6px; padding: 4px 12px;
      font-size: 0.78rem; font-weight: 700; cursor: pointer; font-family: inherit;
    }

    .kfl-subnav { padding-bottom: env(safe-area-inset-bottom, 0px); }
    .toast      { bottom: calc(80px + env(safe-area-inset-bottom, 0px)) !important; }
  `;
  document.head.appendChild(pwaStyles);

})();
