/**
 * nav.js - Centralized Navigation with ID Reset Logic
 */

function loadNavbar() {
    const navHTML = `
    <nav class="mobile-nav">
      <div class="logo">
        <img src="logo.png" alt="Logo" height="40">
      </div>
      <div class="nav-right">
        <a href="index.html" class="cta-button logout-trigger">Log Out</a>
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
        <li><a href="index.html"><i class="fa-solid fa-chart-line"></i> Rank <span>&rsaquo;</span></a></li>
        <li><a href="leagues.html"><i class="fa-solid fa-trophy"></i> Leagues <span>&rsaquo;</span></a></li>
        <li><a href="prices.html"><i class="fa-solid fa-tags"></i> Prices <span>&rsaquo;</span></a></li>
        <li><a href="games.html"><i class="fa-solid fa-futbol"></i> Games <span>&rsaquo;</span></a></li>
        <li><a href="10k.html"><i class="fa-solid fa-chart-bar"></i> You vs 10k <span>&rsaquo;</span></a></li>
        <li><a href="about.html"><i class="fa-solid fa-circle-question"></i> About <span>&rsaquo;</span></a></li>
        <li><a href="https://wa.me/260964836842" target="_blank"><i class="fa-solid fa-comment-dots"></i> Support <small>&#x2311;</small></a></li>
      </ul>

      <hr class="menu-divider">

      <div class="menu-search">
        <i class="fa fa-search"></i>
        <input type="text" id="menuSearch" placeholder="Search pages...">
      </div>

      <div class="menu-footer">
        <a href="index.html" class="login-btn logout-trigger">Log Out</a>
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

function setupMenuLogic() {
    const openBtn = document.getElementById('openMenu');
    const closeBtn = document.getElementById('closeMenu');
    const menu = document.getElementById('mobileMenu');

    // Toggle logic
    openBtn.addEventListener('click', () => {
        menu.classList.add('active');
        document.body.style.overflow = 'hidden'; 
    });

    closeBtn.addEventListener('click', () => {
        menu.classList.remove('active');
        document.body.style.overflow = 'auto'; 
    });

    // RESET ID LOGIC
    // We select all elements with the 'logout-trigger' class
    const logoutButtons = document.querySelectorAll('.logout-trigger');
    logoutButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            // 1. Clear the specific ID from local storage
            localStorage.removeItem('fpl_id'); 
            // Or use localStorage.clear(); if you want to wipe everything
            
            // 2. Optional: Add a small alert or console log
            console.log("User ID has been reset.");
        });
    });
}

function highlightCurrentPage() {
    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    const links = document.querySelectorAll('.menu-links a');
    links.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active-link');
        }
    });
}

document.addEventListener('DOMContentLoaded', loadNavbar);
