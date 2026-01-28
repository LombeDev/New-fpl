function loadNavbar() {
    const navHTML = `
    <nav class="mobile-nav">
      <div class="logo">
        <img src="logo.png" alt="Logo" height="40">
      </div>
      <div class="nav-right">
        <a href="#" class="cta-button">Join The Hub</a>
        <button class="menu-toggle" id="openMenu">
          <span class="bar"></span>
          <span class="bar"></span>
          <span class="bar"></span>
        </button>
      </div>
    </nav>

    <div id="mobileMenu" class="overlay-menu">
      <div class="menu-header">
        <img src="logo.png" alt="Logo" height="40">
        <button class="close-btn" id="closeMenu">&times;</button>
      </div>
      <ul class="menu-links">
        <li><a href="index.html"><i class="fa-solid fa-chart-line"></i> Rank <span>&rsaquo;</span></a></li>
        <li><a href="leagues.html"><i class="fa-solid fa-trophy"></i> Leagues <span>&rsaquo;</span></a></li>
        <li><a href="prices.html"><i class="fa-solid fa-tags"></i> Prices <span>&rsaquo;</span></a></li>
        <li><a href="games.html"><i class="fa-solid fa-futbol"></i> Games <span>&rsaquo;</span></a></li>
        <li><a href="10k.html"><i class="fa fa-bar-chart"></i> You vs 10k <span>&rsaquo;</span></a></li>
        <li><a href="#"><i class="fa fa-question-circle"></i> About <span>&rsaquo;</span></a></li>
        <li><a href="https://wa.me/260964836842" target="_blank"><i class="fa fa-comments"></i> Support <small>&#x2311;</small></a></li>
        <li><a href="#"><i class="fa fa-ellipsis-h"></i> More <span>&rsaquo;</span></a></li>
      </ul>
      <hr class="menu-divider">
      <div class="menu-search">
        <i class="fa fa-search"></i>
        <input type="text" placeholder="Search">
      </div>
      <div class="menu-footer">
        <button class="cta-button">Join The Hub</button>
        <button class="login-btn">Log in</button>
      </div>
    </div>

    <nav class="bottom-nav">
        <a href="index.html" class="nav-item"><i class="fa-solid fa-chart-line"></i><span>Rank</span></a>
        <a href="leagues.html" class="nav-item"><i class="fa-solid fa-trophy"></i><span>Leagues</span></a>
        <a href="prices.html" class="nav-item"><i class="fa-solid fa-tags"></i><span>Prices</span></a>
        <a href="games.html" class="nav-item"><i class="fa-solid fa-futbol"></i><span>Games</span></a>
    </nav>
    `;

    // Insert the HTML into the placeholder
    const placeholder = document.getElementById('nav-placeholder');
    if (placeholder) {
        placeholder.innerHTML = navHTML;
        setupMenuLogic(); // Initialize click events after loading HTML
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
}

// Run the function when the script loads
loadNavbar();