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
    loadGeneralLeagueStandings(); // Ensure this is loaded (even if collapsible)
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
                <span class="player-price">£${playerPrice}m</span> 
                ${priceChangeHtml}
            `;

            container.appendChild(div);
        }, index * 20);
    });
}

// ➡️ MOST TRANSFERRED IN 
async function loadMostTransferred(data) {
    const container = document.getElementById("most-transferred-list");
    if (!container || !data) return;

    const topTransferred = data.elements
        .sort((a, b) => b.transfers_in_event - a.transfers_in_event)
        .slice(0, 10);

    container.innerHTML = "<h3>Most Transferred In (This GW) ➡️</h3>";

    topTransferred.forEach((p, index) => {
        setTimeout(() => {
            const div = document.createElement("div");
            const transfers = p.transfers_in_event.toLocaleString();
            const playerPrice = (p.now_cost / 10).toFixed(1);

            const teamAbbreviation = teamMap[p.team] || 'N/A';

            div.textContent = `${index + 1}. ${p.first_name} ${p.second_name} (${teamAbbreviation}) (£${playerPrice}m) - ${transfers} transfers`;

            container.appendChild(div);
        }, index * 30);
    });
}

// ⬅️ MOST TRANSFERRED OUT 
async function loadMostTransferredOut(data) {
    const container = document.getElementById("most-transferred-out-list");
    if (!container || !data) return;

    const topTransferredOut = data.elements
        .sort((a, b) => b.transfers_out_event - a.transfers_out_event)
        .slice(0, 10);

    container.innerHTML = "<h3>Most Transferred Out (This GW) ⬅️</h3>";

    topTransferredOut.forEach((p, index) => {
        setTimeout(() => {
            const div = document.createElement("div");
            const transfers = p.transfers_out_event.toLocaleString();
            const playerPrice = (p.now_cost / 10).toFixed(1);

            const teamAbbreviation = teamMap[p.team] || 'N/A';

            div.textContent = `${index + 1}. ${p.first_name} ${p.second_name} (${teamAbbreviation}) (£${playerPrice}m) - ${transfers} transfers out`;

            div.classList.add("transferred-out");

            container.appendChild(div);
        }, index * 30);
    });
}


// ©️ MOST CAPTAINED PLAYER 
async function loadMostCaptained(data) {
    const container = document.getElementById("most-captained-list");
    if (!container || !data) return;

    const currentEvent = data.events.find(e => e.is_next || e.is_current);

    if (!currentEvent || !currentEvent.most_captained) {
        container.textContent = "Captain data not yet available for this Gameweek.";
        return;
    }

    const mostCaptainedId = currentEvent.most_captained;

    const captain = data.elements.find(p => p.id === mostCaptainedId);

    if (!captain) {
        container.textContent = "Could not find the most captained player.";
        return;
    }

    const playerPrice = (captain.now_cost / 10).toFixed(1);
    const captaincyPercentage = captain.selected_by_percent; // Use player-specific data if event-specific data is missing

    const teamAbbreviation = teamMap[captain.team] || 'N/A';

    container.innerHTML = "<h3>Most Captained Player (This GW) ©️</h3>";

    const div = document.createElement("div");
    div.textContent = `${captain.first_name} ${captain.second_name} (${teamAbbreviation}) (£${playerPrice}m) - ${captaincyPercentage}%`;
    div.classList.add("top-rank");

    container.appendChild(div);
}


// 🥇 CURRENT EPL TABLE (STANDINGS) - Simplified FPL Data Only
/**
 * Loads and displays a simplified EPL Table using only FPL Bootstrap data.
 * @param {object} data - The full data object from FPL bootstrap-static.
 */
async function loadSimpleEPLTable(data) {
    const container = document.getElementById("epl-table-list");
    if (!container || !data || !data.teams) return;

    // FPL team data already contains standings information (position, points, etc.)
    // We sort the teams by their current league position.
    const sortedTeams = data.teams.sort((a, b) => a.position - b.position);

    container.innerHTML = "<h3>Current Premier League Standings 🏆 (FPL Data)</h3>";

    const table = document.createElement('table');
    table.classList.add('simple-epl-table');
    table.innerHTML = `
        <thead>
            <tr>
                <th>#</th>
                <th class="team-name-header">Team</th>
                <th>Pl</th>
                <th>W</th>
                <th>L</th>
                <th>Pts</th>
            </tr>
        </thead>
        <tbody>
        </tbody>
    `;
    const tbody = table.querySelector('tbody');

    sortedTeams.forEach((team) => {
        const row = tbody.insertRow();
        
        // Determine coloring based on position (rank) - uses FPL's fields
        let rowClass = '';
        if (team.position <= 4) {
            rowClass = "champions-league";
        } else if (team.position === 5) {
            rowClass = "europa-league";
        } else if (team.position >= 18) {
            rowClass = "relegation-zone";
        }

        if(rowClass) row.classList.add(rowClass);

        row.innerHTML = `
            <td>${team.position}</td>
            <td class="team-name">${team.name}</td>
            <td>${team.played}</td>
            <td>${team.win}</td>
            <td>${team.loss}</td>
            <td><strong>${team.points}</strong></td>
        `;
    });

    container.appendChild(table);
}


/* -----------------------------------------
    DEADLINE COUNTDOWN
----------------------------------------- */
/**
 * Processes the FPL event data to find the next deadline and display a countdown.
 * @param {object} data - The full FPL bootstrap-static data.
 */
function processDeadlineDisplay(data) {
    const deadlineSection = document.getElementById("deadline-section");
    const titleElement = deadlineSection.querySelector(".countdown-title");
    const timerElement = document.getElementById("countdown-timer");
    
    // Find the NEXT event (Gameweek) that is NOT finished.
    const nextEvent = data.events.find(e => e.is_next);

    if (!nextEvent) {
        titleElement.textContent = "Deadline Info Unavailable";
        timerElement.innerHTML = `<p>No upcoming gameweek found.</p>`;
        return;
    }

    const deadlineTime = new Date(nextEvent.deadline_time);
    const gameweekNumber = nextEvent.id;

    titleElement.textContent = `⏳ Gameweek ${gameweekNumber} Deadline`;
    timerElement.innerHTML = `
        <div class="countdown-label">Time Remaining:</div>
        <div class="countdown-display-time" id="countdown-time-value">Loading...</div>
        <div class="countdown-kickoff">Kickoff: ${deadlineTime.toLocaleDateString()} at ${deadlineTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
    `;

    const countdownValueElement = document.getElementById('countdown-time-value');

    // Update the countdown every second
    const updateCountdown = setInterval(() => {
        const now = new Date().getTime();
        const distance = deadlineTime.getTime() - now;

        if (distance < 0) {
            clearInterval(updateCountdown);
            countdownValueElement.innerHTML = "DEADLINE PASSED!";
            titleElement.textContent = `✅ Gameweek ${gameweekNumber} Started!`;
            return;
        }

        // Calculations for days, hours, minutes and seconds
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((distance % (1000 * 60)) / 1000);

        countdownValueElement.innerHTML = `
            <span class="countdown-unit">${days}d</span> 
            <span class="countdown-unit">${hours}h</span> 
            <span class="countdown-unit">${minutes}m</span> 
            <span class="countdown-unit">${seconds}s</span>
        `;
    }, 1000);
}


/* -----------------------------------------
    RANK/PRICE CHANGE ARROW UTILITY (NEW)
----------------------------------------- */
/**
 * Generates the HTML string for a rank/price change icon and value, 
 * incorporating the up/down arrows based on the change value.
 * @param {number} changeValue - The magnitude of the change (e.g., 5, -2, 0).
 * @param {boolean} isPriceChange - If true, formats the value as currency (£X.Xm).
 * @returns {string} The complete HTML string for the rank change span.
 */
function getChangeIconHtml(changeValue, isPriceChange = false) {
    const magnitude = Math.abs(changeValue); 
    
    let displayValue = '';
    let iconHtml = '';
    let containerClass = 'rank-change'; 
    
    if (changeValue > 0) {
        // Rank Up / Price Riser
        displayValue = isPriceChange ? `£${magnitude.toFixed(1)}m` : magnitude;
        // Unicode UPWARDS ARROW: &#x2191;
        iconHtml = `<span class="rank-change-icon rank-up-arrow">&#x2191;</span>`;
        if (isPriceChange) {
            containerClass += ' price-riser';
        }
    } else if (changeValue < 0) {
        // Rank Down / Price Faller
        displayValue = isPriceChange ? `£${magnitude.toFixed(1)}m` : magnitude; 
        // Unicode DOWNWARDS ARROW: &#x2193;
        iconHtml = `<span class="rank-change-icon rank-down-arrow">&#x2193;</span>`;
        if (isPriceChange) {
            containerClass += ' price-faller';
        }
    } else {
        // No Change
        displayValue = isPriceChange ? `£0.0m` : ''; 
        // Unicode EM DASH: &#x2014;
        iconHtml = `<span class="rank-change-icon rank-no-change">&#x2014;</span>`;
    }

    // Return the combined HTML structure
    return `<span class="${containerClass}">${displayValue} ${iconHtml}</span>`;
}


