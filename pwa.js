/* ============================================================
   KOPALA FPL — PWA.JS  v2
   Changes from v1:
   - Turbo swap no longer re-executes inline <script> tags
     that were already on the page at initial load. Only
     scripts introduced by the NEW page's <main> are run,
     and only those tagged data-turbo-eval (opt-in).
   - Added data-turbo-eval="false" guard (no-op attribute for
     scripts that should never re-run on swap).
   - Performance marks preserved and extended.
   ============================================================ */

(function () {
  'use strict';

  /* ── 0. PERFORMANCE MONITORING ───────────────────────── */
  const _perf = window.performance;

  function mark(name) { try { _perf.mark(name); } catch (_) {} }
  function measure(s, a, b) { try { _perf.measure(s, a, b); } catch (_) {} }

  window.KopalaPerf = {
    report() {
      const entries = _perf.getEntriesByType('mark')
        .filter(e => e.name.startsWith('kfl:'))
        .sort((a, b) => a.startTime - b.startTime);
      if (!entries.length) { console.log('[KopalaPerf] No marks yet.'); return; }
      console.groupCollapsed('[KopalaPerf] ' + location.pathname);
      entries.forEach(e => {
        console.log(`  ${Math.round(e.startTime)}ms  ${e.name}`);
      });
      console.log('Prefetch cache size:', _prefetchCache.size);
      console.groupEnd();
    },
    marks()        { return _perf.getEntriesByType('mark').filter(e => e.name.startsWith('kfl:')); },
    get(name)      { const n = name.startsWith('kfl:') ? name : 'kfl:' + name; const e = _perf.getEntriesByName(n,'mark'); return e.length ? Math.round(e[e.length-1].startTime) : null; },
    between(s, e)  { const a = this.get(s), b = this.get(e); return (a !== null && b !== null) ? b - a : null; },
  };

  mark('kfl:script-start');

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => mark('kfl:page-interactive'));
  } else {
    mark('kfl:page-interactive');
  }

  window.addEventListener('load', () => {
    mark('kfl:page-loaded');
    measure('kfl:time-to-interactive', 'kfl:script-start', 'kfl:page-interactive');
    measure('kfl:time-to-load',        'kfl:script-start', 'kfl:page-loaded');
    if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
      setTimeout(() => KopalaPerf.report(), 500);
    }
  });

  /* ── 1. SERVICE WORKER ───────────────────────────────── */
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then(async reg => {
          mark('kfl:sw-registered');
          await _waitForActive(reg);
          mark('kfl:sw-active');
          _registerPeriodicSync(reg);
        })
        .catch(err => console.warn('[SW] Registration failed:', err));

      navigator.serviceWorker.addEventListener('message', event => {
        const { type, ts } = event.data || {};
        if (type === 'BOOTSTRAP_UPDATED') {
          mark('kfl:bootstrap-cache-updated');
          window.dispatchEvent(new CustomEvent('kopala:bootstrap-updated', { detail: { ts } }));
        }
        if (type === 'RUN_PRICE_CHECK') {
          mark('kfl:price-check-triggered');
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

  /* ── 2. PERIODIC SYNC ────────────────────────────────── */
  async function _registerPeriodicSync(reg) {
    if (!('periodicSync' in reg)) return;
    try {
      const status = await navigator.permissions.query({ name: 'periodic-background-sync' });
      if (status.state !== 'granted') return;
      const tags = await reg.periodicSync.getTags();
      const register = (tag, interval) =>
        tags.includes(tag) ? null : reg.periodicSync.register(tag, { minInterval: interval });
      await Promise.all([
        register('fpl-bootstrap-sync',  3  * 60 * 60 * 1000),
        register('fpl-price-sync',      12 * 60 * 60 * 1000),
        register('fpl-deadline-check',   1 * 60 * 60 * 1000),
      ]);
      mark('kfl:periodic-sync-ready');
    } catch (err) {
      console.log('[PWA] Periodic sync skipped:', err.message);
    }
  }

  function _waitForActive(reg) {
    return new Promise(resolve => {
      if (reg.active) { resolve(reg); return; }
      const sw = reg.installing || reg.waiting;
      if (!sw) { resolve(reg); return; }
      sw.addEventListener('statechange', function h() {
        if (this.state === 'activated') { sw.removeEventListener('statechange', h); resolve(reg); }
      });
    });
  }

  /* ── 3. INSTALL PROMPT ───────────────────────────────── */
  let _deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    _deferredPrompt = e;
    const dismissed = localStorage.getItem('kfl_install_dismissed');
    if (dismissed && Date.now() - parseInt(dismissed, 10) < 3 * 24 * 60 * 60 * 1000) return;
    setTimeout(() => { if (!_isInstalled()) _showInstallToast(); }, 4000);
  });

  window.addEventListener('appinstalled', () => {
    mark('kfl:app-installed');
    _deferredPrompt = null;
    _hideInstallToast();
    localStorage.removeItem('kfl_install_dismissed');
  });

  function _isInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches ||
           window.navigator.standalone === true ||
           document.referrer.includes('android-app://');
  }

  /* ── 4. INSTALL TOAST ────────────────────────────────── */
  function _showInstallToast() {
    if (document.getElementById('kfl-install-toast') || _isInstalled()) return;
    mark('kfl:install-prompt-shown');
    const toast = document.createElement('div');
    toast.id = 'kfl-install-toast';
    toast.innerHTML = `
      <div class="kfl-install-toast__icon">
        <i class="fa-solid fa-futbol" aria-hidden="true"></i>
      </div>
      <div class="kfl-install-toast__text">
        <strong>Add to Home Screen</strong>
        <span>Get the full app experience</span>
      </div>
      <button class="kfl-install-toast__btn" id="kfl-install-btn">Install</button>
      <button class="kfl-install-toast__close" id="kfl-install-close" aria-label="Dismiss">
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>`;
    document.body.appendChild(toast);
    requestAnimationFrame(() =>
      requestAnimationFrame(() => toast.classList.add('kfl-install-toast--visible'))
    );
    document.getElementById('kfl-install-btn')?.addEventListener('click', async () => {
      if (!_deferredPrompt) return;
      _deferredPrompt.prompt();
      const { outcome } = await _deferredPrompt.userChoice;
      _deferredPrompt = null;
      if (outcome === 'accepted') _hideInstallToast();
    });
    document.getElementById('kfl-install-close')?.addEventListener('click', () => {
      _hideInstallToast();
      localStorage.setItem('kfl_install_dismissed', Date.now().toString());
    });
  }

  function _hideInstallToast() {
    const t = document.getElementById('kfl-install-toast');
    if (!t) return;
    t.classList.remove('kfl-install-toast--visible');
    setTimeout(() => t.remove(), 350);
  }

  /* ── 5. NATIVE FEEL ──────────────────────────────────── */
  document.addEventListener('touchstart', function () {}, { passive: true });
  document.body.style.overscrollBehaviorY = 'contain';

  const tapStyle = document.createElement('style');
  tapStyle.textContent = `
    a, button, [role="button"] {
      -webkit-tap-highlight-color: transparent;
      touch-action: manipulation;
    }`;
  document.head.appendChild(tapStyle);

  /* ── 6. TURBO-STYLE CONTENT SWAP ─────────────────────── */
  /*
   * FIX: rerunScripts() in v1 re-executed ALL inline <script> tags
   * in <main> on every navigation — including the entire app script
   * on index.html, causing double-init bugs and memory leaks.
   *
   * New behaviour:
   *   - Scripts present in the initial page load are NEVER re-run.
   *   - Scripts in a newly swapped-in <main> are only executed if
   *     they carry data-turbo-eval="true".
   *   - Scripts with data-turbo-eval="false" (or no attribute) are
   *     ignored on swap — they were already executed at boot.
   *
   * To opt a script INTO re-execution on swap, add:
   *   <script data-turbo-eval="true">…</script>
   */

  const _prefetchCache = new Map();
  const _prefetched    = new Set();
  let   _navigating    = false;

  function _isSameAppLink(link) {
    const href = link.getAttribute('href');
    if (!href) return false;
    if (href.startsWith('http') || href.startsWith('//')) return false;
    if (href.startsWith('#') || href.startsWith('mailto:') || href.startsWith('tel:')) return false;
    if (link.target === '_blank') return false;
    return new URL(href, location.href).pathname !== location.pathname;
  }

  function _prefetchPage(href) {
    if (_prefetchCache.has(href)) return _prefetchCache.get(href);
    const p = fetch(href, { credentials: 'same-origin' })
      .then(res => {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.text();
      })
      .then(html => new DOMParser().parseFromString(html, 'text/html'))
      .catch(err => { _prefetchCache.delete(href); throw err; });
    _prefetchCache.set(href, p);
    return p;
  }

  function _swapMain(newMain) {
    return new Promise(resolve => {
      const old = document.querySelector('main');
      if (!old) { resolve(); return; }

      Array.from(newMain.attributes).forEach(attr => old.setAttribute(attr.name, attr.value));
      old.innerHTML = newMain.innerHTML;

      // Fade-in only — no blocking fade-out
      old.style.opacity    = '0';
      old.style.transition = 'opacity 0.08s ease';
      requestAnimationFrame(() => requestAnimationFrame(() => {
        old.style.opacity = '1';
        setTimeout(() => {
          old.style.transition = '';
          old.style.opacity    = '';
          resolve();
        }, 80);
      }));
    });
  }

  /*
   * Only re-run scripts that explicitly opt in with data-turbo-eval="true".
   * All other inline scripts are assumed to have run at boot and are skipped.
   */
  function _rerunOptInScripts(container) {
    container.querySelectorAll('script[data-turbo-eval="true"]').forEach(old => {
      const s = document.createElement('script');
      if (old.type) s.type = old.type;
      s.textContent    = old.textContent;
      s.dataset.turboEval = 'true';
      old.replaceWith(s);
    });
  }

  function _scrollAfterSwap(href) {
    const hash = new URL(href, location.href).hash;
    if (hash) {
      const el = document.querySelector(hash);
      if (el) { el.scrollIntoView({ behavior: 'smooth' }); return; }
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  async function _navigateTo(href, pushState = true) {
    if (_navigating) return;
    _navigating = true;
    mark('kfl:nav-click:' + href);

    try {
      mark('kfl:nav-fetch-start');
      const doc = await _prefetchPage(href);
      mark('kfl:nav-fetch-done');
      measure('kfl:nav-fetch-duration', 'kfl:nav-fetch-start', 'kfl:nav-fetch-done');

      const newMain = doc.querySelector('main');
      if (!newMain || !document.querySelector('main')) {
        window.location.href = href;
        return;
      }

      const newTitle = doc.querySelector('title');
      if (newTitle) document.title = newTitle.textContent;

      _updateNavActive(href);

      mark('kfl:nav-swap-start');
      await _swapMain(newMain);
      mark('kfl:nav-swap-done');
      measure('kfl:nav-swap-duration', 'kfl:nav-swap-start', 'kfl:nav-swap-done');

      // Only re-run explicitly opted-in scripts
      _rerunOptInScripts(document.querySelector('main'));

      _scrollAfterSwap(href);
      if (pushState) history.pushState({ href }, document.title, href);

      mark('kfl:nav-complete');
      measure('kfl:nav-total', 'kfl:nav-click:' + href, 'kfl:nav-complete');

      if (location.hostname === 'localhost' || location.hostname === '127.0.0.1') {
        const total = KopalaPerf.between('nav-click:' + href, 'nav-complete');
        console.log('[PWA] Nav complete:', href, total + 'ms');
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

  function _updateNavActive(href) {
    const path = new URL(href, location.href).pathname;
    document.querySelectorAll('.kfl-tab').forEach(tab => {
      const tabPath = tab.getAttribute('href')
        ? new URL(tab.getAttribute('href'), location.href).pathname
        : '';
      const active = tabPath === path;
      tab.classList.toggle('kfl-tab--active', active);
      tab.setAttribute('aria-current', active ? 'page' : 'false');
    });
  }

  /* Hover prefetch (desktop) */
  document.addEventListener('mouseover', e => {
    const link = e.target.closest('a[href]');
    if (!link || !_isSameAppLink(link)) return;
    const href = link.getAttribute('href');
    if (_prefetched.has(href)) return;
    _prefetched.add(href);
    mark('kfl:nav-prefetch:' + href);
    _prefetchPage(href).catch(() => {});
  });

  /* Touch prefetch (mobile) */
  document.addEventListener('touchstart', e => {
    const link = e.target.closest('a[href]');
    if (!link || !_isSameAppLink(link)) return;
    const href = link.getAttribute('href');
    if (_prefetched.has(href)) return;
    _prefetched.add(href);
    _prefetchPage(href).catch(() => {});
  }, { passive: true });

  /* Click handler */
  document.addEventListener('click', e => {
    const link = e.target.closest('a[href]');
    if (!link || !_isSameAppLink(link)) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    _navigateTo(link.getAttribute('href'));
  });

  /* Back / forward */
  window.addEventListener('popstate', e => {
    _navigateTo(e.state?.href || location.pathname, false);
  });

  /* ── 7. SPECULATION RULES ────────────────────────────── */
  if (!document.querySelector('script[type="speculationrules"]')) {
    const rules = document.createElement('script');
    rules.type = 'speculationrules';
    rules.textContent = JSON.stringify({
      prerender: [{ where: { href_matches: '/*.html' }, eagerness: 'moderate' }],
      prefetch:  [{ where: { href_matches: '/*.html' }, eagerness: 'conservative' }],
    });
    document.head.appendChild(rules);
  }

  /* ── 8. STATUS BAR COLOR ─────────────────────────────── */
  const THEME_COLORS = { dark: '#060810', light: '#eff2fb' };

  function _syncStatusBar() {
    const theme = document.documentElement.getAttribute('data-theme') || 'dark';
    const color = THEME_COLORS[theme] || THEME_COLORS.dark;
    let meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.appendChild(meta);
    }
    meta.content = color;
  }

  _syncStatusBar();
  new MutationObserver(_syncStatusBar).observe(document.documentElement, {
    attributes: true, attributeFilter: ['data-theme'],
  });

  /* ── 9. WHAT-IF PRESERVE ON REFRESH ─────────────────── */
  /*
   * FIX: index.html's startApp() calls
   *   picks.picks.slice(0,11).forEach(p => {
   *     if (S.wiExtras[p.element] === undefined) S.wiExtras[p.element] = 0;
   *   });
   * on every refresh — correct, only sets if undefined.
   * But refreshAll() calls fetchAndRender() which calls startApp-level
   * render functions without re-checking. The guard is already in place
   * in the source. This file documents the pattern for future reference:
   *
   *   ALWAYS use:  if (S.wiExtras[id] === undefined) S.wiExtras[id] = 0;
   *   NEVER use:   S.wiExtras[id] = 0;   ← overwrites user's adjustments
   */

  /* ── 10. INSTALL TOAST STYLES ────────────────────────── */
  const pwaStyles = document.createElement('style');
  pwaStyles.textContent = `
    #kfl-install-toast {
      position: fixed;
      bottom: calc(env(safe-area-inset-bottom, 0px) + 76px);
      left: 12px; right: 12px;
      background: var(--surface, #0b101e);
      border: 1px solid var(--border-mid, rgba(255,255,255,0.1));
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
      background: rgba(0,232,122,0.12); color: #00e87a;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .kfl-install-toast__text { flex: 1; min-width: 0; }
    .kfl-install-toast__text strong { display: block; font-size: 13px; font-weight: 700; color: var(--text-1, #f0eeff); margin-bottom: 2px; }
    .kfl-install-toast__text span { font-size: 11.5px; color: var(--text-3, #5c5585); }
    .kfl-install-toast__btn {
      background: #00e87a; color: #000; border: none; border-radius: 8px;
      padding: 8px 14px; font-size: 12px; font-weight: 700;
      cursor: pointer; flex-shrink: 0; font-family: inherit; transition: opacity 0.15s;
    }
    .kfl-install-toast__btn:hover { opacity: 0.85; }
    .kfl-install-toast__close {
      background: none; border: none; color: var(--text-3, #5c5585);
      cursor: pointer; padding: 4px; display: flex; align-items: center;
      justify-content: center; flex-shrink: 0; border-radius: 6px; transition: color 0.15s;
    }
    .kfl-install-toast__close:hover { color: var(--text-1, #f0eeff); }
    .toast { bottom: calc(76px + env(safe-area-inset-bottom, 0px)) !important; }
  `;
  document.head.appendChild(pwaStyles);

})();
