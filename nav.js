/**
 * nav.js - Centralized Navigation for the Website
 * This script handles the Top Nav and the Full-screen Overlay Menu.
 */

function loadNavbar() {
    const navHTML = `
    <nav class="mobile-nav">
      <div class="logo">
        <img src="logo.png" alt="Logo" height="40">
      </div>
      <div class="nav-right">
        <a href="join.html" class="cta-button">Change ID</a>
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
        <li><a href="index.html"><i class=""></i> Rank <span>&rsaquo;</span></a></li>
        <li><a href="leagues.html"><i class=""></i> Leagues <span>&rsaquo;</span></a></li>
        <li><a href="prices.html"><i class=""></i> Prices <span>&rsaquo;</span></a></li>
        <li><a href="games.html"><i class=""></i> Games <span>&rsaquo;</span></a></li>
        <li><a href="10k.html"><i class=""></i> You vs 10k <span>&rsaquo;</span></a></li>
        <li><a href="about.html"><i class=""></i> About <span>&rsaquo;</span></a></li>
        <li><a href="https://wa.me/260964836842" target="_blank"><i class=""></i> Support <small>&#x2311;</small></a></li>
      </ul>

      <hr class="menu-divider">

      <div class="menu-search">
        <i class="fa fa-search"></i>
        <input type="text" id="menuSearch" placeholder="Search pages...">
      </div>

      <div class="menu-footer">
        <a href="" class="login-btn">Change ID</a>
      </div>
    </div>
    `;

    // Locate the placeholder in your HTML files
    const placeholder = document.getElementById('nav-placeholder');
    
    if (placeholder) {
        placeholder.innerHTML = navHTML;
        setupMenuLogic();
        highlightCurrentPage();
    } else {
        console.warn("Coding Partner: 'nav-placeholder' not found in this HTML file.");
    }
}

/**
 * Handles Opening, Closing, and Interaction Logic
 */
function setupMenuLogic() {
    const openBtn = document.getElementById('openMenu');
    const closeBtn = document.getElementById('closeMenu');
    const menu = document.getElementById('mobileMenu');

    // 1. Open Menu Logic
    openBtn.addEventListener('click', () => {
        menu.classList.add('active');
        document.body.style.overflow = 'hidden'; // Stop background scroll
    });

    // 2. Close Menu Logic
    closeBtn.addEventListener('click', () => {
        menu.classList.remove('active');
        document.body.style.overflow = 'auto'; // Resume background scroll
    });

    // 3. Close menu if a user clicks a link (helpful for mobile UX)
    const navLinks = document.querySelectorAll('.menu-links a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            menu.classList.remove('active');
            document.body.style.overflow = 'auto';
        });
    });
}

/**
 * Automatically highlights the current page in the menu
 */
function highlightCurrentPage() {
    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    const links = document.querySelectorAll('.menu-links a');
    
    links.forEach(link => {
        const href = link.getAttribute('href');
        if (href === currentPath) {
            link.style.color = '#ff0055'; // Pink highlight for active page
            link.style.fontWeight = 'bold';
        }
    });
}

// Initialize the navbar on load
document.addEventListener('DOMContentLoaded', loadNavbar);