/* -----------------------------------------
    SCROLL UP / SCROLL DOWN BUTTONS (MODIFIED)
----------------------------------------- */
// IMPORTANT: These assume you updated your HTML with both buttons and Font Awesome icons.
const backToTopBtn = document.getElementById("backToTop");
const scrollToBottomBtn = document.getElementById("scrollToBottom"); 

// --- Event Listeners ---
if (backToTopBtn) {
    backToTopBtn.addEventListener("click", () => {
        // Scrolls smoothly to the very top (y=0)
        window.scrollTo({ 
            top: 0, 
            behavior: "smooth" 
        });
    });
}

if (scrollToBottomBtn) {
    scrollToBottomBtn.addEventListener("click", () => {
        // Scrolls smoothly to the very bottom of the document
        window.scrollTo({ 
            top: document.body.scrollHeight || document.documentElement.scrollHeight, 
            behavior: "smooth" 
        });
    });
}


// --- Visibility Logic on Scroll ---
window.addEventListener("scroll", () => {
    // 1. Logic for SCROLL UP / BACK TO TOP
    if (backToTopBtn) {
        // Show button if the user has scrolled more than 200px down
        if (window.scrollY > 200) {
            backToTopBtn.style.display = "flex";
        } else {
            backToTopBtn.style.display = "none";
        }
    }

    // 2. Logic for SCROLL TO BOTTOM
    if (scrollToBottomBtn) {
        const scrollHeight = document.documentElement.scrollHeight; // Total document height
        const clientHeight = document.documentElement.clientHeight; // Viewport height
        const scrollTop = document.documentElement.scrollTop;      // Distance scrolled from top

        // Determine how far from the bottom the user is
        const distanceFromBottom = scrollHeight - (scrollTop + clientHeight);
        
        // Hide 'Scroll Down' button if the user is within 150px of the bottom
        if (distanceFromBottom < 150) {
            scrollToBottomBtn.style.display = "none";
        } else {
            // Show the 'Scroll Down' button if it's currently hidden and not near the top
            // Also ensure it is visible if the Scroll Up button is visible (optional check)
            scrollToBottomBtn.style.display = "flex"; 
        }
    }
});



/* -----------------------------------------
    PLAYER STATUS SEARCH/FILTER
----------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('statusSearch');
    const statusList = document.getElementById('status-list');

    if (searchInput && statusList) {
        searchInput.addEventListener('input', (event) => {
            const searchTerm = event.target.value.toLowerCase();
            const items = statusList.querySelectorAll('.player-news-item');

            items.forEach(item => {
                // Get all text content from the item for comprehensive searching
                const itemText = item.textContent.toLowerCase();

                if (itemText.includes(searchTerm)) {
                    item.style.display = 'block'; // Show the item
                } else {
                    item.style.display = 'none'; // Hide the item
                }
            });
             
             // The rest of your code here:
             // ...
        });
    }
});
