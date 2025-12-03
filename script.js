/* -----------------------------------------
    GLOBAL SETUP
----------------------------------------- */
// Using the more reliable proxy for cross-origin requests
const proxy = "https://corsproxy.io/?";

// Global variables initialized at the top
let teamMap = {};    // Team ID -> Abbreviation (e.g., 1 -> 'ARS')
let playerMap = {};  // Player ID -> Full Name
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
    loadFPLBootstrapData(); // Initializes all FPL-dependent data (and now loads the simple table)
    loadStandings();
    // loadEPLTable() has been removed and the table is now loaded inside loadFPLBootstrapData(data)
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


// 🥇 CURRENT EPL TABLE (STANDINGS) - Simplified FPL Data Only
/**
 * Loads and displays a simplified EPL Table using only FPL Bootstrap data.
 * This is faster and simpler than using a second external API.
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
    // Using the same column headers but relying on FPL data keys
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
    BACK TO TOP BUTTON
----------------------------------------- */
const backToTop = document.getElementById("backToTop");

window.addEventListener("scroll", () => {
    backToTop.style.display = window.scrollY > 200 ? "flex" : "none";
});

backToTop.addEventListener("click", () => {
    window.scrollTo({ top: 0, behavior: "smooth" });
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
            
            // Optional: Show a "No results found" message
            const visibleItems = Array.from(items).filter(item => item.style.display !== 'none');
            let noResults = document.getElementById('status-no-results');

            if (visibleItems.length === 0 && searchTerm.length > 0) {
                 if (!noResults) {
                     const message = document.createElement('p');
                     message.id = 'status-no-results';
                     message.classList.add('error-message');
                     message.textContent = '🔍 No matching players found.';
                     statusList.appendChild(message);
                 }
            } else if (noResults) {
                // Remove message if results are visible or search is empty
                noResults.remove();
            }
        });
    }
});




// 🌟 BONUS POINTS SCORERS (Current Gameweek)
async function loadTopBonusPoints(data) {
    const container = document.getElementById("bps-list");
    if (!container || !data) return;

    // Check 1: Ensure we have a Gameweek ID
    if (!currentGameweekId) {
        container.innerHTML = "<h3>Bonus Points (Current GW) 🌟</h3><p>Gameweek information is not yet available.</p>";
        return;
    }
    
    // Clear content and show loader while waiting for the secondary fetch
    container.innerHTML = `<div style="text-align: center; padding: 20px 0;"><div class="loader"></div><p style="color: var(--subtext); margin-top: 15px; font-size: 14px;">Fetching live GW ${currentGameweekId} bonus data...</p></div>`;


    try {
        const gwDataResponse = await fetch(
            proxy + `https://fantasy.premierleague.com/api/event/${currentGameweekId}/live/`
        );
        
        // Check 2: Ensure the secondary fetch was successful
        if (!gwDataResponse.ok) {
            throw new Error(`API returned status ${gwDataResponse.status}`);
        }
        
        const gwData = await gwDataResponse.json();

        // 1. Get the player stats from the live GW data
        const playerStats = gwData.elements;

        // 2. Map the element data and FILTER STRICTLY by actual bonus points awarded
        const bonusPlayers = playerStats
            .map(stat => {
                // Find the actual bonus points awarded (0-3)
                const bonusAwarded = stat.stats.find(s => s.identifier === 'bonus')?.value || 0;
                
                // Only include players who received 1, 2, or 3 bonus points
                if (bonusAwarded > 0) {
                    const fullPlayer = data.elements.find(p => p.id === stat.id);
                    if (fullPlayer) {
                        // Get the raw BPS score for context/sorting
                        const bpsValue = stat.stats.find(s => s.identifier === 'bps')?.value || 0;
                        
                        return {
                            ...fullPlayer,
                            gw_bps: bpsValue,
                            gw_bonus: bonusAwarded
                        };
                    }
                }
                return null;
            })
            .filter(p => p !== null); // Remove players who didn't get bonus points or are null

        // 3. Sort: Primary sort by Bonus (3, 2, 1), Secondary sort by BPS score
        bonusPlayers.sort((a, b) => {
            if (b.gw_bonus !== a.gw_bonus) {
                return b.gw_bonus - a.gw_bonus; 
            }
            return b.gw_bps - a.gw_bps;
        });

        // 4. Render the list
        container.innerHTML = `<h3>Bonus Points (GW ${currentGameweekId}) 🌟</h3>`;

        if (bonusPlayers.length === 0) {
            container.innerHTML += `<p>No bonus points have been finalized yet for GW ${currentGameweekId}.</p>`;
            return;
        }

        bonusPlayers.forEach((p, index) => {
            setTimeout(() => {
                const div = document.createElement("div");
                const teamAbbreviation = teamMap[p.team] || 'N/A';
                
                div.innerHTML = `
                    <span class="bonus-icon">⭐</span>
                    <span class="bonus-awarded-value">${p.gw_bonus}</span> 
                    Pts - 
                    <strong>${p.first_name} ${p.second_name}</strong> (${teamAbbreviation})
                    <span class="bps-score">(${p.gw_bps} BPS)</span>
                `;
                
                if (p.gw_bonus === 3) div.classList.add("top-rank"); 

                container.appendChild(div);
            }, index * 30);
        });

    } catch (err) {
        console.error(`Error loading GW ${currentGameweekId} live data:`, err);
        container.innerHTML = `<h3>Bonus Points (GW ${currentGameweekId}) 🌟</h3><p>Failed to load live Gameweek data. (Network/API Error)</p>`;
    }
}

/* -----------------------------------------
    GW DEADLINE DATE/TIME DISPLAY (REPLACES COUNTDOWN)
----------------------------------------- */

// Function to format the date and time string
function formatDeadlineTime(deadlineTimeString) {
    const deadlineDate = new Date(deadlineTimeString);

    // Format the date (e.g., Sunday, Dec 7)
    const dateOptions = { 
        weekday: 'long', 
        month: 'short', 
        day: 'numeric' 
    };
    const datePart = deadlineDate.toLocaleDateString(undefined, dateOptions);

    // Format the time (e.g., 11:30 AM local time)
    const timeOptions = { 
        hour: '2-digit', 
        minute: '2-digit' 
    };
    const timePart = deadlineDate.toLocaleTimeString(undefined, timeOptions);

    return `${datePart} @ ${timePart} (Local Time)`;
}

/**
 * Finds the next deadline and displays its date and time statically.
 * This is updated to specifically look for the "is_next" event (GW+1) to avoid showing the current GW's passed deadline.
 */
function processDeadlineDisplay(data) {
    const countdownTimerEl = document.getElementById("countdown-timer");
    const countdownTitleEl = document.querySelector(".countdown-title");

    if (!countdownTimerEl || !countdownTitleEl) return; 

    // ⭐ CORRECTED LOGIC: Find the Gameweek that is officially flagged as the next one.
    let nextGameweek = data.events.find(event => event.is_next === true);

    // Fallback: If no event has is_next=true (e.g., season end or early data stage), 
    // find the first one that hasn't finished.
    if (!nextGameweek) {
         nextGameweek = data.events.find(event => event.finished === false);
    }
    
    if (nextGameweek) {
        const formattedTime = formatDeadlineTime(nextGameweek.deadline_time);
        countdownTitleEl.textContent = `GW ${nextGameweek.id} Deadline:`;
        countdownTimerEl.textContent = formattedTime;
    } else {
        countdownTitleEl.textContent = `FPL Deadline Status`;
        countdownTimerEl.textContent = "Season concluded or data unavailable.";
    }
}
