/**
 * footer.js - Universal Footer Component
 */

const footerTemplate = `
<footer class="main-footer">
    <div class="footer-network-brand">
        <div class="network-label">FANTASY FOOTBALL SCOUT</div>
        <div class="network-title">NETWORK</div>
    </div>

    <div class="footer-links-grid">
        <div class="footer-column">
            <h4>Live Tools</h4>
            <a href="rank.html">Live Rank</a>
            <a href="leagues.html">Live Leagues</a>
        </div>
        <div class="footer-column">
            <h4>Price Changes</h4>
            <a href="predictor.html">Predictor</a>
            <a href="prices.html">Actual Changes</a>
        </div>
        <div class="footer-column">
            <h4>Statistics</h4>
            <a href="#">Effective Ownerships</a>
            <a href="#">Chip Usage</a>
        </div>
        <div class="footer-column">
            <h4>Planning</h4>
            <a href="#">Transfer Planner</a>
            <a href="#">Season Ticker</a>
        </div>
        <div class="footer-column">
            <h4>Legal</h4>
            <a href="#">Privacy Policy</a>
        </div>
        <div class="footer-column">
            <h4>Socials</h4>
            <a href="https://twitter.com" target="_blank">Twitter</a>
        </div>
    </div>
    
    <div class="footer-bottom">
        &copy; ${new Date().getFullYear()} Kopala FPL. Developed with ⚽
    </div>
</footer>
`;

function initFooter() {
    const placeholder = document.getElementById('footer-placeholder');
    if (placeholder) {
        placeholder.innerHTML = footerTemplate;
    }
}

document.addEventListener('DOMContentLoaded', initFooter);
