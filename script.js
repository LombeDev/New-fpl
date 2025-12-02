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
    LIGHT / DARK MODE TOGGLE + SAVE
----------------------------------------- */
const themeToggle = document.getElementById("themeToggle");

// Load saved preference
if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark-mode");
    themeToggle.textContent = "☀️";
}

// Toggle on click
themeToggle.addEventListener("click", () => {
    document.body.classList.toggle("dark-mode");

    if (document.body.classList.contains("dark-mode")) {
        themeToggle.textContent = "☀️";
        localStorage.setItem("theme", "dark");
    } else {
        themeToggle.textContent = "🌙";
        localStorage.setItem("theme", "light");
    }
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
    loadFPLBootstrapData(); // Initializes all FPL-dependent data
    loadStandings();
    loadEPLTable();
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
        loadPlayerStatusUpdates(data); // ⭐ NEW: Player Status

    } catch (err) {
        console.error("Error fetching FPL Bootstrap data:", err);
        const sections = ["price-changes-list", "most-transferred-list", "most-transferred-out-list", "most-captained-list", "fixtures-list", "status-list"];
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = "Failed to load data. Check FPL API/Proxy.";
        });
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

                const div = document.createElement("div");
                div.innerHTML = `<span class="rank-number">${team.rank}.</span> <span class="manager-name">${team.player_name} (${team.entry_name})</span> <span class="rank-change ${rankChangeClass}">${rankChangeIndicator}</span> <span>${team.total} pts</span>`;

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
            const change = p.cost_change_event / 10;
            const changeFormatted = change > 0 ? `+£${change.toFixed(1)}m` : `-£${Math.abs(change).toFixed(1)}m`;
            const playerPrice = (p.now_cost / 10).toFixed(1);

            const teamAbbreviation = teamMap[p.team] || 'N/A';

            div.textContent = `${p.first_name} ${p.second_name} (${teamAbbreviation}) (£${playerPrice}m) - ${changeFormatted}`;

            if (change > 0) {
                div.classList.add("price-riser");
            } else {
                div.classList.add("price-faller");
            }

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


// 🥇 CURRENT EPL TABLE (STANDINGS) - Keyless Public API
async function loadEPLTable() {
    const container = document.getElementById("epl-table-list");
    if (!container) return;

    // --- Dynamic Season Calculation ---
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth();

    let seasonStartYear;
    if (currentMonth >= 7) {
        seasonStartYear = currentYear;
    }
    else {
        seasonStartYear = currentYear - 1;
    }
    const currentSeason = `${seasonStartYear}-${seasonStartYear + 1}`;

    const EPL_LEAGUE_ID = "4328";
    const apiURL = `https://www.thesportsdb.com/api/v1/json/60130162/lookuptable.php?l=${EPL_LEAGUE_ID}&s=${currentSeason}`;

    try {
        const response = await fetch(proxy + encodeURIComponent(apiURL));
        const data = await response.json();

        if (!data.table || data.table.length === 0) {
            container.innerHTML = `<p>EPL Table data not available for the **${currentSeason}** season, or the API call failed.</p>`;
            return;
        }

        container.innerHTML = "<h3>Current Premier League Standings 🏆</h3>";

        const table = document.createElement('table');
        table.innerHTML = `
            <thead>
                <tr>
                    <th>#</th>
                    <th>Team</th>
                    <th>Pl</th>
                    <th>W</th>
                    <th>D</th>
                    <th>L</th>
                    <th>GD</th>
                    <th>Pts</th>
                </tr>
            </thead>
            <tbody>
            </tbody>
        `;
        const tbody = table.querySelector('tbody');

        data.table.sort((a, b) => a.intRank - b.intRank).forEach((team) => {
            const row = tbody.insertRow();
            row.innerHTML = `
                <td>${team.intRank}</td>
                <td>${team.strTeam}</td>
                <td>${team.intPlayed}</td>
                <td>${team.intWin}</td>
                <td>${team.intDraw}</td>
                <td>${team.intLoss}</td>
                <td>${team.intGoalDifference}</td>
                <td>${team.intPoints}</td>
            `;
            if (team.intRank <= 4) row.classList.add("champions-league");
            else if (team.intRank === 5) row.classList.add("europa-league");
            else if (team.intRank >= 18) row.classList.add("relegation-zone");
        });

        container.appendChild(table);

    } catch (err) {
        console.error("Error loading EPL table:", err);
        container.textContent = "Failed to load EPL table due to a network or fetch error. Check proxy or API stability.";
    }
}

/* -----------------------------------------
    BACK TO TOP BUTTON
----------------------------------------- */
const backToTop = document.getElementById("backToTop");

window.addEventListener("scroll", () => {
    backToTop.style.display = window.scrollY > 200 ? "flex" : "none";
});

backToTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
});
