/* -----------------------------------------
    GLOBAL SETUP
----------------------------------------- */
// Using the more reliable proxy for cross-origin requests
const proxy = "https://corsproxy.io/?";

// Global variables initialized at the top
let teamMap = {};    // Team ID -> Abbreviation (e.g., 1 -> 'ARS')
let playerMap = {};  // Player ID -> Full Name
let currentGameweekId = null;

// The following elements are NO LONGER global constants.
// They will be looked up locally inside the functions below.

/* -----------------------------------------
    NEW: TEAM ID CHECKER LOGIC
----------------------------------------- */

/**
 * Resets the display fields for the Player Data Checker section.
 */
function resetCheckerDisplay() {
    // Lookup elements locally (safely)
    const teamIdInput = document.getElementById('team-id-input');
    const teamPlayerName = document.getElementById('team-player-name');
    const netPointsDisplay = document.getElementById('net-points');
    const transfersMadeDisplay = document.getElementById('transfers-made');
    const liveRankDisplay = document.getElementById('live-rank');

    if (teamIdInput) teamIdInput.value = '';
    if (teamPlayerName) teamPlayerName.innerText = 'Team name (Player name)';
    if (netPointsDisplay) netPointsDisplay.innerText = '-';
    if (transfersMadeDisplay) transfersMadeDisplay.innerText = '-';
    if (liveRankDisplay) liveRankDisplay.innerText = '-';
}

/**
 * Fetches and displays the FPL manager's data (Team Name, GW Points, Transfers).
 * @param {number} managerId - The FPL manager's team ID.
 */
async function fetchManagerData(managerId) {
    if (!currentGameweekId) {
        alert('Gameweek data is not yet loaded. Please wait for the dashboard to finish loading.');
        return;
    }
    
    // Lookup elements locally (safely)
    const teamPlayerName = document.getElementById('team-player-name');
    const netPointsDisplay = document.getElementById('net-points');
    const transfersMadeDisplay = document.getElementById('transfers-made');
    const liveRankDisplay = document.getElementById('live-rank');

    // Clear previous results and show loading state
    if (teamPlayerName) teamPlayerName.innerText = 'Loading...';
    if (netPointsDisplay) netPointsDisplay.innerText = '...';
    if (transfersMadeDisplay) transfersMadeDisplay.innerText = '...';
    if (liveRankDisplay) liveRankDisplay.innerText = '...';

    try {
        // 1. Fetch Manager's general info (Team Name and Player Name)
        const entryUrl = `https://fantasy.premierleague.com/api/entry/${managerId}/`;
        const entryResponse = await fetch(proxy + entryUrl);
        const entryData = await entryResponse.json();

        const teamName = entryData.name || 'Unknown Team';
        const playerName = entryData.player_first_name + ' ' + entryData.player_last_name || 'Unknown Player';
        if (teamPlayerName) teamPlayerName.innerText = `${teamName} (${playerName})`;

        // 2. Fetch Manager's Picks for the Current Gameweek to get points/transfers
        const picksUrl = `https://fantasy.premierleague.com/api/entry/${managerId}/event/${currentGameweekId}/picks/`;
        const picksResponse = await fetch(proxy + picksUrl);
        const picksData = await picksResponse.json();

        const gwData = picksData.entry_history;
        const points = gwData.points || 0; 
        const transfers = gwData.event_transfers || 0; 

        if (netPointsDisplay) netPointsDisplay.innerText = points;
        if (transfersMadeDisplay) transfersMadeDisplay.innerText = transfers;
        if (liveRankDisplay) liveRankDisplay.innerText = '-'; 

    } catch (error) {
        console.error(`Error fetching FPL data for ID ${managerId}:`, error);
        if (teamPlayerName) teamPlayerName.innerText = 'Error (Check ID)';
        if (netPointsDisplay) netPointsDisplay.innerText = 'N/A';
        if (transfersMadeDisplay) transfersMadeDisplay.innerText = 'N/A';
        if (liveRankDisplay) liveRankDisplay.innerText = 'N/A';
        alert('Could not fetch data. Please ensure the FPL Team ID is correct or the API is available.');
    }
}

/**
 * Sets up event listeners for the new checker feature.
 * CRITICAL FIX: Elements are looked up here when the DOM is guaranteed to be ready.
 */
