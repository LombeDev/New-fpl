/* -----------------------------------------
    GLOBAL SETUP
----------------------------------------- */
// Using the more reliable proxy for cross-origin requests

const proxy = "https://api.allorigins.win/raw?url=";

// Global variables initialized at the top
let teamMap = {};    // Team ID -> Abbreviation (e.g., 1 -> 'ARS')
let playerMap = {};  // Player ID -> Full Name
let currentGameweekId = null;

/* -----------------------------------------
    NEW: LOADER MANAGEMENT
----------------------------------------- */
/**
 * Hides the loading overlay with a smooth fade-out.
 * Called ONLY after all critical data loading functions complete.
 * NOTE: The loading overlay element was not in the provided HTML, but the function assumes its existence.
 */
function hideLoadingOverlay() {
    const overlay = document.getElementById("loading-overlay");
    if (overlay) {
        // Assume you have CSS for the .hidden class to handle opacity transition
        overlay.classList.add('hidden'); 
        
        // Remove it from the DOM completely after the CSS transition completes (500ms)
        setTimeout(() => {
            overlay.remove();
        }, 500); 
    }
    console.log("Loading process finished.");
}

/**
 * Manages all critical data fetching and hides the loader when complete.
 */
async function startDataLoadingAndTrackCompletion() {
    try {
        // 1. Start the crucial bootstrap data load first.
        const bootstrapPromise = loadFPLBootstrapData();
        
        // 2. Start all other independent loads simultaneously and wait for ALL.
        await Promise.all([
            bootstrapPromise,
            loadStandings(),
            loadGeneralLeagueStandings(),
        ]);

        // 3. Ensure a minimum display time for the loader (e.g., 500ms) before hiding.
        await new Promise(resolve => setTimeout(resolve, 500));
        
        hideLoadingOverlay();

    } catch (err) {
        console.error("Critical loading failed:", err);
        // Ensure the loader is hidden even if the load fails, so the error messages are visible.
        hideLoadingOverlay();
    }
}


/* -----------------------------------------
    LIGHT / DARK / MULTI-COLOR MODE TOGGLE + SAVE
----------------------------------------- */
// We need to define themeToggle globally before the DOMContentLoaded listener runs
const themeToggle = document.getElementById("themeToggle");
const body = document.body;

// Define the list of theme classes in the desired cycle order
const themes = [
    '',              // 1. Light Mode (No class)
    'dark-mode',     // 2. Dark Mode
    'cyan-theme',    // 3. Cyan/Green Theme (Needs to be defined in CSS if used)
    'red-theme',     // 4. Red/Black Theme (Needs to be defined in CSS if used)
    'blue-theme'     // 5. FPL Blue Theme (Needs to be defined in CSS if used)
];

/**
 * Gets the index of the currently active theme class based on local storage.
 */
function getCurrentThemeIndex() {
    const savedTheme = localStorage.getItem("theme");
    const index = themes.indexOf(savedTheme);
    return index !== -1 ? index : 0; 
}

/**
 * Applies the theme class and updates localStorage and the toggle button icon.
 * @param {number} index - The index of the theme in the 'themes' array.
 */
function applyTheme(index) {
    // 1. Remove all potential theme classes
    themes.forEach(theme => {
        if (theme) { 
            body.classList.remove(theme);
        }
    });

    // 2. Apply the new theme class
    const newTheme = themes[index];
    if (newTheme) {
        body.classList.add(newTheme);
        localStorage.setItem("theme", newTheme);
    } else {
        // If theme is '' (Light Mode)
        localStorage.removeItem("theme"); 
    }

    // 3. Update the button icon for all theme buttons
    const nextThemeIndex = (index + 1) % themes.length;
    const nextTheme = themes[nextThemeIndex];
    
    let icon = `<i class="fas fa-sun"></i> Toggle Light Mode`; // Default to Sun (Next is Light Mode)
    switch (nextTheme) {
        case 'dark-mode':
            icon = `<i class="fas fa-moon"></i> Toggle Dark Mode`; 
            break;
        case 'cyan-theme':
            icon = `<i class="fas fa-magic"></i> Toggle Cyan Mode`; 
            break;
        case 'red-theme':
            icon = `<i class="fas fa-fire"></i> Toggle Red Mode`; 
            break;
        case 'blue-theme':
            icon = `<i class="fas fa-tint"></i> Toggle Blue Mode`; 
            break;
    }
    
    // Target the primary floating button and the buttons in the menu/modal
    const themeButtons = [
        document.getElementById('themeToggle'), 
        document.getElementById('themeToggleMenu'), // In off-canvas menu
        document.getElementById('toggle-theme-modal-btn') // In more options modal
    ].filter(el => el); 

    themeButtons.forEach(btn => {
        // For the floating button, we only need the emoji part, not the whole text
        if (btn.id === 'themeToggle') {
            btn.innerHTML = icon.split('>')[0].split('<i class="')[1].split('">')[0] === 'fas fa-sun' ? '🌙' : '☀️'; // Simple icon toggle for floating button
        } else {
             // For menu/modal buttons, use the descriptive text
            btn.innerHTML = icon;
        }
    });
}


