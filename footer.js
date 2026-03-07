/**
 * footer.js — Kopala FPL Footer
 * Inspired by livefpl.net / fpl.team aesthetic.
 * Supports dark and light themes via [data-theme] attribute.
 */
(function () {
  'use strict';

  const year = new Date().getFullYear();

  const footerHTML = `
    <footer class="kfl-footer">
      <div class="kfl-footer__inner">

        <!-- Brand + tagline -->
        <div class="kfl-footer__brand">
          <div class="kfl-footer__logo">
            <img src="/logo.png" alt="Kopala FPL" class="kfl-footer__logo-img" onerror="this.style.display='none'">
            <span class="kfl-footer__logo-text">Kopala <strong>FPL</strong></span>
          </div>
          <p class="kfl-footer__tagline">Tabesha tata&nbsp;😎 — Zambia's FPL companion</p>
        </div>

        <!-- Divider -->
        <div class="kfl-footer__divider"></div>

        <!-- Links row -->
        <nav class="kfl-footer__nav" aria-label="Footer navigation">
          <a href="/index.html"      class="kfl-footer__link">Home</a>
          <a href="/leagues.html"    class="kfl-footer__link">Leagues</a>
          <a href="/prices.html"     class="kfl-footer__link">Prices</a>
          <a href="/transfers.html"  class="kfl-footer__link">Transfers</a>
          <a href="/prizes.html"     class="kfl-footer__link">Prizes</a>
          <a href="https://wa.me/260964836842" target="_blank" rel="noopener" class="kfl-footer__link kfl-footer__link--whatsapp">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/><path d="M12 0C5.373 0 0 5.373 0 12c0 2.126.556 4.117 1.528 5.849L.057 23.998l6.304-1.654A11.94 11.94 0 0012 24c6.627 0 12-5.373 12-12S18.627 0 12 0zm0 21.818a9.802 9.802 0 01-5.031-1.384l-.361-.214-3.741.981.998-3.648-.235-.374A9.791 9.791 0 012.182 12C2.182 6.57 6.57 2.182 12 2.182S21.818 6.57 21.818 12 17.43 21.818 12 21.818z"/></svg>
            Help
          </a>
        </nav>

        <!-- Divider -->
        <div class="kfl-footer__divider"></div>

        <!-- Bottom row -->
        <div class="kfl-footer__bottom">
          <span class="kfl-footer__copy">&copy; ${year} Kopala FPL</span>
          <span class="kfl-footer__dot" aria-hidden="true">·</span>
          <span class="kfl-footer__disclaimer">Not affiliated with the Premier League or Fantasy Premier League.</span>
          <span class="kfl-footer__dot" aria-hidden="true">·</span>
          <a href="https://fantasy.premierleague.com" target="_blank" rel="noopener" class="kfl-footer__fpl-badge">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            Data from FPL
          </a>
        </div>

      </div>
    </footer>
  `;

  const footerCSS = `
    /* ── Kopala FPL Footer ──────────────────────────────── */
    .kfl-footer {
      width: 100%;
      margin-top: 48px;
      border-top: 1px solid var(--kfl-footer-border, rgba(4, 245, 255, 0.08));
      background: var(--kfl-footer-bg, #0e0916);
      font-family: 'DM Sans', 'Inter', system-ui, sans-serif;
    }

    .kfl-footer__inner {
      max-width: 1100px;
      margin: 0 auto;
      padding: 32px 20px 28px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 20px;
    }

    /* Brand */
    .kfl-footer__brand {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 8px;
    }

    .kfl-footer__logo {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .kfl-footer__logo-img {
      width: 26px;
      height: 26px;
      border-radius: 6px;
      object-fit: contain;
    }

    .kfl-footer__logo-text {
      font-family: 'Barlow Condensed', 'Inter', sans-serif;
      font-size: 1.15rem;
      font-weight: 400;
      letter-spacing: 0.5px;
      color: var(--kfl-footer-text-muted, rgba(255,255,255,0.4));
      text-transform: uppercase;
    }

    .kfl-footer__logo-text strong {
      font-weight: 900;
      color: var(--kfl-footer-accent, #04f5ff);
    }

    .kfl-footer__tagline {
      margin: 0;
      font-size: 0.72rem;
      color: var(--kfl-footer-text-dim, rgba(255,255,255,0.25));
      letter-spacing: 0.3px;
    }

    /* Divider */
    .kfl-footer__divider {
      width: 100%;
      height: 1px;
      background: var(--kfl-footer-border, rgba(4,245,255,0.08));
    }

    /* Nav links */
    .kfl-footer__nav {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 4px 6px;
    }

    .kfl-footer__link {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 5px 10px;
      border-radius: 6px;
      font-size: 0.73rem;
      font-weight: 500;
      color: var(--kfl-footer-link, rgba(255,255,255,0.45));
      text-decoration: none;
      letter-spacing: 0.2px;
      transition: color 0.15s, background 0.15s;
    }

    .kfl-footer__link:hover {
      color: var(--kfl-footer-link-hover, rgba(255,255,255,0.9));
      background: var(--kfl-footer-link-hover-bg, rgba(255,255,255,0.05));
    }

    .kfl-footer__link--whatsapp:hover {
      color: #25d366;
      background: rgba(37, 211, 102, 0.08);
    }

    /* Bottom row */
    .kfl-footer__bottom {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: center;
      gap: 6px 10px;
      font-size: 0.68rem;
      color: var(--kfl-footer-text-dim, rgba(255,255,255,0.22));
      text-align: center;
      line-height: 1.6;
    }

    .kfl-footer__copy {
      font-weight: 600;
      color: var(--kfl-footer-text-muted, rgba(255,255,255,0.35));
    }

    .kfl-footer__dot {
      opacity: 0.3;
    }

    .kfl-footer__disclaimer {
      color: var(--kfl-footer-text-dim, rgba(255,255,255,0.22));
    }

    .kfl-footer__fpl-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      color: var(--kfl-footer-accent, #04f5ff);
      opacity: 0.5;
      text-decoration: none;
      font-weight: 600;
      font-size: 0.66rem;
      transition: opacity 0.15s;
    }

    .kfl-footer__fpl-badge:hover {
      opacity: 0.85;
    }

    /* ── Light theme ───────────────────────────────────── */
    [data-theme="light"] .kfl-footer {
      --kfl-footer-bg:              #f5f4f9;
      --kfl-footer-border:          rgba(56, 0, 60, 0.08);
      --kfl-footer-text-muted:      rgba(56, 0, 60, 0.45);
      --kfl-footer-text-dim:        rgba(56, 0, 60, 0.28);
      --kfl-footer-link:            rgba(56, 0, 60, 0.45);
      --kfl-footer-link-hover:      rgba(56, 0, 60, 0.85);
      --kfl-footer-link-hover-bg:   rgba(56, 0, 60, 0.05);
      --kfl-footer-accent:          #e90052;
    }

    [data-theme="light"] .kfl-footer__logo-text {
      color: rgba(56, 0, 60, 0.4);
    }

    /* ── Mobile ────────────────────────────────────────── */
    @media (max-width: 480px) {
      .kfl-footer__inner {
        padding: 28px 16px 24px;
        gap: 16px;
      }
      .kfl-footer__bottom {
        flex-direction: column;
        gap: 4px;
      }
      .kfl-footer__dot {
        display: none;
      }
    }

    /* ── Desktop ───────────────────────────────────────── */
    @media (min-width: 768px) {
      .kfl-footer__inner {
        padding: 36px 32px 30px;
      }
      .kfl-footer__nav {
        gap: 4px 4px;
      }
      .kfl-footer__link {
        font-size: 0.75rem;
        padding: 5px 12px;
      }
    }
  `;

  function injectStyles() {
    if (document.getElementById('kfl-footer-styles')) return;
    const style = document.createElement('style');
    style.id = 'kfl-footer-styles';
    style.textContent = footerCSS;
    document.head.appendChild(style);
  }

  function injectFooter() {
    injectStyles();
    const placeholder = document.getElementById('footer-placeholder');
    if (placeholder) {
      placeholder.innerHTML = footerHTML;
    }
  }

  if (document.readyState === 'complete') {
    'requestIdleCallback' in window
      ? requestIdleCallback(injectFooter)
      : setTimeout(injectFooter, 0);
  } else {
    window.addEventListener('load', () => {
      'requestIdleCallback' in window
        ? requestIdleCallback(injectFooter)
        : setTimeout(injectFooter, 0);
    });
  }
})();
