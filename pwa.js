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

   Performance monitoring:
   - All key moments are marked with performance.mark()
   - Measures are logged to console in dev, silent in prod
   - Access full report anytime: KopalaPerf.report()
   - Access in DevTools: Performance → Timings track
   ============================================================ */

(function () {
  'use strict';

  /* ── 0. PERFORMANCE MONITORING ───────────────────────── */
  /*
   * Marks every key moment in the app lifecycle.
   * In Chrome DevTools → Performance tab → record a trace —
   * you'll see all these as named markers on the Timings track.
   *
   * KopalaPerf.report() — logs a full summary to console
   * KopalaPerf.marks()  — returns raw PerformanceEntry list
   *
   * Marks fired automatically:
   *   kfl:script-start         — pwa.js begins executing
   *   kfl:sw-registered        — service worker registered
   *   kfl:sw-active            — service worker controlling page
   *   kfl:periodic-sync-ready  — periodic sync tags registered
   *   kfl:nav-prefetch:{href}  — hover prefetch started for a page
   *   kfl:nav-click:{href}     — user clicked a nav link
   *   kfl:nav-fetch-start      — fetch of new page HTML started
   *   kfl:nav-fetch-done       — fetch complete, HTML parsed
   *   kfl:nav-swap-start       — DOM swap begins
   *   kfl:nav-swap-done        — DOM swap complete, page visible
   *   kfl:nav-complete         — full navigation cycle done
   *   kfl:page-interactive     — DOMContentLoaded fired
   *   kfl:page-loaded          — window load fired
   *   kfl:install-prompt-shown — install toast appeared
   *   kfl:app-installed        — user accepted install prompt
   */

  const _perf = window.performance;

  function mark(name) {
    try { _perf.mark(name); } catch (_) {}
  }

  function measure(name, startMark, endMark) {
    try { _perf.measure(name, startMark, endMark); } catch (_) {}
  }

  /* Public performance API */
  window.KopalaPerf = {

    /* Print a formatted summary of all kfl: marks to console */
    report() {
      const entries = _perf.getEntriesByType('mark')
        .filter(e => e.name.startsWith('kfl:'))
        .sort((a, b) => a.startTime - b.startTime);

      if (!entries.length) {
        console.log('[KopalaPerf] No marks recorded yet.');
        return;
      }

      console.groupCollapsed('[KopalaPerf] Performance Report — ' + location.pathname);

      /* Core navigation timing from browser */
      const nav = _perf.getEntriesByType('navigation')[0];
      if (nav) {
        console.log('%c Core Timings', 'font-weight:bold;color:#04f5ff');
        console.log('  TTFB          ', Math.round(nav.responseStart)            + 'ms');
        console.log('  DOM ready     ', Math.round(nav.domContentLoadedEventEnd) + 'ms');
        console.log('  Page load     ', Math.round(nav.loadEventEnd)             + 'ms');
        console.log('  DOM size      ', document.querySelectorAll('*').length    + ' nodes');
        console.log('  Transfer size ', Math.round((nav.transferSize || 0) / 1024) + ' KB');
      }

      /* kfl: marks as a visual timeline */
      console.log('%c App Marks Timeline', 'font-weight:bold;color:#04f5ff');
      const first = entries[0].startTime;
      entries.forEach(e => {
        const t   = Math.round(e.startTime);
        const rel = Math.round(e.startTime - first);
        const bar = '█'.repeat(Math.min(Math.floor(rel / 20), 30));
        console.log(`  ${String(t).padStart(6)}ms  +${String(rel).padStart(5)}ms  ${bar || '·'}  ${e.name}`);
      });

      /* Measures (durations between marks) */
      const measures = _perf.getEntriesByType('measure').filter(e => e.name.startsWith('kfl:'));
      if (measures.length) {
        console.log('%c Durations', 'font-weight:bold;color:#04f5ff');
        measures.forEach(e => {
          const dur = Math.round(e.duration);
          const bar = dur > 200 ? ' ⚠️' : dur > 100 ? ' ⚡' : ' ✓';
          console.log(`  ${e.name.padEnd(35)} ${String(dur).padStart(5)}ms${bar}`);
        });
      }

      /* Prefetch cache */
      console.log('%c Prefetch Cache', 'font-weight:bold;color:#04f5ff');
      console.log('  Pages cached:', _prefetchCache.size);
      _prefetchCache.forEach((_, href) => console.log('    ✓', href));

      console.groupEnd();
    },

    /* Return raw mark entries */
    marks() {
      return _perf.getEntriesByType('mark').filter(e => e.name.startsWith('kfl:'));
    },

    /* Return a single mark's timestamp in ms */
    get(name) {
      const fullName = name.startsWith('kfl:') ? name : 'kfl:' + name;
      const entries  = _perf.getEntriesByName(fullName, 'mark');
      /* Return the LAST occurrence (useful for nav marks that repeat) */
      return entries.length ? Math.round(entries[entries.length - 1].startTime) : null;
    },

    /* How long between two marks in ms */
    between(startName, endName) {
      const s = this.get(startName);
      const e = this.get(endName);
      return (s !== null && e !== null) ? e - s : null;
    },
  };

  /* First mark — pwa.js is executing */
  mark('kfl:script-start');

  /* Mark DOMContentLoaded */
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mark('kfl:page-interactive'));
  } else {
    mark('kfl:page-interactive'); // already past it
  }

  /* Mark window load + auto-report on localhost */
  window.addEventListener('load', () => {
    mark('kfl:page-loaded');
    measure('kfl:time-to-interactive', 'kfl:script-start', 'kfl:page-interactive');
    measure('kfl:time-to-load',        'kfl:script-start', 'kfl:page-loaded');

    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      setTimeout(() => KopalaPerf.report(), 300);
    }
  });

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
          mark('kfl:sw-registered');
          await waitForActive(reg);
          mark('kfl:sw-active');
          measure('kfl:sw-activation-time', 'kfl:sw-registered', 'kfl:sw-active');
          registerPeriodicSync(reg);
        })
        .catch(err => console.warn('[SW] Registration failed:', err));

      navigator.serviceWorker.addEventListener('message', event => {
        const { type, ts } = event.data || {};

        if (type === 'BOOTSTRAP_UPDATED') {
          mark('kfl:bootstrap-cache-updated');
          console.log('[PWA] Fresh bootstrap-static in cache', ts ? new Date(ts).toLocaleTimeString() : '');
          window.dispatchEvent(new CustomEvent('kopala:bootstrap-updated', { detail: { ts } }));
        }

        if (type === 'RUN_PRICE_CHECK') {
          mark('kfl:price-check-triggered');
          console.log('[PWA] SW requested price check');
          window.dispatchEvent(new CustomEvent('kopala:run-price-check', { detail: { ts } }));
        }

        if (type === 'DEADLINE_APPROACHING') {
          mark('kfl:deadline-approaching');
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
      mark('kfl:periodic-sync-ready');
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
    mark('kfl:app-installed');
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
    mark('kfl:install-prompt-shown');
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
  const _prefetchCache = new Map();
  const _prefetched    = new Set();
  let   _navigating    = false;

  function isSameAppLink(link) {
    const href = link.getAttribute('href');
    if (!href) return false;
    if (href.startsWith('http') || href.startsWith('//')) return false;
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
    if (link.target === '_blank') return false;
    const target = new URL(href, location.href).pathname;
    if (target === location.pathname) return false;
    return true;
  }

  function prefetchPage(href) {
    if (_prefetchCache.has(href)) return _prefetchCache.get(href);
    const p = fetch(href, { credentials: 'same-origin' })
      .then(res => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(html => new DOMParser().parseFromString(html, 'text/html'))
      .catch(err => {
        _prefetchCache.delete(href);
        throw err;
      });
    _prefetchCache.set(href, p);
    return p;
  }

  function swapMain(newMain) {
    return new Promise(resolve => {
      const old = document.querySelector('main');
      if (!old) { resolve(); return; }

      // Instant swap — no fade-out dead time. Fade IN only (80ms).
      Array.from(newMain.attributes).forEach(attr => {
        old.setAttribute(attr.name, attr.value);
      });
      old.innerHTML = newMain.innerHTML;

      old.style.opacity    = '0';
      old.style.transition = 'opacity 0.08s ease';
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          old.style.opacity = '1';
          setTimeout(() => {
            old.style.transition = '';
            old.style.opacity    = '';
            resolve();
          }, 80);
        });
      });
    });
  }

  function rerunScripts(container) {
    container.querySelectorAll('script').forEach(oldScript => {
      if (oldScript.src) return;
      const s = document.createElement('script');
      if (oldScript.type) s.type = oldScript.type;
      s.textContent = oldScript.textContent;
      oldScript.replaceWith(s);
    });
  }

  function scrollAfterSwap(href) {
    const hash = new URL(href, location.href).hash;
    if (hash) {
      const el = document.querySelector(hash);
      if (el) { el.scrollIntoView({ behavior: 'smooth' }); return; }
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  async function navigateTo(href, pushState = true) {
    if (_navigating) return;
    _navigating = true;

    mark('kfl:nav-click:' + href);

    try {
      mark('kfl:nav-fetch-start');
      const doc = await prefetchPage(href);
      mark('kfl:nav-fetch-done');
      measure('kfl:nav-fetch-duration', 'kfl:nav-fetch-start', 'kfl:nav-fetch-done');

      const newMain = doc.querySelector('main');
      if (!newMain || !document.querySelector('main')) {
        window.location.href = href;
        return;
      }

      const newTitle = doc.querySelector('title');
      if (newTitle) document.title = newTitle.textContent;

      updateNavActive(href);

      mark('kfl:nav-swap-start');
      await swapMain(newMain);
      mark('kfl:nav-swap-done');
      measure('kfl:nav-swap-duration', 'kfl:nav-swap-start', 'kfl:nav-swap-done');

      rerunScripts(document.querySelector('main'));
      scrollAfterSwap(href);

      if (pushState) history.pushState({ href }, document.title, href);

      mark('kfl:nav-complete');
      measure('kfl:nav-total-duration', 'kfl:nav-click:' + href, 'kfl:nav-complete');

      /* Dev-only timing log */
      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        const fetchMs = KopalaPerf.between('nav-fetch-start', 'nav-fetch-done');
        const swapMs  = KopalaPerf.between('nav-swap-start',  'nav-swap-done');
        const totalMs = KopalaPerf.between('nav-click:' + href, 'nav-complete');
        console.log(`[PWA] ${href} — fetch: ${fetchMs}ms  swap: ${swapMs}ms  total: ${totalMs}ms`);
      }

      window.dispatchEvent(new CustomEvent('kopala:page-changed', {
        detail: { href, title: document.title }
      }));

    } catch (err) {
      console.warn('[PWA] Swap failed, falling back:', err.message);
      window.location.href = href;
    } finally {
      _navigating = false;
    }
  }

  function updateNavActive(href) {
    const path = new URL(href, location.href).pathname;

    document.querySelectorAll('.kfl-tab').forEach(tab => {
      const tabHref = tab.getAttribute('href') || tab.dataset.href || '';
      const tabPath = tabHref ? new URL(tabHref, location.href).pathname : '';
      tab.classList.toggle('kfl-tab--active', tabPath === path);
      tab.setAttribute('aria-current', tabPath === path ? 'page' : 'false');
    });

    const pageNameEl = document.querySelector('.kfl-topbar__page-name');
    if (pageNameEl) {
      const h1 = document.querySelector('main h1');
      pageNameEl.textContent = h1 ? h1.textContent.trim() : document.title;
    }
  }

  /* Hover prefetch */
  document.addEventListener('mouseover', e => {
    const link = e.target.closest('a[href]');
    if (!link || !isSameAppLink(link)) return;
    const href = link.getAttribute('href');
    if (_prefetched.has(href)) return;
    _prefetched.add(href);
    mark('kfl:nav-prefetch:' + href);
    prefetchPage(href).catch(() => {});
  });

  /* Touch prefetch */
  document.addEventListener('touchstart', e => {
    const link = e.target.closest('a[href]');
    if (!link || !isSameAppLink(link)) return;
    const href = link.getAttribute('href');
    if (_prefetched.has(href)) return;
    _prefetched.add(href);
    mark('kfl:nav-prefetch:' + href);
    prefetchPage(href).catch(() => {});
  }, { passive: true });

  /* Click handler */
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href]');
    if (!link || !isSameAppLink(link)) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    navigateTo(link.getAttribute('href'));
  });

  /* Back / forward */
  window.addEventListener('popstate', e => {
    const href = e.state?.href || location.pathname;
    navigateTo(href, false);
  });

  /* ── 7. SPECULATION RULES ────────────────────────────── */
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
