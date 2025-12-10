/* -----------------------------------------
    GLOBAL SETUP
----------------------------------------- */
// Using the more reliable proxy for cross-origin requests
const proxy = "https://corsproxy.io/?";

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
}

/**
 * NEW: Manages all critical data fetching and hides the loader when complete.
 */
async function startDataLoadingAndTrackCompletion() {
    try {
        // 1. Start the crucial bootstrap data load first.
        await loadFPLBootstrapData();

        // 2. Start all other independent loads simultaneously and wait for ALL.
        await Promise.all([
            loadStandings(),
            loadGeneralLeagueStandings(),
            // All other dependent functions are now called inside loadFPLBootstrapData and should complete
            // before the loader is hidden.
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
    'cyan-theme',    // 3. Cyan/Green Theme
    'red-theme',     // 4. Red/Black Theme
    'blue-theme'     // 5. FPL Blue Theme
];

/**
 * Gets the index of the currently active theme class based on local storage.
 */
function getCurrentThemeIndex() {
    const savedTheme = localStorage.getItem("theme");
    
    // Check if the saved theme is in our list
    const index = themes.indexOf(savedTheme);
    
    // Return the index if found, otherwise default to 0 (Light Mode)
    return index !== -1 ? index : 0; 
}

/**
 * Applies the theme class and updates localStorage and the toggle button icon.
 * @param {number} index - The index of the theme in the 'themes' array.
 */
function applyTheme(index) {
    // 1. Remove all potential theme classes
    themes.forEach(theme => {
        if (theme) { // Skip the empty string for Light Mode
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

    // 3. Update the button icon for better visual feedback
    // Note: Since 'themeToggle' is now hidden/used as a central logic handler, 
    // we must update the text of ALL theme buttons (floating, off-canvas, modal)
    const nextThemeIndex = (index + 1) % themes.length;
    const nextTheme = themes[nextThemeIndex];
    
    let icon = "☀️"; // Default to Sun (Next is Light Mode)
    switch (nextTheme) {
        case 'dark-mode':
            icon = "🌙"; // Next is Dark Mode
            break;
        case 'cyan-theme':
            icon = "✨"; // Next is Cyan Theme
            break;
        case 'red-theme':
            icon = "🔴"; // Next is Red Theme
            break;
        case 'blue-theme':
            icon = "🔵"; // Next is Blue Theme
            break;
        // default remains "☀️"
    }

    const themeButtons = [
        themeToggle, 
        document.getElementById('themeToggleMenu'),
        document.getElementById('themeToggleMobileModal')
    ].filter(el => el); // Filter out any null elements

    themeButtons.forEach(btn => {
        btn.textContent = icon;
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
    const desktopMenuBtn = document.getElementById('desktop-menu-btn');
    const offCanvasMenu = document.getElementById('desktop-nav-menu'); 
    const closeMenuBtn = document.getElementById('close-off-canvas-btn');
    const themeToggleMenu = document.getElementById('themeToggleMenu'); // Theme button inside the off-canvas menu

    // --- MOBILE MORE OPTIONS MODAL ELEMENTS ---
    const mobileMoreBtn = document.getElementById('more-options-btn');
    const mobileModal = document.getElementById('more-options-modal');
    const closeMobileModalBtn = document.getElementById('close-mobile-modal-btn');
    const themeToggleMobileModal = document.getElementById('themeToggleMobileModal');


    // =========================================================
    // 1. OFF-CANVAS MENU LOGIC (Desktop/Tablet)
    // =========================================================

    /**
     * Toggles the open/closed state of the off-canvas menu.
     * @param {boolean} open - true to open, false to close.
     */
    function toggleOffCanvasMenu(open) {
        if (offCanvasMenu) {
            if (open) {
                offCanvasMenu.classList.add('open');
                desktopMenuBtn?.setAttribute('aria-expanded', 'true');
            } else {
                offCanvasMenu.classList.remove('open');
                desktopMenuBtn?.setAttribute('aria-expanded', 'false');
            }
        }
    }

    // Open button listener
    desktopMenuBtn?.addEventListener('click', () => {
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

    /**
     * Toggles the open/closed state of the mobile modal.
     * Also manages the body class to prevent background scrolling.
     * @param {boolean} open - true to open, false to close.
     */
    function toggleMobileModal(open) {
        if (mobileModal) {
            if (open) {
                mobileModal.classList.add('open');
                document.body.classList.add('modal-open');
                mobileMoreBtn?.setAttribute('aria-expanded', 'true');
            } else {
                mobileModal.classList.remove('open');
                document.body.classList.remove('modal-open');
                mobileMoreBtn?.setAttribute('aria-expanded', 'false');
            }
        }
    }

    // Open button listener (More button in the mobile nav)
    mobileMoreBtn?.addEventListener('click', () => {
        // Close the desktop menu if it's open (important for tablet breakpoints)
        toggleOffCanvasMenu(false); 
        toggleMobileModal(true);
    });

    // Close button listener (inside the modal)
    closeMobileModalBtn?.addEventListener('click', () => {
        toggleMobileModal(false);
    });

    // Close when clicking the backdrop
    mobileModal?.addEventListener('click', (event) => {
        if (event.target === mobileModal) {
            toggleMobileModal(false);
        }
    });
    
    // Close on link click inside the modal
    mobileModal?.querySelectorAll('.modal-options-list a').forEach(link => {
        link.addEventListener('click', () => {
            toggleMobileModal(false);
        });
    });

    // =========================================================
    // 3. THEME TOGGLE INTEGRATION (Centralized click handling)
    // =========================================================
    
    // Theme button inside the off-canvas menu
    if (themeToggleMenu) {
        themeToggleMenu.addEventListener("click", () => {
            // Trigger the original toggle function logic
            themeToggle.click();
        });
    }

    // Theme button inside the mobile modal
    if (themeToggleMobileModal) {
        themeToggleMobileModal.addEventListener("click", () => {
            // Trigger the original toggle function logic
            themeToggle.click();
        });
    }

    // =========================================================
    // 4. OLD NAVIGATION CLEANUP (for compatibility if old HTML persists)
    // Removed old menu toggle logic as it's replaced by the new system.
    // =========================================================
});


/* -----------------------------------------
    LAZY LOADING FADE-IN
----------------------------------------- */
const lazyElements = document.querySelectorAll(".lazy");

const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
        if (entry.isIntersecting) {
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
        const colorClass = isPriceChange ? 'change-up price-up' : 'change-up';
        return `<span class="${colorClass}">${icon}</span>`;
    } else if (changeValue < 0) {
        const icon = isPriceChange ? '▼' : '⬇️';
        const colorClass = isPriceChange ? 'change-down price-down' : 'change-down';
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

        // 3. Load dependent lists - we don't need to await them here, 
        // as the parent function awaits Promise.all on the critical, independent functions.
        // For robustness, ensure all these return the promise object, which they do as async functions.
        loadCurrentGameweekFixtures();
        loadPriceChanges(data);
        loadMostTransferred(data);
        loadMostTransferredOut(data);
        loadMostCaptained(data);
        loadPlayerStatusUpdates(data);
        processDeadlineDisplay(data); 
        loadSimpleEPLTable(data); 

        // CRITICAL: Return the data for parent function logic
        return data;

    } catch (err) {
        console.error("Error fetching FPL Bootstrap data:", err);
        const sections = ["price-changes-list", "most-transferred-list", "most-transferred-out-list", "most-captained-list", "fixtures-list", "status-list", "countdown-timer"];
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = "Failed to load data. Check FPL API/Proxy.";
        });
        throw err; // Re-throw to be caught by startDataLoadingAndTrackCompletion
    }
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
        
        // This is where the actual standings will go
        const standingsContent = document.createElement('div');
        standingsContent.classList.add('league-standings-content');
        
        leagueItem.appendChild(leagueHeader);
        leagueItem.appendChild(standingsContent);
        container.appendChild(leagueItem);

        // Add click listener to toggle the individual league standing content
        leagueHeader.addEventListener('click', () => {
            // Simple toggle for individual leagues
            standingsContent.classList.toggle('visible');
            leagueHeader.classList.toggle('active');
        });


        try {
            // Determine API endpoint based on league type (Classic or H2H)
            const apiEndpoint = leagueConfig.type === "H2H" 
                ? `https://fantasy.premierleague.com/api/leagues-h2h/${leagueConfig.id}/standings/`
                : `https://fantasy.premierleague.com/api/leagues-classic/${leagueConfig.id}/standings/`;

            const data = await fetch(
                proxy + apiEndpoint
            ).then((r) => r.json());

            // Check if the league has results
            const results = data.standings?.results;
            const loader = leagueHeader.querySelector('.loader-small');
            if (loader) loader.remove(); // Remove loader on success

            if (!results || results.length === 0) {
                standingsContent.innerHTML = `<p class="error-message">No teams found in this league.</p>`;
                return; // Exit this map iteration
            }

            // --- 2. Render Standings Table ---
            const list = document.createElement('ul');
            list.classList.add('standings-list-general'); // Use a specific class for styling

            results.forEach((team) => {
                // Get the HTML for rank change indicator using the helper function
                const rankChangeHtml = getChangeIconHtml(team.rank_change, false); 

                const listItem = document.createElement("li");
                listItem.innerHTML = `
                    <span class="rank-number">${team.rank}.</span> 
                    <span class="manager-name">${team.player_name} (${team.entry_name})</span> 
                    ${rankChangeHtml} <span><strong>${team.total}</strong> pts</span>
                `;

                if (team.rank === 1) listItem.classList.add("top-rank-general"); 
                
                list.appendChild(listItem);
            });

            standingsContent.appendChild(list);

        } catch (err) {
            console.error(`Error loading standings for ${leagueConfig.name}:`, err);
            const loader = leagueHeader.querySelector('.loader-small');
            if (loader) loader.remove();
            standingsContent.innerHTML = `<p class="error-message">❌ Failed to load standings for ${leagueConfig.name}.</p>`;
        }
    });
    
    // Wait for all league loads to finish before returning the overall promise
    await Promise.all(loadPromises);
}

/**
 * Loads and displays player status updates (Injured, Doubtful, Suspended)
 */
async function loadPlayerStatusUpdates(data) {
    const container = document.getElementById("status-list");
    if (!container || !data) return;

    container.innerHTML = ''; // Clear loading content

    try {
        // Filter players who are NOT fully available ('a') AND have a news message
        const unavailablePlayers = data.elements
            .filter(player =>
                player.status !== 'a' && player.news.trim().length > 0
            ).sort((a, b) => {
                // Sort by status: Injured (i) first, then Doubtful (d)
                return b.status.localeCompare(a.status);
            });

        if (unavailablePlayers.length === 0) {
            container.innerHTML = '<div class="player-news-item"><p class="no-data">🥳 All relevant players are currently available.</p></div>';
            return;
        }

        const newsHtml = unavailablePlayers.map(player => {
            const teamShortName = teamMap[player.team] || 'N/A';
            const fullName = `${player.first_name} ${player.second_name}`;
            
            let statusLabel = '';
            let statusClass = 'status-default';

            switch (player.status) {
                case 'd':
                    statusLabel = 'Doub