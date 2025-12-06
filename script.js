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
    LOADING OVERLAY REMOVAL
----------------------------------------- */
window.addEventListener("load", () => {
    setTimeout(() => {
        const overlay = document.getElementById("loading-overlay");

        if (overlay) {
            overlay.style.opacity = '0';
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 500);
        }
    }, 900);
});

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
            themeToggle.textContent = "🌙"; // Next is Dark Mode
            break;
        case 'cyan-theme':
            themeToggle.textContent = "✨"; // Next is Cyan Theme
            break;
        case 'red-theme':
            themeToggle.textContent = "🔴"; // Next is Red Theme
            break;
        case 'blue-theme':
            themeToggle.textContent = "🔵"; // Next is Blue Theme
            break;
        case '': // Next is Light Mode
        default:
            themeToggle.textContent = "☀️"; // Next is Light Mode
            break;
    }
}


// --- Initialization ---
let currentThemeIndex = getCurrentThemeIndex();
applyTheme(currentThemeIndex); // Apply the saved theme on load

// --- Toggle Logic ---
themeToggle.addEventListener("click", () => {
    // Increment the index, looping back to 0 (Light Mode) when exceeding the array length
    currentThemeIndex = (currentThemeIndex + 1) % themes.length;
    
    applyTheme(currentThemeIndex);
});

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
    loadFPLBootstrapData(); // Initializes all FPL-dependent data (and now loads the simple table)
    loadStandings();
});

/**
 * Fetches FPL bootstrap data, creates maps, and initializes dependent loads.
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
        // ⭐ NEW: Display the deadline time using the fetched data
        processDeadlineDisplay(data); 

        // 🏆 SIMPLIFIED EPL TABLE CALL (New Function)
        loadSimpleEPLTable(data); 

    } catch (err) {
        console.error("Error fetching FPL Bootstrap data:", err);
        const sections = ["price-changes-list", "most-transferred-list", "most-transferred-out-list", "most-captained-list", "fixtures-list", "status-list", "countdown-timer"];
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = "Failed to load data. Check FPL API/Proxy.";
        });
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

    for (const leagueConfig of leaguesToLoad) {
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
                continue; // Move to the next league in the loop
            }

            // --- 2. Render Standings Table ---
            const list = document.createElement('ul');
            list.classList.add('standings-list-general'); // Use a specific class for styling

            results.forEach((team) => {
                let rankChangeIndicator = '';
                let rankChangeClass = '';
                const rankChange = team.rank_change;

                if (rankChange > 0) {
                    rankChangeIndicator = `▲${rankChange}`;
                    rankChangeClass = 'rank-up';
                } else if (rankChange < 0) {
                    rankChangeIndicator = `▼${Math.abs(rankChange)}`;
                    rankChangeClass = 'rank-down';
                } else {
                    rankChangeIndicator = '';
                    rankChangeClass = 'rank-unchanged';
                }

                const listItem = document.createElement("li");
                listItem.innerHTML = `
                    <span class="rank-number">${team.rank}.</span> 
                    <span class="manager-name">${team.player_name} (${team.entry_name})</span> 
                    <span class="rank-change ${rankChangeClass}">${rankChangeIndicator}</span> 
                    <span><strong>${team.total}</strong> pts</span>
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
    }
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
                const redCardsData = e