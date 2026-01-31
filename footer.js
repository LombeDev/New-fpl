/**
 * footer.js - Universal Footer Component (Themed to Screenshot)
 */

const footerTemplate = `
<footer class="main-footer">
    <div class="footer-top-bar">
        <div class="footer-nav-links">
            <a href="#">ABOUT US</a>
            <a href="#">THE TEAM</a>
            <a href="careers.html">CAREERS</a>
            <a href="faq.html">FAQ</a>
            <a href="terms.html">T&CS</a>
            <a href="disclaimer.html">DISCLAIMER</a>
            <a href="privacy.html">PRIVACY POLICY</a>
            <a href="https://wa.me/260964836842">CONTACT US</a>
        </div>
    </div>

    <div class="footer-main-content">
        <div class="footer-network-brand">
            <div class="network-label">KOPALA FPL NETWORK</div>
            <div class="network-title">KOPALA</div>
        </div>

        <div class="footer-bottom">
            © Copyright Kopala FPL ${new Date().getFullYear()}. All rights reserved.
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

// Lazy Load via Idle Callback
window.addEventListener('load', () => {
    if ('requestIdleCallback' in window) {
        requestIdleCallback(injectFooter);
    } else {
        setTimeout(injectFooter, 1500);
    }
});