function initializeChecker() {
    // Lookup elements locally (safely)
    const teamIdInput = document.getElementById('team-id-input');
    const goButton = document.getElementById('go-btn');
    const resetButton = document.getElementById('reset-btn');
    
    // resetCheckerDisplay(); // Called at the end of this function now

    if (goButton && teamIdInput) { // Note: Removed 'resetButton' from check since it might not exist in HTML
        // Initially disable button until currentGameweekId is available
        goButton.disabled = true;
        goButton.innerText = 'Loading...';

        // Listener for the 'Go' button
        goButton.addEventListener('click', () => {
            const teamId = teamIdInput.value.trim();
            
            if (teamId && !isNaN(parseInt(teamId))) {
                fetchManagerData(parseInt(teamId));
            } else {
                alert('Please enter a valid FPL Team ID (a number).');
                resetCheckerDisplay();
            }
        });

        // Listener for the 'Reset' button (if it exists)
        if (resetButton) {
            resetButton.addEventListener('click', resetCheckerDisplay);
        }
    }
    // Initialize display state
    resetCheckerDisplay();
}

/* -----------------------------------------
    LOADER MANAGEMENT
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
    // Look up the button here (safely) before the initial load logic
    const goButton = document.getElementById('go-btn');
    
    try {
        // 1. Start the crucial bootstrap data load first.
        await loadFPLBootstrapData();
        
        // FIX: Now that currentGameweekId is set, enable the checker button.
        if (goButton) {
            goButton.disabled = false;
            goButton.innerText = 'Go';
        }

        // 2. Start all other independent loads simultaneously and wait for ALL.
        await Promise.all([
            loadStandings(),
            loadGeneralLeagueStandings(),
            // All other dependent functions (like price changes, etc.) are called and started inside loadFPLBootstrapData
        ]);

        // 3. Ensure a minimum display time for the loader (e.g., 500ms) before hiding.
        await new Promise(resolve => setTimeout(resolve, 500));
        
        hideLoadingOverlay();

    } catch (err) {
        console.error("Critical loading failed:", err);
        // Ensure the loader is hidden even if the load fails, so the error messages are visible.
        hideLoadingOverlay();
        // Disable checker button on failure
        if (goButton) {
            goButton.disabled = true;
            goButton.innerText = 'Error';
        }
    }
}


/* -----------------------------------------
    LIGHT / DARK / MULTI-COLOR MODE TOGGLE + SAVE
----------------------------------------- */
const themeToggle = document.getElementById("themeToggle");
const body = document.body;

