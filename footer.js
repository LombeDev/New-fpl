/**
 * footer.js — Kopala FPL Footer
 */
(function () {
  'use strict';

  const year = new Date().getFullYear();

  const footerHTML = `
    <footer class="main-footer">
      <div class="footer-top-bar">
        <div class="footer-nav-container">
      
          <a href="prizes.html">Prizes</a>
          <a href="https://wa.me/260964836842" target="_blank" rel="noopener">Help</a>
        </div>
      </div>
      <div class="footer-main-content">
        <div class="footer-network-brand">
          <div class="network-label">Kopala FPL</div>
          <div class="network-title">Tabesha tata&nbsp;😎</div>
        </div>
        <div class="footer-bottom">
          &copy; ${year} Kopala FPL. All rights reserved.
          <div class="footer-disclaimer">
            Not officially affiliated with the Premier League or Fantasy Premier League.
          </div>
        </div>
      </div>
    </footer>
  `;

  function injectFooter() {
    const placeholder = document.getElementById('footer-placeholder');
    if (placeholder) {
      placeholder.innerHTML = footerHTML;
    }
  }

  // Use idle callback to not block main thread, fall back to load event
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
