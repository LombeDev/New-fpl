/**
 * nav.js - Centralized Responsive Navigation
 * Logic for Mobile Overlay + Desktop Horizontal Bar
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

    <nav class="desktop-nav">
      <div class="nav-container">
        <div class="logo">
          <img src="logo.png" alt="Logo" height="35">
        </div>

        <ul class="nav-links">
          <li><a href="index.html"><i class="fa-solid fa-chart-line"></i> Dashboard</a></li>
          <li><a href="how-it-works.html"><i class="fa-solid fa-brain"></i> How It Works</a></li>
          <li><a href="preferences.html"><i class="fa-solid fa-gear"></i> Preferences</a></li>
          <li><a href="account.html"><i class="fa-solid fa-circle-user"></i> Account</a></li>
        </ul>

        <div class="user-profile" onclick="resetTeamID()" style="cursor:pointer">
          <div class="user-info">
            <span class="user-name">Ayew Ready?</span>
            <span class="plan-tag">Free Plan</span>
          </div>
        </div>
      </div>
    </nav>

    <div id="mobileMenu" class="overlay-menu">
      <div class="menu-header">
        <img src="logo.png" alt="Logo" height="40">
        <button class="close-btn" id="closeMenu" aria-label="Close Menu">&times;</button>
      </div>
      
      <ul class="menu-links">
        <li><a href="index.html">Home</a></li>
        <li><a href="leagues.html">Leagues</a></li>
        <li><a href="prices.html">Prices</a></li>
        <li><a href="games.html">Games</a></li>
        <li><a href="prizes.html">Prizes</a></li>
        <li><a href="https://wa.me/260964836842" target="_blank">Help</a></li>
      </ul>

      <div class="menu-search">
        <i class="fa fa-search"></i>
        <input type="text" id="menuSearch" placeholder="Search pages...">
      </div>

      <div class="menu-footer">
        <a href="#" class="login-btn" onclick="resetTeamID()">Change ID</a>
      </div>
    </div>
    `;

    const placeholder = document.getElementById('nav-placeholder');
    if (placeholder) {
        placeholder.innerHTML = navHTML;
        setupMenuLogic();
        highlightCurrentPage();
    }
}

/**
 * Handles the opening and closing of the mobile overlay
 */
function setupMenuLogic() {
    const openBtn = document.getElementById('openMenu');
    const closeBtn = document.getElementById('closeMenu');
    const menu = document.getElementById('mobileMenu');

    if (openBtn && menu) {
        openBtn.addEventListener('click', () => {
            menu.classList.add('active');
            document.body.style.overflow = 'hidden'; 
        });
    }

    if (closeBtn && menu) {
        closeBtn.addEventListener('click', () => {
            menu.classList.remove('active');
            document.body.style.overflow = 'auto'; 
        });
    }

    // Close menu if any link is clicked
    const navLinks = document.querySelectorAll('.menu-links a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            menu.classList.remove('active');
            document.body.style.overflow = 'auto';
        });
    });
}

/**
 * Applies the 'active-link' class to the current page link in both menus
 */
function highlightCurrentPage() {
    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    const links = document.querySelectorAll('.menu-links a, .nav-links a');
    links.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active-link');
        }
    });
}

/**
 * Reset logic for the FPL Team ID
 */
function resetTeamID() {
    if (confirm("Would you like to change your Team ID?")) {
        localStorage.removeItem('kopala_id');
        location.reload();
    }
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', loadNavbar);
