/* ============================================================
   KOPALA FPL — PWA.JS
   Service Worker registration + native-feel enhancements
   No progress bars. No splash. Instant. Native.

   Navigation model (dev.to / Turbo-style):
   - Hover over any internal link → prefetch HTML silently
   - Click any internal link → fetch HTML, swap <main> only
   - Nav, footer, scripts never reload between pages
   - History API keeps URLs and back/forward working
   - Falls back to full navigation if swap fails
   ============================================================ */

(function () {
  'use strict';

  const PBS_TAG               = 'fpl-bootstrap-sync';
  const PBS_MIN_INTERVAL_MS   = 3  * 60 * 60 * 1000;
  const PBS_PRICE_TAG         = 'fpl-price-sync';
  const PBS_PRICE_INTERVAL    = 12 * 60 * 60 * 1000;
  const PBS_DEADLINE_TAG      = 'fpl-deadline-check';
  const PBS_DEADLINE_INTERVAL = 60 * 60 * 1000;

  /* ── 1. REGISTER SERVICE WORKER ──────────────────────── */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {

      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(async reg => {
          await waitForActive(reg);
          registerPeriodicSync(reg);
        })
        .catch(err => console.warn('[SW] Registration failed:', err));

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

        if (type === 'DEADLINE_APPROACHING') {
          const { gwName, dlStr } = event.data;
          window.dispatchEvent(new CustomEvent('kopala:deadline-approaching', { detail: { gwName, dlStr } }));
        }
      });
    });
  }

  /* ── 2. PERIODIC BACKGROUND SYNC ─────────────────────── */
  async function registerPeriodicSync(reg) {
    if (!('periodicSync' in reg)) return;
    try {
      const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (status.state !== 'granted') return;
      const tags = await reg.periodicSync.getTags();
      if (!tags.includes(PBS_TAG))
        await reg.periodicSync.register(PBS_TAG, { minInterval: PBS_MIN_INTERVAL_MS });
      if (!tags.includes(PBS_PRICE_TAG))
        await reg.periodicSync.register(PBS_PRICE_TAG, { minInterval: PBS_PRICE_INTERVAL });
      if (!tags.includes(PBS_DEADLINE_TAG))
        await reg.periodicSync.register(PBS_DEADLINE_TAG, { minInterval: PBS_DEADLINE_INTERVAL });
    } catch (err) {
      console.log('[PWA] Periodic sync skipped:', err.message);
    }
  }

  function waitForActive(reg) {
    return new Promise(resolve => {
      if (reg.active) { resolve(reg); return; }
      const sw = reg.installing || reg.waiting;
      if (!sw) { resolve(reg); return; }
      sw.addEventListener('statechange', function handler() {
        if (this.state === 'activated') {
          sw.removeEventListener('statechange', handler);
          resolve(reg);
        }
      });
    });
  }

  /* ── 3. INSTALL PROMPT ───────────────────────────────── */
  let _deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _deferredPrompt = e;
    const dismissed = localStorage.getItem('kfl_install_dismissed');
    const cooldown  = 3 * 24 * 60 * 60 * 1000;
    if (dismissed && Date.now() - parseInt(dismissed, 10) < cooldown) return;
    setTimeout(() => { if (!isInstalled()) showInstallToast(); }, 4000);
  });

  window.addEventListener('appinstalled', () => {
    _deferredPrompt = null;
    hideInstallToast();
    localStorage.removeItem('kfl_install_dismissed');
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
    requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('kfl-install-toast--visible')));
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

  /* ── 5. NATIVE-FEEL ──────────────────────────────────── */
  document.addEventListener('touchstart', function () {}, { passive: true });

  const tapStyle = document.createElement('style');
  tapStyle.textContent = `
    a, button, [role="button"], .kfl-drawer__link, .kfl-bottom-nav__item, .kfl-topbar__nav-link {
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }
  `;
  document.head.appendChild(tapStyle);

  document.body.style.overscrollBehaviorY = 'contain';

  /* ── 6. TURBO-STYLE CONTENT SWAP NAVIGATION ──────────── */
  /*
   * How it works:
   *   1. Hover a link → silently fetch + cache the HTML (prefetch)
   *   2. Click a link → pull from prefetch cache or fetch fresh
   *   3. Parse the response, extract <main> and <title>
   *   4. Crossfade old <main> out, new <main> in (16ms)
   *   5. Update URL with history.pushState
   *   6. Re-run any inline <script> tags inside new <main>
   *   7. Fire 'kopala:page-changed' event for other modules to reinit
   *
   * Nav, header, footer, styles, and all top-level scripts
   * are NEVER reloaded — they persist across all navigations.
   *
   * Falls back to a normal full navigation if anything fails.
   */

  const _prefetchCache = new Map(); // href → Promise<Document>
  const _prefetched    = new Set(); // hrefs already prefetched
  let   _navigating    = false;

  /* Decide if a link should be handled by the swap router */
  function isSameAppLink(link) {
    const href = link.getAttribute('href');
    if (!href) return false;
    if (href.startsWith('http') || href.startsWith('//')) return false;
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
    if (link.target === '_blank') return false;
    /* Skip links that point to the current page */
    const target = new URL(href, location.href).pathname;
    if (target === location.pathname) return false;
    return true;
  }

  /* Fetch + parse a page into a Document object, cache the Promise */
  function prefetchPage(href) {
    if (_prefetchCache.has(href)) return _prefetchCache.get(href);
    const p = fetch(href, { credentials: 'same-origin' })
      .then(res => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(html => new DOMParser().parseFromString(html, 'text/html'))
      .catch(err => {
        _prefetchCache.delete(href); // allow retry on error
        throw err;
      });
    _prefetchCache.set(href, p);
    return p;
  }

  /* Crossfade transition — old out, new in, total ~120ms */
  function swapMain(newMain) {
    return new Promise(resolve => {
      const old = document.querySelector('main');
      if (!old) { resolve(); return; }

      /* Fade old content out */
      old.style.transition = 'opacity 0.08s ease';
      old.style.opacity    = '0';

      setTimeout(() => {
        /* Copy attributes (id, class) from new main onto old element */
        Array.from(newMain.attributes).forEach(attr => {
          old.setAttribute(attr.name, attr.value);
        });
        old.innerHTML = newMain.innerHTML;

        /* Fade new content in */
        old.style.opacity    = '0';
        old.style.transition = 'opacity 0.1s ease';
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            old.style.opacity = '1';
            setTimeout(() => {
              old.style.transition = '';
              old.style.opacity    = '';
              resolve();
            }, 100);
          });
        });
      }, 80);
    });
  }

  /* Re-execute inline <script> tags inside the new main */
  function rerunScripts(container) {
    container.querySelectorAll('script').forEach(oldScript => {
      if (oldScript.src) return; // external scripts already loaded globally
      const s = document.createElement('script');
      if (oldScript.type) s.type = oldScript.type;
      s.textContent = oldScript.textContent;
      oldScript.replaceWith(s);
    });
  }

  /* Scroll to top (or to anchor if hash present) */
  function scrollAfterSwap(href) {
    const hash = new URL(href, location.href).hash;
    if (hash) {
      const el = document.querySelector(hash);
      if (el) { el.scrollIntoView({ behavior: 'smooth' }); return; }
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  /* Main navigation handler */
  async function navigateTo(href, pushState = true) {
    if (_navigating) return;
    _navigating = true;

    try {
      const doc     = await prefetchPage(href);
      const newMain = doc.querySelector('main');

      if (!newMain) {
        /* Page has no <main> — fall back to normal navigation */
        window.location.href = href;
        return;
      }

      /* Update <title> */
      const newTitle = doc.querySelector('title');
      if (newTitle) document.title = newTitle.textContent;

      /* Update active nav state */
      updateNavActive(href);

      /* Swap content */
      await swapMain(newMain);
      rerunScripts(document.querySelector('main'));
      scrollAfterSwap(href);

      /* Push history */
      if (pushState) history.pushState({ href }, document.title, href);

      /* Notify other modules (kopala-notify, page-specific JS) */
      window.dispatchEvent(new CustomEvent('kopala:page-changed', {
        detail: { href, title: document.title }
      }));

      console.log('[PWA] Swapped to', href);

    } catch (err) {
      console.warn('[PWA] Swap failed, falling back:', err.message);
      window.location.href = href;
    } finally {
      _navigating = false;
    }
  }

  /* Keep bottom nav + topbar active states in sync */
  function updateNavActive(href) {
    const path = new URL(href, location.href).pathname;

    /* Bottom nav tabs */
    document.querySelectorAll('.kfl-tab').forEach(tab => {
      const tabHref = tab.getAttribute('href') || tab.dataset.href || '';
      const tabPath = tabHref ? new URL(tabHref, location.href).pathname : '';
      tab.classList.toggle('kfl-tab--active', tabPath === path);
      tab.setAttribute('aria-current', tabPath === path ? 'page' : 'false');
    });

    /* Topbar page name — read from the new page's <h1> or <title> */
    const pageNameEl = document.querySelector('.kfl-topbar__page-name');
    if (pageNameEl) {
      const h1 = document.querySelector('main h1');
      pageNameEl.textContent = h1 ? h1.textContent.trim() : document.title;
    }
  }

  /* ── Hover prefetch ── */
  document.addEventListener('mouseover', e => {
    const link = e.target.closest('a[href]');
    if (!link || !isSameAppLink(link)) return;
    const href = link.getAttribute('href');
    if (_prefetched.has(href)) return;
    _prefetched.add(href);
    prefetchPage(href).catch(() => {}); // silent — just warm the cache
  });

  /* ── Touch start prefetch (mobile equivalent of hover) ── */
  document.addEventListener('touchstart', e => {
    const link = e.target.closest('a[href]');
    if (!link || !isSameAppLink(link)) return;
    const href = link.getAttribute('href');
    if (_prefetched.has(href)) return;
    _prefetched.add(href);
    prefetchPage(href).catch(() => {});
  }, { passive: true });

  /* ── Click handler — intercept and swap ── */
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href]');
    if (!link || !isSameAppLink(link)) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigateTo(link.getAttribute('href'));
  });

  /* ── Browser back / forward ── */
  window.addEventListener('popstate', e => {
    const href = e.state?.href || location.pathname;
    navigateTo(href, false); // don't push state again
  });

  /* ── 7. SPECULATION RULES — prerender on moderate eagerness ── */
  /*
   * Chrome prerenders pages in an invisible background tab.
   * By the time the user clicks, the page is already rendered.
   * Falls back gracefully in all other browsers (ignored).
   * moderate = starts after 200ms hover, so not wasteful.
   */
  if (!document.querySelector('script[type="speculationrules"]')) {
    const rules = document.createElement('script');
    rules.type = 'speculationrules';
    rules.textContent = JSON.stringify({
      prerender: [{
        where: { and: [
          { href_matches: '/*.html' },
          { not: { href_matches: '/sw.js' } },
          { not: { href_matches: '/pwa.js' } },
        ]},
        eagerness: 'moderate',
      }],
      prefetch: [{
        where: { href_matches: '/*.html' },
        eagerness: 'conservative',
      }],
    });
    document.head.appendChild(rules);
  }

  /* ── 8. STATUS BAR COLOR ─────────────────────────────── */
  const THEME_COLORS = { dark: '#0e0d1a', light: '#f4f2ff' };

  function syncStatusBar() {
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    const color = THEME_COLORS[theme] || THEME_COLORS.dark;
    let meta = document.querySelector('meta[name="theme-color"]');
    if (!meta) { meta = document.createElement('meta'); meta.name = 'theme-color'; document.head.appendChild(meta); }
    meta.content = color;
  }

  syncStatusBar();
  document.addEventListener('DOMContentLoaded', syncStatusBar);
  new MutationObserver(syncStatusBar).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ── 9. BACK GESTURE ─────────────────────────────────── */
  if (isInstalled() && window.history.length <= 1) {
    history.replaceState({ page: 'home', href: location.pathname }, '', location.href);
  }

  /* ── 10. STYLES ──────────────────────────────────────── */
  const pwaStyles = document.createElement('style');
  pwaStyles.textContent = `
    #kfl-install-toast {
      position: fixed;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 76px);
      left: 12px; right: 12px;
      background: var(--kfl-surface, #13112a);
      border: 1px solid var(--kfl-border, rgba(255,255,255,0.08));
      border-radius: 14px;
      padding: 13px 13px 13px 15px;
      display: flex; align-items: center; gap: 11px;
      z-index: 9999;
      box-shadow: 0 12px 48px rgba(0,0,0,0.55);
      transform: translateY(120%); opacity: 0;
      transition: transform 0.35s cubic-bezier(0.34,1.56,0.64,1), opacity 0.25s ease;
      max-width: 480px; margin: 0 auto;
    }
    @media (min-width: 768px) {
      #kfl-install-toast { left: auto; bottom: 24px; right: 24px; width: 320px; max-width: 320px; }
    }
    #kfl-install-toast.kfl-install-toast--visible { transform: translateY(0); opacity: 1; }
    .kfl-install-toast__icon {
      width: 38px; height: 38px; border-radius: 10px;
      background: var(--kfl-accent-dim, rgba(233,0,82,0.1));
      color: var(--kfl-accent, #e90052);
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .kfl-install-toast__icon .material-symbols-rounded {
      font-size: 18px;
      font-variation-settings: 'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24;
    }
    .kfl-install-toast__text { flex: 1; min-width: 0; }
    .kfl-install-toast__text strong { display: block; font-size: 13px; font-weight: 700; color: var(--kfl-text-1, #f0eeff); margin-bottom: 2px; }
    .kfl-install-toast__text span { font-size: 11.5px; color: var(--kfl-text-3, #5c5585); }
    .kfl-install-toast__btn {
      background: var(--kfl-accent, #e90052); color: #fff;
      border: none; border-radius: 8px; padding: 8px 14px;
      font-size: 12px; font-weight: 700; cursor: pointer; flex-shrink: 0;
      font-family: inherit; transition: opacity 0.15s;
    }
    .kfl-install-toast__btn:hover { opacity: 0.85; }
    .kfl-install-toast__close {
      background: none; border: none; color: var(--kfl-text-3, #5c5585);
      cursor: pointer; padding: 4px; display: flex; align-items: center;
      justify-content: center; flex-shrink: 0; border-radius: 6px; transition: color 0.15s;
    }
    .kfl-install-toast__close:hover { color: var(--kfl-text-1, #f0eeff); }
    .kfl-install-toast__close .material-symbols-rounded { font-size: 18px; }
    .toast { bottom: calc(76px + env(safe-area-inset-bottom, 0px)) !important; }
  `;
  document.head.appendChild(pwaStyles);

})();
