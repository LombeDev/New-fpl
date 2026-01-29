/**
 * nav.js - Centralized Navigation with FPL ID Reset Logic
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
        <li><a href="index.html"><i class=""></i> Home <span>&rsaquo;</span></a></li>
        <li><a href="leagues.html"><i class=""></i> Leagues <span>&rsaquo;</span></a></li>
        <li><a href="prices.html"><i class=""></i> Prices <span>&rsaquo;</span></a></li>
        <li><a href="games.html"><i class=""></i> Games <span>&rsaquo;</span></a></li>
        <li><a href="10k.html"><i class=""></i> You vs 10k <span>&rsaquo;</span></a></li>
        <li><a href="about.html"><i class=""></i> About <span>&rsaquo;</span></a></li>
        <li><a href="https://wa.me/260964836842" target="_blank">Support</a></li>
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

// THE RESET LOGIC (Matched to your provided script)
function resetTeamID() {
    if (confirm("Would you like to change your Team ID?")) {
        // 1. Clear the saved ID from the browser memory using your specific key
        localStorage.removeItem('kopala_id');
        
        // 2. Refresh the page
        // Since the 'state.fplId' will be null on reload, your main 
        // script will show the login screen automatically.
        location.reload();
    }
}

function setupMenuLogic() {
    const openBtn = document.getElementById('openMenu');
    const closeBtn = document.getElementById('closeMenu');
    const menu = document.getElementById('mobileMenu');

    openBtn.addEventListener('click', () => {
        menu.classList.add('active');
        document.body.style.overflow = 'hidden'; 
    });

    closeBtn.addEventListener('click', () => {
        menu.classList.remove('active');
        document.body.style.overflow = 'auto'; 
    });

    // Close menu if a link is clicked
    const navLinks = document.querySelectorAll('.menu-links a');
    navLinks.forEach(link => {
        link.addEventListener('click', () => {
            menu.classList.remove('active');
            document.body.style.overflow = 'auto';
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
