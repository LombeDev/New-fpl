/**
 * footer.js - Universal Footer Component (Idle Lazy Load)
 */

const footerTemplate = `
<footer class="main-footer">
    <div class="footer-network-brand">
        <div class="network-label">KOPALA FPL</div>
    </div>

    <div class="footer-links-grid">
        <div class="footer-column">
            <h4>Live Tools</h4>
            <a href="index.html">Live Rank</a>
            <a href="leagues.html">Live Leagues</a>
            <a href="games.html">Games</a>
        </div>
        <div class="footer-column">
            <h4>Price Changes</h4>
            <a href="prices.html">Price Change Predictor</a>
        </div>
        <div class="footer-column">
            <h4>Statistics</h4>
            <a href="10k.html">You vs Top 10k</a>
        </div>
        <div class="footer-column">
            <h4>Support</h4>
            <a href="https://wa.me/260964836842" target="_blank">Support</a>
        </div>
        <div class="footer-column">
            <h4>Socials</h4>
            <a href="https://twitter.com" target="_blank">Twitter</a>
        </div>
    </div>

    <div class="footer-bottom">
        &copy; ${new Date().getFullYear()} Kopala FPL. This app is not officially affiliated with Premier League or Fantasy Premier League. ⚽
    </div>
</footer>
`;

function injectFooter() {
    const placeholder = document.getElementById('footer-placeholder');
    if (placeholder) {
        placeholder.innerHTML = footerTemplate;
        console.log("Footer Lazy Loaded via Idle Callback");
    }
}

// True Lazy Loading: Wait until the browser is not busy
window.addEventListener('load', () => {
    if ('requestIdleCallback' in window) {
        // Modern browsers: wait for idle time
        requestIdleCallback(injectFooter);
    } else {
        // Fallback for older browsers: wait 2 seconds after load
        setTimeout(injectFooter, 2000);
    }
});