// --- Initialization ---
let currentThemeIndex = getCurrentThemeIndex();
applyTheme(currentThemeIndex); // Apply the saved theme on load

// --- Toggle Logic ---
if (themeToggle) {
    themeToggle.addEventListener("click", () => {
        // Increment the index, looping back to 0 (Light Mode) when exceeding the array length
        currentThemeIndex = (currentThemeIndex + 1) % themes.length;
        
        applyTheme(currentThemeIndex);
    });
}


/* -----------------------------------------
    NAVIGATION MENU TOGGLES (NEW LOGIC)
----------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
    // --- OFF-CANVAS MENU (DESKTOP/MAIN MENU) ELEMENTS ---
    // FIXED: Use the correct ID from the HTML for the menu toggle button
    const desktopMenuBtn = document.getElementById('menu-toggle-btn');
    const offCanvasMenu = document.getElementById('desktop-nav-menu'); 
    // FIXED: Use the correct ID from the HTML for the menu close button
    const closeMenuBtn = document.getElementById('close-menu-btn');
    const themeToggleMenu = document.getElementById('themeToggleMenu'); 

    // --- MOBILE MORE OPTIONS MODAL ELEMENTS ---
    // FIXED: The mobile button is the last item in the bottom-nav with the 'more' link
    const mobileMoreBtn = document.querySelector('#bottom-nav a[data-id="more-options"]');
    const mobileModal = document.getElementById('more-options-modal');
    // FIXED: Use the correct ID from the HTML for the modal close button
    const closeMobileModalBtn = document.getElementById('close-modal-btn');
    const closeMobileModalFooterBtn = document.getElementById('close-modal-footer-btn');
    const themeToggleModalLink = document.getElementById('toggle-theme-modal-btn');


    // =========================================================
    // 1. OFF-CANVAS MENU LOGIC (Desktop/Tablet)
    // =========================================================

    function toggleOffCanvasMenu(open) {
        if (offCanvasMenu) {
            if (open) {
                offCanvasMenu.classList.add('open');
                // Use the generic 'open' class for aria state as well
                desktopMenuBtn?.setAttribute('aria-expanded', 'true');
            } else {
                offCanvasMenu.classList.remove('open');
                desktopMenuBtn?.setAttribute('aria-expanded', 'false');
            }
        }
    }

    // Open button listener
    desktopMenuBtn?.addEventListener('click', (e) => {
        e.preventDefault(); // Stop link from triggering
        // Close the mobile modal if it's open
        toggleMobileModal(false); 
        toggleOffCanvasMenu(true);
    });

    // Close button listener
    closeMenuBtn?.addEventListener('click', () => {
        toggleOffCanvasMenu(false);
    });
    
    // Close on link click inside the menu
    offCanvasMenu?.querySelectorAll('.nav-links-list a').forEach(link => {
        link.addEventListener('click', () => {
            toggleOffCanvasMenu(false);
        });
    });


    // =========================================================
    // 2. MOBILE MORE OPTIONS MODAL LOGIC
    // =========================================================

    function toggleMobileModal(open) {
        if (mobileModal) {
            if (open) {
                // FIXED: Use the 'show' class which matches the CSS
                mobileModal.classList.add('show');
                // body.classList.add('modal-open'); // Removed body scroll lock, often complex to manage
                mobileMoreBtn?.setAttribute('aria-expanded', 'true');
            } else {
                mobileModal.classList.remove('show');
                // body.classList.remove('modal-open');
                mobileMoreBtn?.setAttribute('aria-expanded', 'false');
            }
        }
    }

    // Open button listener (More button in the mobile nav)
    mobileMoreBtn?.addEventListener('click', (e) => {
        e.preventDefault(); // Prevent the 'more.html' navigation
        // Close the desktop menu if it's open (important for tablet breakpoints)
        toggleOffCanvasMenu(false); 
        toggleMobileModal(true);
    });

    // Close button listeners (inside the modal)
    closeMobileModalBtn?.addEventListener('click', () => {
        toggleMobileModal(false);
    });
    closeMobileModalFooterBtn?.addEventListener('click', () => {
        toggleMobileModal(false);
    });

    // Close when clicking the backdrop
    mobileModal?.addEventListener('click', (event) => {
        // Check if the click occurred on the modal backdrop itself
        if (event.target === mobileModal) {
            toggleMobileModal(false);
        }
    });
    
    // Close on link click inside the modal (using the .modal-link class for specific links)
    mobileModal?.querySelectorAll('.modal-options-list a').forEach(link => {
        link.addEventListener('click', (e) => {
            // Only auto-close if it's a link meant for internal navigation (e.g., hash link)
            if (link.classList.contains('modal-link') || link.hash) {
                toggleMobileModal(false);
            }
            // If it's the theme toggle link, don't close the modal, just trigger the theme change
        });
    });

    // =========================================================
    // 3. THEME TOGGLE INTEGRATION (Centralized click handling)
    // =========================================================
    
    // Theme button inside the off-canvas menu
    if (themeToggleMenu) {
        themeToggleMenu.addEventListener("click", () => {
            themeToggle.click();
        });
    }

    // Theme button inside the mobile modal (This is the anchor tag <a>)
    if (themeToggleModalLink) {
        themeToggleModalLink.addEventListener("click", (e) => {
            e.preventDefault(); // Prevent default link behavior
            themeToggle.click();
        });
    }
});


/* -----------------------------------------
    LAZY LOADING FADE-IN
----------------------------------------- */
const lazyElements = document.querySelectorAll(".lazy");

