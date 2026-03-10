// ─────────────────────────────────────────────────────────────────
// KOPALA FPL NAVIGATION - With Sidebar Icon Toggle
// ─────────────────────────────────────────────────────────────────

(function(){
  const NAV_HTML = `
    <nav class="nav-bar">
      <div class="nav-content">
        <!-- Sidebar Toggle Icon -->
        <button class="nav-toggle" aria-label="Toggle navigation" title="Toggle menu">
          <svg class="nav-icon" viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="8" height="18" rx="1.5"/>
            <line x1="14" y1="5" x2="21" y2="5"/>
            <line x1="14" y1="11" x2="21" y2="11"/>
            <line x1="14" y1="17" x2="21" y2="17"/>
          </svg>
        </button>

        <!-- Logo/Brand -->
        <a href="/" class="nav-logo" aria-label="Kopala FPL Home">
          <span class="logo-icon">K</span>
          <span class="logo-text">Kopala</span>
        </a>

        <!-- Navigation Menu -->
        <div class="nav-menu">
          <a href="/" class="nav-link">Dashboard</a>
          <a href="/games.html" class="nav-link">Matches</a>
          <a href="/leagues.html" class="nav-link">Leagues</a>
          <a href="/prices.html" class="nav-link">Prices</a>
        </div>

        <!-- Right Side Actions -->
        <div class="nav-actions">
          <button class="theme-toggle" aria-label="Toggle dark mode" title="Toggle theme">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
              <circle cx="12" cy="12" r="5"/>
              <line x1="12" y1="1" x2="12" y2="3"/>
              <line x1="12" y1="21" x2="12" y2="23"/>
              <line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
              <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/>
              <line x1="1" y1="12" x2="3" y2="12"/>
              <line x1="21" y1="12" x2="23" y2="12"/>
              <line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
              <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>
            </svg>
          </button>
        </div>
      </div>
    </nav>
  `;

  function initNav() {
    const placeholder = document.getElementById('nav-placeholder');
    if (!placeholder) return;

    placeholder.innerHTML = NAV_HTML;

    // Sidebar toggle functionality
    const navToggle = placeholder.querySelector('.nav-toggle');
    const navMenu = placeholder.querySelector('.nav-menu');
    const navLinks = placeholder.querySelectorAll('.nav-link');

    if (navToggle && navMenu) {
      // Toggle menu on button click
      navToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        navMenu.classList.toggle('open');
        navToggle.classList.toggle('active');
      });

      // Close menu when clicking outside
      document.addEventListener('click', (e) => {
        if (!navMenu.contains(e.target) && !navToggle.contains(e.target)) {
          navMenu.classList.remove('open');
          navToggle.classList.remove('active');
        }
      });

      // Close menu when clicking a link
      navLinks.forEach(link => {
        link.addEventListener('click', () => {
          navMenu.classList.remove('open');
          navToggle.classList.remove('active');
        });
      });

      // Close on escape key
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          navMenu.classList.remove('open');
          navToggle.classList.remove('active');
        }
      });
    }

    // Theme toggle functionality
    const themeToggle = placeholder.querySelector('.theme-toggle');
    if (themeToggle) {
      themeToggle.addEventListener('click', () => {
        const html = document.documentElement;
        const currentTheme = html.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        
        html.setAttribute('data-theme', newTheme);
        localStorage.setItem('kopala_theme', newTheme);
      });
    }
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initNav);
  } else {
    initNav();
  }
})();