// Define the list of theme classes in the desired cycle order
const themes = [
    '',             // 1. Light Mode (No class)
    'dark-mode',    // 2. Dark Mode
    'cyan-theme',   // 3. Cyan/Green Theme
    'red-theme',    // 4. Red/Black Theme
    'blue-theme'    // 5. FPL Blue Theme
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
    // The icon is set to represent the NEXT theme in the cycle.
    const nextThemeIndex = (index + 1) % themes.length;
    const nextTheme = themes[nextThemeIndex];

    switch (nextTheme) {
        case 'dark-mode':
            if (themeToggle) themeToggle.textContent = "🌙"; // Next is Dark Mode
            break;
        case 'cyan-theme':
            if (themeToggle) themeToggle.textContent = "✨"; // Next is Cyan Theme
            break;
        case 'red-theme':
            if (themeToggle) themeToggle.textContent = "🔴"; // Next is Red Theme
            break;
        case 'blue-theme':
            if (themeToggle) themeToggle.textContent = "🔵"; // Next is Blue Theme
            break;
        case '': // Next is Light Mode
        default:
            if (themeToggle) themeToggle.textContent = "☀️"; // Next is Light Mode
            break;
    }
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
    NAVIGATION MENU TOGGLES
----------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    const kebab = document.querySelector('.kebab');
    const kebabMenu = document.querySelector('.kebab-menu-dropdown');

    // 1. Hamburger Menu Toggle Logic
    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            if (kebabMenu) {
                kebabMenu.classList.remove('active');
            }

            const hamburgerIcon = hamburger.querySelector('i');
            if (hamburgerIcon) {
                if (navLinks.classList.contains('active')) {
                    hamburgerIcon.classList.remove('fa-bars');
                    hamburgerIcon.classList.add('fa-xmark');
                    hamburger.setAttribute('aria-label', 'Close Main Menu');
                } else {
                    hamburgerIcon.classList.remove('fa-xmark');
                    hamburgerIcon.classList.add('fa-bars');
                    hamburger.setAttribute('aria-label', 'Open Main Menu');
                }
            }
        });
    }

    // 2. Kebab Menu Toggle Logic
    if (kebab && kebabMenu) {
        kebab.addEventListener('click', (event) => {
            kebabMenu.classList.toggle('active');

            if (navLinks) {
                navLinks.classList.remove('active');

                const hamburgerIcon = hamburger.querySelector('i');
                if (hamburgerIcon) {
                    hamburgerIcon.classList.remove('fa-xmark');
                    hamburgerIcon.classList.add('fa-bars');
                    hamburger.setAttribute('aria-label', 'Open Main Menu');
                }
            }
            event.stopPropagation();
        });
    }

    // 3. Close menus when clicking outside
    document.addEventListener('click', (event) => {
        if (kebabMenu && !kebabMenu.contains(event.target) && event.target !== kebab && !kebab.contains(event.target)) {
            kebabMenu.classList.remove('active');
        }

        if (navLinks && event.target.closest('.nav-links a')) {
             navLinks.classList.remove('active');

             const hamburgerIcon = hamburger.querySelector('i');
             if (hamburgerIcon) {
                 hamburgerIcon.classList.remove('fa-xmark');
                 hamburgerIcon.classList.add('fa-bars');
                 hamburger.setAttribute('aria-label', 'Open Main Menu');
             }
        }
    });

    // Back to Top/Bottom Buttons
    const backToTop = document.getElementById('backToTop');
    const scrollToBottom = document.getElementById('scrollToBottom');

    const toggleVisibility = () => {
        if (window.scrollY > 300) {
            if (backToTop) backToTop.style.display = 'flex';
        } else {
            if (backToTop) backToTop.style.display = 'none';
        }
        
        // Show scroll-to-bottom only if we are not already near the bottom
        const nearBottom = (window.innerHeight + window.scrollY) >= document.body.offsetHeight - 50;
        if (nearBottom) {
             if (scrollToBottom) scrollToBottom.style.display = 'none';
        } else {
             if (scrollToBottom) scrollToBottom.style.display = 'flex';
        }
    };

    window.addEventListener('scroll', toggleVisibility);
    toggleVisibility(); // Initial check

    if (backToTop) {
        backToTop.addEventListener('click', () => {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
    }
    
    if (scrollToBottom) {
        scrollToBottom.addEventListener('click', () => {
            window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
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
    // NEW: Initialize the checker feature listeners (which looks up the elements safely)
    initializeChecker();
    
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

        // 3. Load dependent lists
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
                    statusLabel = 'Doubtful';
                    statusClass = 'status-doubtful';
                    break;
                case 'i':
                    statusLabel = 'Injured';
                    statusClass = 'status-injured';
                    break;
                case 's':
                    statusLabel = 'Suspended';
                    statusClass = 'status-injured';
                    break;
                case 'u':
                    statusLabel = 'Unavailable';
                    statusClass = 'status-unavailable';
                    break;
                default:
                    statusLabel = 'Uncertain';
                    break;
            }

            return `
                <div class="player-news-item">
                    <div class="player-info">
                        <strong>${fullName} (${teamShortName})</strong>
                        <span class="status-badge ${statusClass}">${statusLabel}</span>
                    </div>
                    <p class="news-detail">${player.news}</p>
                </div>
            `;
        }).join('');

        container.innerHTML = newsHtml;

    } catch (error) {
        console.error("Failed to load player status updates:", error);
        container.innerHTML = '<p class="error-message">❌ Could not load player status updates. Check FPL API/Proxy.</p>';
    }
}