const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
            // Assuming you have CSS for .lazy-loaded to trigger fade-in
            entry.target.classList.add("lazy-loaded");
            observer.unobserve(entry.target);
        }
    });
}, { threshold: 0.1 });

lazyElements.forEach((el) => observer.observe(el));

/* -----------------------------------------
    FPL API FETCHING
----------------------------------------- */

// On page load 
window.addEventListener("DOMContentLoaded", () => {
    // We now call the loading manager instead of individual functions.
    startDataLoadingAndTrackCompletion();
});


/**
 * Helper function to create the HTML for rank/price change icons.
 * @param {number} changeValue - The magnitude of the change.
 * @param {boolean} isPriceChange - True if the icon is for a price change (uses different arrows/colors).
 * @returns {string} HTML span tag with the appropriate icon.
 */
function getChangeIconHtml(changeValue, isPriceChange) {
    if (changeValue > 0) {
        const icon = isPriceChange ? '▲' : '⬆️';
        // Note: CSS classes 'price-up' and 'price-down' must be defined for success/danger colors
        const colorClass = isPriceChange ? 'price-riser' : 'change-up';
        return `<span class="${colorClass}">${icon}</span>`;
    } else if (changeValue < 0) {
        const icon = isPriceChange ? '▼' : '⬇️';
        const colorClass = isPriceChange ? 'price-faller' : 'change-down';
        return `<span class="${colorClass}">${icon}</span>`;
    } else {
        return `<span class="change-no-change">━</span>`;
    }
}


/**
 * Fetches FPL bootstrap data, creates maps, and initializes dependent loads.
 * @returns {Promise<object>} The raw bootstrap data.
 */
async function loadFPLBootstrapData() {
    console.log("Fetching FPL Bootstrap data...");
    try {
        const response = await fetch(
            proxy + "https://fantasy.premierleague.com/api/bootstrap-static/"
        );
        const data = await response.json();

        // 1. Create maps
        data.teams.forEach(team => {
            teamMap[team.id] = team.short_name;
        });

        data.elements.forEach(player => {
            playerMap[player.id] = `${player.first_name} ${player.second_name}`;
        });

        // 2. Determine Current Gameweek ID
        let currentEvent = data.events.find(e => e.is_current);

        if (!currentEvent) {
            const finishedEvents = data.events.filter(e => e.finished);
            if (finishedEvents.length > 0) {
                finishedEvents.sort((a, b) => b.id - a.id);
                currentEvent = finishedEvents[0];
            }
        }

        if (currentEvent) {
            currentGameweekId = currentEvent.id;
        }

        // 3. Load dependent lists
        await Promise.all([
            loadCurrentGameweekFixtures(data),
            loadPriceChanges(data),
            loadMostTransferred(data),
            loadMostTransferredOut(data),
            loadMostCaptained(data),
            loadPlayerStatusUpdates(data),
            processDeadlineDisplay(data), 
            loadSimpleEPLTable(data) 
        ]);


        // CRITICAL: Return the data for parent function logic
        return data;

    } catch (err) {
        console.error("Error fetching FPL Bootstrap data:", err);
        const sections = ["price-changes-list-content", "most-transferred-list-content", "most-transferred-out-list-content", "most-captained-list-content", "fixtures-list-content", "status-list", "countdown-timer"];
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.innerHTML = `<p class="error-message">❌ Failed to load data. Check FPL API/Proxy.</p>`;
        });
        throw err; // Re-throw to be caught by startDataLoadingAndTrackCompletion
    }
}


