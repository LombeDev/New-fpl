/**
 * nav.js - Centralized Navigation, Theme Logic, and FPL ID Management
 */

// 1. IMMEDIATE EXECUTION: Set theme before page renders to prevent flickering
(function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
})();

/**
 * Main function to inject the Navbar HTML
 */
function loadNavbar() {
    const navHTML = `
    <nav class="mobile-nav">
      <div class="logo">
        <img src="logo.png" alt="Logo" height="40">
      </div>
      <div class="nav-right">
        <a href="#" class="cta-button" onclick="resetTeamID()">Change ID</a>
        <button class="menu-toggle" id="openMenu" aria-label="Open Menu">
          <span class="bar"></span>
          <span class="bar"></span>
          <span class="bar"></span>
        </button>
      </div>
    </nav>

    <div id="mobileMenu" class="overlay-menu">
      <div class="menu-header">
        <img src="logo.png" alt="Logo" height="40">
        <button class="close-btn" id="closeMenu" aria-label="Close Menu">&times;</button>
      </div>
      
      <ul class="menu-links">
        <li><a href="index.html">Home <span>&rsaquo;</span></a></li>
        <li><a href="leagues.html">Leagues <span>&rsaquo;</span></a></li>
        <li><a href="prices.html">Prices <span>&rsaquo;</span></a></li>
        <li><a href="games.html">Games <span>&rsaquo;</span></a></li>
        <li><a href="10k.html">You vs 10k <span>&rsaquo;</span></a></li>
        <li><a href="about.html">About <span>&rsaquo;</span></a></li>
        <li><a href="https://wa.me/260964836842" target="_blank">Support <small>&#x2311;</small></a></li>
      </ul>

      <hr class="menu-divider">

      <div class="menu-search">
        <i class="fa fa-search"></i>
        <input type="text" id="menuSearch" placeholder="Search pages...">
      </div>

      <div class="menu-footer">
        <div class="theme-row">
            <span class="theme-label">Theme</span>
            <div class="toggle-container">
                <div class="slider-bg"></div>
                <button id="btn-dark" class="toggle-btn" onclick="setTheme('dark')">Dark</button>
                <button id="btn-light" class="toggle-btn" onclick="setTheme('light')">Light</button>
            </div>
        </div>
        <a href="#" class="login-btn" onclick="resetTeamID()">Change ID</a>
      </div>
    </div>
    `;

    const placeholder = document.getElementById('nav-placeholder');
    if (placeholder) {
        placeholder.innerHTML = navHTML;
        setupMenuLogic();
        highlightCurrentPage();
        
        // Sync the toggle UI with the current saved theme
        const currentTheme = localStorage.getItem('theme') || 'dark';
        updateThemeUI(currentTheme);
    }
}

/**
 * Theme Switching Logic
 */
function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    updateThemeUI(theme);
}

function updateThemeUI(theme) {
    const darkBtn = document.getElementById('btn-dark');
    const lightBtn = document.getElementById('btn-light');

    if (darkBtn && lightBtn) {
        if (theme === 'dark') {
            darkBtn.classList.add('active');
            lightBtn.classList.remove('active');
        } else {
            lightBtn.classList.add('active');
            darkBtn.classList.remove('active');
        }
    }
}

/**
 * FPL ID Reset Logic
 */
function resetTeamID() {
    if (confirm("Would you like to change your Team ID?")) {
        localStorage.removeItem('kopala_id');
        location.reload();
    }
}

/**
 * Mobile Menu Open/Close Logic
 */
function setupMenuLogic() {
    const openBtn = document.getElementById('openMenu');
    const closeBtn = document.getElementById('closeMenu');
    const menu = document.getElementById('mobileMenu');

    if (!openBtn || !closeBtn || !menu) return;

    openBtn.addEventListener('click', () => {
        menu.classList.add('active');
        document.body.style.overflow = 'hidden'; 
    });

    closeBtn.addEventListener('click', () => {
        menu.classList.remove('active');
        document.body.style.overflow = 'auto'; 
    });

    const navLinks = document.querySelectorAll('.menu-links a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            menu.classList.remove('active');
            document.body.style.overflow = 'auto';
        });
    });
}

/**
 * Auto-highlight the current page in the menu
 */
function highlightCurrentPage() {
    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    const links = document.querySelectorAll('.menu-links a');
    links.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active-link');
        }
    });
}

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', loadNavbar);
