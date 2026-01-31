/**
 * footer.js - Universal Footer Component
 */

const footerTemplate = `
<footer class="main-footer">
    <div class="footer-network-brand">
        <div class="network-label">KOPALA FPL</div>
    </div>

    <div class="awards-section">
        <div class="section-title" style="text-align:center; color:white; margin-bottom:15px; font-size: 0.8rem; font-weight: 800;">
            <i class="fa-solid fa-trophy" style="color:#fbbf24"></i> PRIZES
        </div>
        <div class="awards-grid">
            <div class="award-card gold">
                <div class="award-rank">1st</div>
                <div class="award-info">
                    <span class="award-label">League Winner</span>
                </div>
            </div>

            <div class="award-card silver">
                <div class="award-rank">2nd</div>
                <div class="award-info">
                    <span class="award-label">Runner Up</span>
                </div>
            </div>

            <div class="award-card cup">
                <div class="award-rank"><i class="fa-solid fa-trophy-award"></i></div>
                <div class="award-info">
                    <span class="award-label">Cup Winner</span>
                </div>
            </div>
        </div>
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
        &copy; ${new Date().getFullYear()} Kopala FPL, This app is not officially affiliated with Premier League or Fantasy Premier League. ⚽
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



document.addEventListener('DOMContentLoaded', () => {
    const footer = document.querySelector('.main-footer');

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // When footer is 10% visible, trigger the fade-in
                entry.target.classList.add('is-visible');
                // Unobserve once loaded to save memory
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 }); 

    if (footer) {
        observer.observe(footer);
    }
});