// ------------------------------------------------
// ⚠️ MISSING FUNCTION STUBS (CRITICAL FOR COMPLETENESS)
// ------------------------------------------------

/**
 * Renders the main league standings (replace the loader in #standings-list).
 */
async function loadStandings() {
    // --- STUB IMPLEMENTATION ---
    const container = document.getElementById("standings-list");
    if (!container) return;
    
    // Simulate API call and rendering
    const dummyData = [
        { rank: 1, rank_change: 0, player_name: "KOPALA (You)", total: 2500, entry_name: "The Best Team" },
        { rank: 2, rank_change: 1, player_name: "M. Zimba", total: 2450, entry_name: "Zimba's XI" },
        { rank: 3, rank_change: -1, player_name: "A. Banda", total: 2400, entry_name: "Bandit Kings" },
    ];
    
    container.innerHTML = dummyData.map(team => {
        const rankChangeHtml = getChangeIconHtml(team.rank_change, false); 
        return `
            <div class="${team.rank === 1 ? 'highlight-accent' : ''}">
                <span class="rank-number">${team.rank}.</span> 
                <span class="manager-name">${team.player_name} (${team.entry_name})</span> 
                ${rankChangeHtml} <span><strong>${team.total}</strong> pts</span>
            </div>
        `;
    }).join('');
    // --- END STUB ---
}


// 🌍 GENERAL LEAGUE STANDINGS (Collapsible Section Content)
/**
 * Loads and displays standings for a list of general leagues.
 * The content for these leagues will be collapsible/expandable.
 */
async function loadGeneralLeagueStandings() {
    const container = document.getElementById("general-leagues-list");
    if (!container) return;

    // --- 1. Define the leagues to load (IDs provided by the user) ---
    const leaguesToLoad = [
        { id: "258", name: "Zambia", type: "Classic" }, 
        { id: "315", name: "Overall", type: "Classic" }, 
        { id: "276", name: "Gameweek 1", type: "Classic" }, 
        { id: "333", name: "Second Chance", type: "H2H" }, 
    ];

    container.innerHTML = ""; // Clear the initial loading content

    const loadPromises = leaguesToLoad.map(async (leagueConfig) => {
        // Create a dedicated sub-container for this league
        const leagueItem = document.createElement('div');
        leagueItem.classList.add('general-league-item');

        // Create the header for this specific league list
        const leagueHeader = document.createElement('div');
        leagueHeader.classList.add('general-league-header');
        leagueHeader.innerHTML = `
            <h4>${leagueConfig.name} League Standings</h4>
            <span class="league-type">(${leagueConfig.type})</span>
            <span class="loader-small"></span>
        `;
        
        const standingsContent = document.createElement('div');
        // Start closed by default
        standingsContent.classList.add('league-standings-content', 'hidden'); 
        
        leagueItem.appendChild(leagueHeader);
        leagueItem.appendChild(standingsContent);
        container.appendChild(leagueItem);

        // Add click listener to toggle the individual league standing content
        leagueHeader.addEventListener('click', () => {
            // Simple toggle for individual leagues
            standingsContent.classList.toggle('hidden');
            leagueHeader.classList.toggle('active');
        });


        try {
            // --- API Fetch Placeholder ---
            // Determine API endpoint based on league type (Classic or H2H)
            const apiEndpoint = leagueConfig.type === "H2H" 
                ? `https://fantasy.premierleague.com/api/leagues-h2h/${leagueConfig.id}/standings/`
                : `https://fantasy.premierleague.com/api/leagues-classic/${leagueConfig.id}/standings/`;

            const data = await fetch(proxy + apiEndpoint).then((r) => r.json());

            const results = data.standings?.results;
            const loader = leagueHeader.querySelector('.loader-small');
            if (loader) loader.remove(); // Remove loader on success

            if (!results || results.length === 0) {
                standingsContent.innerHTML = `<p class="error-message">No teams found in this league.</p>`;
                return; 
            }

            // --- 2. Render Standings Table ---
            const list = document.createElement('ul');
            list.classList.add('standings-list-general'); // Use a specific class for styling

            results.forEach((team) => {
                const rankChangeHtml = getChangeIconHtml(team.rank_change, false); 

                const listItem = document.createElement("li");
                listItem.innerHTML = `
                    <span class="rank-number">$