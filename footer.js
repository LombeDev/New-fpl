/**
 * footer.js - Universal Footer with Full-Width Green Bar
 */

const footerTemplate = `
<footer class="main-footer">
    <div class="footer-top-bar">
        <div class="footer-nav-container">
            <a href="index.html">LIVE RANK</a>
            <a href="leagues.html">LIVE LEAGUES</a>
            <a href="games.html">GAMES</a>
            <a href="prices.html">PRICE CHANGES</a>
            <a href="10k.html">YOU VS TOP 10K</a>
            <a href="https://wa.me/260964836842" target="_blank">SUPPORT</a>
            <a href="https://twitter.com" target="_blank">TWITTER</a>
        </div>
    </div>

    <div class="footer-main-content">
        <div class="footer-network-brand">
            <div class="network-label">KOPALA FPL</div>
            <div class="network-title">Tabesha tata😎</div>
        </div>

        <div class="footer-bottom">
            &copy; Copyright Kopala FPL ${new Date().getFullYear()}. All rights reserved.
            <br>
            <small style="opacity: 0.6; font-size: 0.6rem; margin-top: 10px; display: block;">
                This app is not officially affiliated with Premier League or Fantasy Premier League.
            </small>
        </div>
    </div>
</footer>
`;

function injectFooter() {
    const placeholder = document.getElementById('footer-placeholder');
    if (placeholder) {
        placeholder.innerHTML = footerTemplate;
    }
}

// Lazy Load: Injects when the browser has finished main tasks
window.addEventListener('load', () => {
    if ('requestIdleCallback' in window) {
        requestIdleCallback(injectFooter);
    } else {
        setTimeout(injectFooter, 1500);
    }
});