// 📅 CURRENT GAMEWEEK FIXTURES
async function loadCurrentGameweekFixtures() {
    const container = document.getElementById("fixtures-list");
    if (!container) return;

    if (!currentGameweekId) {
        container.innerHTML = "<h3>Gameweek Scores</h3><p>Current Gameweek information is not yet available.</p>";
        return;
    }

    try {
        const data = await fetch(
            proxy + "https://fantasy.premierleague.com/api/fixtures/"
        ).then((r) => r.json());

        const currentGWFixtures = data.filter(f => f.event === currentGameweekId);

        if (currentGWFixtures.length === 0) {
            container.innerHTML = `<h3>Gameweek ${currentGameweekId} Scores</h3><p>No fixtures found for Gameweek ${currentGameweekId}.</p>`;
            return;
        }

        container.innerHTML = `<h3>Gameweek ${currentGameweekId} Scores</h3>`;

        const list = document.createElement('ul');
        list.classList.add('fixtures-list-items');

        currentGWFixtures.forEach(fixture => {
            const homeTeamAbbr = teamMap[fixture.team_h] || `T${fixture.team_h}`;
            const awayTeamAbbr = teamMap[fixture.team_a] || `T${fixture.team_a}`;

            let scoreDisplay = `<span class="vs-label">vs</span>`;
            let statusClass = 'match-pending';
            let statusText = 'Upcoming';

            if (fixture.finished) {
                scoreDisplay = `<span class="score-home">${fixture.team_h_score}</span> : <span class="score-away">${fixture.team_a_score}</span>`;
                statusClass = 'match-finished';
                statusText = 'Finished';
            } else if (fixture.started) {
                scoreDisplay = `<span class="score-home">${fixture.team_h_score}</span> : <span class="score-away">${fixture.team_a_score}</span>`;
                statusClass = 'match-live';
                statusText = 'Live';
            } else {
                const kickoffTime = new Date(fixture.kickoff_time);
                scoreDisplay = `<span class="vs-label-time">${kickoffTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;
            }

            const listItem = document.createElement('li');
            listItem.classList.add(statusClass);

            listItem.innerHTML = `
                <div class="fixture-summary">
                    <span class="fixture-team home-team">
                        <span class="team-label home-label">${homeTeamAbbr}</span>    
                    </span>    
                    ${scoreDisplay}
                    <span class="fixture-team away-team">
                        <span class="team-label away-label">${awayTeamAbbr}</span>    
                    </span>
                    <span class="match-status-tag">${statusText}</span>
                </div>
            `;

            let actionHtml = '';
            let hasDetails = false;

            if (fixture.started) {
                const stats = fixture.stats || [];

                const extractStats = (identifier) => {
                    const stat = stats.find(s => s.identifier === identifier);
                    return stat ? (stat.a || []).concat(stat.h || []) : [];
                };

                const goalsData = extractStats('goals_scored');
                const assistsData = extractStats('assists');
                const redCardsData = extractStats('red_cards');

                const allActions = [];

                const processActions = (actionArray, type) => {
                    actionArray.forEach(action => {
                        const playerName = playerMap[action.element] || `Player ${action.element}`;
                        for (let i = 0; i < action.value; i++) {
                            allActions.push({ type: type, name: playerName });
                        }
                    });
                };

                processActions(goalsData, 'goal');
                processActions(assistsData, 'assist');
                processActions(redCardsData, 'red_card');

                if (allActions.length > 0) {
                    hasDetails = true;
                    const groupedActions = allActions.reduce((acc, action) => {
                        if (!acc[action.type]) acc[action.type] = new Set();
                        acc[action.type].add(action.name);
                        return acc;
                    }, {});

                    actionHtml += '<div class="fixture-details">';

                    if (groupedActions.goal) {
                        actionHtml += `<p><span class="action-label action-goal">⚽ Goals:</span> ${Array.from(groupedActions.goal).join(', ')}</p>`;
                    }
                    if (groupedActions.assist) {
                        actionHtml += `<p><span class="action-label action-assist">👟 Assists:</span> ${Array.from(groupedActions.assist).join(', ')}</p>`;
                    }
                    if (groupedActions.red_card) {
                        actionHtml += `<p><span class="action-label action-red-card">🟥 Red Cards:</span> ${Array.from(groupedActions.red_card).join(', ')}</p>`;
                    }

                    actionHtml += '</div>';
                }
            }

            if (hasDetails) {
                listItem.innerHTML += actionHtml;
                listItem.classList.add('has-details');
            }

            list.appendChild(listItem);
        });

        container.appendChild(list);

    } catch (err) {
        console.error("Error loading fixtures:", err);
        container.textContent = "Failed to load fixtures data. Check FPL API/Proxy.";
    }
}


// MINI-LEAGUE STANDINGS
async function loadStandings() {
    const container = document.getElementById("standings-list");
    if (!container) return;
    try {
        const leagueID = "101712";
        const data = await fetch(
            proxy + `https://fantasy.premierleague.com/api/leagues-classic/${leagueID}/standings/`
        ).then((r) => r.json());

        container.innerHTML = "";
        data.standings.results.forEach((team, index) => {
            // Using setTimeout for staggered reveal, but note this doesn't block the loader
            setTimeout(() => {
                // Use the helper function for dynamic rank change arrows
                const rankChangeHtml = getChangeIconHtml(team.rank_change, false);

                const div = document.createElement("div");
                div.classList.add("standing-row");
                div.innerHTML = `<span class="rank-number">${team.rank}.</span> <span class="manager-name">${team.player_name} (${team.entry_name})</span> ${rankChangeHtml} <span>${team.total} pts</span>`;

                if (team.rank === 1) div.classList.add("top-rank");
                else if (team.rank === 2) div.classList.add("second-rank");
                else if (team.rank === 3) div.classList.add("third-rank");

                container.appendChild(div);
            }, index * 30);
        });
    } catch (err) {
        console.error("Error loading standings:", err);
        container.textContent = "Failed to load standings. Check league ID or proxy.";
    }
}

// 💰 FPL PRICE CHANGES 
async function loadPriceChanges(data) {
    const container = document.getElementById("price-changes-list");
    if (!container || !data) return;

    const priceChangedPlayers = data.elements
        .filter(p => p.cost_change_event !== 0)
        .sort((a, b) => b.cost_change_event - a.cost_change_event);

    container.innerHTML = "<h3>Price Risers and Fallers (Since GW Deadline) 📈📉</h3>";

    priceChangedPlayers.forEach((p, index) => {
        setTimeout(() => {
            const div = document.createElement("div");
            
            // Calculate change in millions (cost_change_event is in pence/10)
            const changeInMillions = p.cost_change_event / 10;    
            
            // Use the helper function for dynamic price change arrows
            const priceChangeHtml = getChangeIconHtml(changeInMillions, true);
            
            const playerPrice = (p.now_cost / 10).toFixed(1);
            const teamAbbreviation = teamMap[p.team] || 'N/A';

            div.classList.add("price-change-row");
            div.innerHTML = `
                <span class="player-name">${p.first_name} ${p.second_name} (${teamAbbreviation})</span>    
                <span class="price-change-value">${priceChangeHtml} ${Math.abs(changeInMillions).toFixed(1)}m</span>
                <span class="player-price">£${playerPrice}m</span>
            `;

            if (changeInMillions > 0) {
                div.classList.add("riser");
            } else {
                div.classList.add("faller");
            }
            
            container.appendChild(div);
        }, index * 30);
    });
}


// MOST TRANSFERRED IN PLAYERS
async function loadMostTransferred(data) {
    const container = document.getElementById("most-transferred-list");
    if (!container || !data) return;

    // Filter and sort by transfers_in_event (transfers made for the current GW)
    const topTransfers = data.elements
        .sort((a, b) => b.transfers_in_event - a.transfers_in_event)
        .slice(0, 5); // Get top 5

    container.innerHTML = "<h3>Most Transferred **IN** This Gameweek ⬆️</h3>";

    topTransfers.forEach((p, index) => {
        setTimeout(() => {
            const div = document.createElement("div");
            const teamAbbreviation = teamMap[p.team] || 'N/A';
            const transfers = (p.transfers_in_event / 1000).toFixed(1); // Convert to thousands

            div.classList.add("transfer-row");
            div.innerHTML = `
                <span class="rank-number">${index + 1}.</span> 
                <span class="player-name">${p.web_name} (${teamAbbreviation})</span> 
                <span class="transfer-count">${transfers}k</span>
            `;
            container.appendChild(div);
        }, index * 30);
    });
}

// MOST TRANSFERRED OUT PLAYERS
async function loadMostTransferredOut(data) {
    const container = document.getElementById("most-transferred-out-list");
    if (!container || !data) return;

    // Filter and sort by transfers_out_event
    const topTransfersOut = data.elements
        .sort((a, b) => b.transfers_out_event - a.transfers_out_event)
        .slice(0, 5); // Get top 5

    container.innerHTML = "<h3>Most Transferred **OUT** This Gameweek ⬇️</h3>";

    topTransfersOut.forEach((p, index) => {
        setTimeout(() => {
            const div = document.createElement("div");
            const teamAbbreviation = teamMap[p.team] || 'N/A';
            const transfers = (p.transfers_out_event / 1000).toFixed(1); // Convert to thousands

            div.classList.add("transfer-row");
            div.innerHTML = `
                <span class="rank-number">${index + 1}.</span> 
                <span class="player-name">${p.web_name} (${teamAbbreviation})</span> 
                <span class="transfer-count">${transfers}k</span>
            `;
            container.appendChild(div);
        }, index * 30);
    });
}

// MOST CAPTAINED PLAYERS
async function loadMostCaptained(data) {
    const container = document.getElementById("most-captained-list");
    if (!container || !data) return;

    // Filter and sort by selected_by_percent
    const topCaptains = data.elements
        .sort((a, b) => b.selected_by_percent - a.selected_by_percent)
        .slice(0, 5); // Get top 5

    container.innerHTML = "<h3>Most Captained (Ownership %) 👑</h3>";

    topCaptains.forEach((p, index) => {
        setTimeout(() => {
            const div = document.createElement("div");
            const teamAbbreviation = teamMap[p.team] || 'N/A';

            div.classList.add("captain-row");
            div.innerHTML = `
                <span class="rank-number">${index + 1}.</span> 
                <span class="player-name">${p.web_name} (${teamAbbreviation})</span> 
                <span class="ownership-percent">${p.selected_by_percent}%</span>
            `;
            container.appendChild(div);
        }, index * 30);
    });
}

// DEADLINE COUNTDOWN TIMER
function processDeadlineDisplay(data) {
    const container = document.getElementById("deadline-section");
    const title = container ? container.querySelector(".countdown-title") : null;
    const timerDisplay = document.getElementById("countdown-timer");

    if (!timerDisplay || !data || !data.events) return;

    // Find the next upcoming deadline
    const nextEvent = data.events.find(e => !e.finished);

    if (!nextEvent) {
        if (title) title.textContent = "Season Finished!";
        timerDisplay.innerHTML = `<p>The Premier League season has concluded.</p>`;
        return;
    }

    const deadlineTime = new Date(nextEvent.deadline_time);
    const deadlineString = deadlineTime.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + " " +
                           deadlineTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (title) title.textContent = `⏳ GW ${nextEvent.id} Deadline: ${deadlineString}`;

    // Update the countdown every second
    const updateCountdown = () => {
        const now = new Date().getTime();
        const distance = deadlineTime.getTime() - now;

        if (distance < 0) {
            timerDisplay.innerHTML = `<p class="deadline-passed">🔴 DEADLINE PASSED</p>`;
            clearInterval(timerInterval);
            // Optionally, reload data after a period if deadline just passed
            return;
        }

        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        timerDisplay.innerHTML = `
            <div><span class="countdown-value">${days}</span><span class="countdown-label">Days</span></div>
            <div><span class="countdown-value">${hours}</span><span class="countdown-label">Hours</span></div>
            <div><span class="countdown-value">${minutes}</span><span class="countdown-label">Mins</span></div>
            <div><span class="countdown-value">${seconds}</span><span class="countdown-label">Secs</span></div>
        `;
    };

    updateCountdown(); // Call immediately to avoid initial flicker
    const timerInterval = setInterval(updateCountdown, 1000);
}


// SIMPLE EPL TABLE (using team stats from bootstrap)
function loadSimpleEPLTable(data) {
    const container = document.getElementById("epl-table-list");
    if (!container || !data || !data.teams) return;

    const tableTeams = data.teams
        .sort((a, b) => b.points - a.points); // Sort by total points (this is standard)

    container.innerHTML = "<h3>EPL Table (Quick Glance) 🏟️</h3>";
    
    const table = document.createElement('table');
    table.classList.add('epl-table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>#</th>
                <th>Team</th>
                <th>P</th>
                <th>W</th>
                <th>D</th>
                <th>L</th>
                <th>Pts</th>
            </tr>
        </thead>
        <tbody>
        </tbody>
    `;
    const tbody = table.querySelector('tbody');

    tableTeams.forEach((team, index) => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${index + 1}</td>
            <td>${team.name}</td>
            <td>${team.played}</td>
            <td>${team.win}</td>
            <td>${team.draw}</td>
            <td>${team.loss}</td>
            <td>${team.points}</td>
        `;
        tbody.appendChild(row);
    });

    container.appendChild(table);
}
