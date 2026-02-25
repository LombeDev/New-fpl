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

  /* ── 7. NATIVE-FEEL: SPA navigation ─────────────────── */
  // Uses DOMParser + script re-execution instead of document.open/write.
  // document.write() causes "identifier already declared" crashes because
  // it injects HTML into the *existing* JS scope, so any const/let in the
  // fetched page collides with variables already declared in this session.
  // DOMParser parses into a detached document — no scope collision at all.

  const _pageCache = new Map();
  let   _navigating = false;

  async function kflNavigate(href) {
    if (_navigating) return;
    _navigating = true;

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

      history.pushState({ href }, '', href);

      // Parse fetched HTML in a sandboxed document — zero scope collision
      const parser = new DOMParser();
      const newDoc = parser.parseFromString(html, 'text/html');

      // Update <title>
      document.title = newDoc.title;

      // Sync theme-color meta
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

      // Replace <body> content
      document.body.innerHTML = newDoc.body.innerHTML;

      // Copy body attributes (class, data-theme, etc.)
      Array.from(newDoc.body.attributes).forEach(attr => {
        document.body.setAttribute(attr.name, attr.value);
      });

      // Re-execute all <script> tags — DOMParser does NOT run scripts,
      // so we clone each into a fresh <script> element for the browser to execute.
      const scripts = Array.from(document.body.querySelectorAll('script'));
      for (const oldScript of scripts) {
        const newScript = document.createElement('script');
        Array.from(oldScript.attributes).forEach(attr => {
          newScript.setAttribute(attr.name, attr.value);
        });
        if (!oldScript.src) {
          newScript.textContent = oldScript.textContent;
        }
        oldScript.parentNode.replaceChild(newScript, oldScript);

        // Wait for external scripts to load before continuing
        if (newScript.src) {
          await new Promise(resolve => {
            newScript.onload  = resolve;
            newScript.onerror = resolve;
          });
        }
      }

      // Scroll to top, restore opacity
      window.scrollTo(0, 0);
      document.body.style.opacity    = '1';
      document.body.style.transition = 'opacity 0.15s ease';

      // Fire event so page-specific init code can hook in
      window.dispatchEvent(new CustomEvent('kfl:navigate', { detail: { href } }));

    } catch (err) {
      console.warn('[KFL] Navigate failed, falling back:', err);
      window.location.href = href;
    } finally {
      _navigating = false;
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

  /* ── 8. PREFETCH on hover/touchstart ────────────────── */
  // Uses a single GET with cache:'no-store' so the service worker never
  // intercepts it (avoids the Cache.put-HEAD crash in sw.js).
  // Dead links are remembered in _deadLinks so each bad URL is only
  // attempted once — no repeated 404 console noise on re-hover.
  const _deadLinks = new Set();

  function _prefetch(href) {
    if (!href || _pageCache.has(href) || _deadLinks.has(href)) return;
    if (href.startsWith('http') || href.startsWith('#') ||
        href.startsWith('mailto') || href.startsWith('tel')) return;

    // Mark as in-flight immediately so concurrent hover/touchstart events
    // don't fire duplicate requests for the same URL
    _deadLinks.add(href); // tentatively dead until proven otherwise

    fetch(href, { cache: 'no-store' }) // 'no-store' bypasses SW interception
      .then(r => {
        if (!r.ok) return; // 404/5xx → stays in _deadLinks, never retried
        _deadLinks.delete(href); // it's alive — remove from dead set
        return r.text().then(h => _pageCache.set(href, h));
      })
      .catch(() => {}); // network error → stays in _deadLinks this session
  }

  document.addEventListener('mouseover', e => {
    const a = e.target.closest('a[href]');
    if (a) _prefetch(a.getAttribute('href'));
  });
  document.addEventListener('touchstart', e => {
    const a = e.target.closest('a[href]');
    if (a) _prefetch(a.getAttribute('href'));
  }, { passive: true });

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

  /* ── 10. NATIVE-FEEL: Fade in on cold load ───────────── */
  window.addEventListener('pageshow', () => {
    document.body.style.opacity    = '1';
    document.body.style.transition = 'opacity 0.15s ease';
  });

  /* ── 11. NATIVE-FEEL: Back gesture support ───────────── */
  if (isInstalled()) {
    if (window.history.length <= 1) {
      history.replaceState({ href: window.location.pathname }, '', window.location.href);
    }
  }

  /* ── 12. STYLES: install toast & nudge ──────────────── */
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

    .toast {
      bottom: calc(80px + env(safe-area-inset-bottom, 0px)) !important;
    }
  `;
  document.head.appendChild(pwaStyles);

})();
