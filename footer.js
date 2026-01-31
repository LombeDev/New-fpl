/**
 * footer.js - Lazy-Loaded Universal Footer Component
 */

const footerTemplate = `
<footer class="main-footer" style="opacity: 0; transform: translateY(20px); transition: all 0.6s ease-out;">
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

function initLazyFooter() {
    const placeholder = document.getElementById('footer-placeholder');
    if (!placeholder) return;

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                // 1. Inject the HTML only when the user is near
                placeholder.innerHTML = footerTemplate;
                
                // 2. Trigger the animation on the newly injected element
                const footer = placeholder.querySelector('.main-footer');
                setTimeout(() => {
                    footer.style.opacity = "1";
                    footer.style.transform = "translateY(0)";
                }, 50);

                // 3. Stop watching once loaded
                observer.unobserve(placeholder);
                console.log("Footer Lazy Loaded");
            }
        });
    }, { 
        rootMargin: '150px' // Start loading when footer is 150px away from view
    });

    observer.observe(placeholder);
}

document.addEventListener('DOMContentLoaded', initLazyFooter);
