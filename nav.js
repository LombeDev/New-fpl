/**
 * nav.js - Complete Responsive Navigation
 * Includes: Mobile Overlay, Desktop Top Bar, and Desktop Sidebar
 */

function loadNavbar() {
    const navHTML = `
    <nav class="mobile-nav">
      <div class="logo">
        <img src="logo.png" alt="Logo" height="35">
      </div>
      <div class="nav-right">
        <button class="menu-toggle" id="openMenu">
          <span class="bar"></span>
          <span class="bar"></span>
          <span class="bar"></span>
        </button>
      </div>
    </nav>

    <nav class="desktop-top-nav">
      <div class="top-nav-container">
        <div class="logo">
          <img src="logo.png" alt="Logo" height="30">
        </div>
        <ul class="top-nav-links">
          <li><a href="index.html"><i class="fa-solid fa-chart-line"></i> Dashboard</a></li>
          <li><a href="how-it-works.html"><i class="fa-solid fa-brain"></i> How It Works</a></li>
          <li><a href="preferences.html"><i class="fa-solid fa-gear"></i> Preferences</a></li>
          <li><a href="account.html"><i class="fa-solid fa-circle-user"></i> Account</a></li>
        </ul>
        <div class="user-profile" onclick="resetTeamID()">
          <div class="user-info">
            <span class="user-name">Ayew Ready?</span>
            <span class="plan-tag">Free Plan</span>
          </div>
        </div>
      </div>
    </nav>

    <aside class="desktop-sidebar">
      <div class="sidebar-content">
        <h3 class="sidebar-title">Navigation</h3>
        
        <div class="sidebar-section">
          <a href="overview.html" class="sidebar-item active">
            <i class="fa-solid fa-house"></i> Overview
          </a>
          <a href="live.html" class="sidebar-item">
            <i class="fa-solid fa-tower-broadcast"></i> Live <span class="dot"></span>
          </a>
        </div>

        <div class="sidebar-group">
          <li><a href="index.html">Home</a></li>
        <li><a href="leagues.html">Leagues</a></li>
        <li><a href="prices.html">Prices</a></li>
        <li><a href="games.html">Games</a></li>
        <li><a href="prizes.html">Prizes</a></li>
        <li><a href="#" onclick="resetTeamID()">Change ID</a></li>
        </div>

      </div>
    </aside>

    <div id="mobileMenu" class="overlay-menu">
      <div class="menu-header">
        <img src="logo.png" alt="Logo" height="40">
        <button class="close-btn" id="closeMenu">&times;</button>
      </div>
      <ul class="menu-links">
        <li><a href="index.html">Dashboard</a></li>
        <li><a href="leagues.html">Leagues</a></li>
        <li><a href="prices.html">Prices</a></li>
        <li><a href="games.html">Games</a></li>
        <li><a href="prizes.html">Prizes</a></li>
        <li><a href="#" onclick="resetTeamID()">Change ID</a></li>
      </ul>
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

    if(openBtn && menu) {
        openBtn.addEventListener('click', () => menu.classList.add('active'));
    }
    if(closeBtn && menu) {
        closeBtn.addEventListener('click', () => menu.classList.remove('active'));
    }
}

function highlightCurrentPage() {
    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    const links = document.querySelectorAll('.top-nav-links a, .sidebar-item, .menu-links a');
    links.forEach(link => {
        if (link.getAttribute('href') === currentPath) {
            link.classList.add('active-link');
        }
    });
}

function resetTeamID() {
    if (confirm("Would you like to change your Team ID?")) {
        localStorage.removeItem('kopala_id');
        location.reload();
    }
}

document.addEventListener('DOMContentLoaded', loadNavbar);
