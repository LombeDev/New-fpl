/* -----------------------------------------
   LOADING OVERLAY REMOVAL
----------------------------------------- */
window.addEventListener("load", () => {
  setTimeout(() => {
    const overlay = document.getElementById("loading-overlay");

    if (overlay) {
      // Use opacity and visibility for a smooth fade-out effect
      overlay.style.opacity = '0';
      // Remove it from the DOM after the fade-out completes (0.5s from CSS)
      setTimeout(() => {
          overlay.style.display = 'none';
      }, 500); 
    }
  }, 900); // Wait 900ms before starting the fade-out
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
// Using the more reliable proxy
const proxy = "https://corsproxy.io/?";

// Global variables
let teamMap = {}; // ID -> Abbreviation (e.g., 1 -> 'ARS')
let currentGameweekId = null; 
let playerMap = {}; // NEW: Player ID -> Player Name (essential for stats)

// On page load 
window.addEventListener("DOMContentLoaded", () => {
  // --- Initialize UX Features ---
  initializeThemeToggle();
  initializeNavigationToggle();

  // --- Bootstrap data fetch must happen first to get team names and GW ID ---
  loadFPLBootstrapData();
  loadStandings();
  loadEPLTable();     
});


/* -----------------------------------------
   UX INITIALIZATION FUNCTIONS
----------------------------------------- */

// 🌙☀️ THEME TOGGLE
function initializeThemeToggle() {
    const themeToggle = document.getElementById("themeToggle");

    if (!themeToggle) return;

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
}


// ☰ MOBILE NAVIGATION TOGGLE (UPDATED)
function initializeNavigationToggle() {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');

    if (!hamburger || !navLinks) return;
    
    // Set initial icon if not already set in HTML
    if (hamburger.innerHTML.trim() === '') {
        hamburger.innerHTML = '&#x2261;'; // Menu icon (☰)
    }

    // 1. Toggle menu visibility on hamburger click
    hamburger.addEventListener('click', () => {
        navLinks.classList.toggle('active');
        
        // **NEW ICON TOGGLE LOGIC**
        if (navLinks.classList.contains('active')) {
            hamburger.innerHTML = '&#x2715;'; // Close icon (✕)
        } else {
            hamburger.innerHTML = '&#x2261;'; // Menu icon (☰)
        }
    });

    // 2. Close menu when a navigation link is clicked (improves mobile UX)
    navLinks.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            // Only close if the menu is active
            if (navLinks.classList.contains('active')) {
                navLinks.classList.remove('active');
                // **NEW: Reset icon when a link is clicked**
                hamburger.innerHTML = '&#x2261;';
            }
        });
    });
}


/* -----------------------------------------
   FPL API FETCHING FUNCTIONS
----------------------------------------- */


// Function to fetch bootstrap data, create maps, and initialize dependent loads
async function loadFPLBootstrapData() {
    try {
        const data = await fetch(
            proxy + "https://fantasy.premierleague.com/api/bootstrap-static/"
        ).then((r) => r.json());

        // Create map of team ID to 3-letter abbreviation
        data.teams.forEach(team => {
            teamMap[team.id] = team.short_name;
        });

        // NEW: Create map of Player ID to Full Name
        data.elements.forEach(player => {
            playerMap[player.id] = `${player.first_name} ${player.second_name}`;
        });
        
        // --- LOGIC FOR CURRENT GAMEWEEK ID ---
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
        // --- END LOGIC ---

        // Now that data is ready, load the dependent lists
        loadCurrentGameweekFixtures();
        loadPriceChanges(data); 
        loadMostTransferred(data); 
        loadMostTransferredOut(data); 
        loadMostCaptained(data);

    } catch (err) {
        console.error("Error fetching FPL Bootstrap data:", err);
        // Display generic error message in case of failure
        const sections = ["price-changes-list", "most-transferred-list", "most-transferred-out-list", "most-captained-list", "fixtures-list"];
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = "Failed to load data. Check FPL API/Proxy.";
        });
    }
}

// 📅 CURRENT GAMEWEEK FIXTURES (ENHANCED)
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
            
            // Determine match status, score display, and status tag text
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
                // For upcoming matches, show the kickoff time
                const kickoffTime = new Date(fixture.kickoff_time);
                // Simple formatting, adjust locale options as needed
                scoreDisplay = `<span class="vs-label-time">${kickoffTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>`;
            }

            const listItem = document.createElement('li');
            listItem.classList.add(statusClass);
            
            // Base fixture info
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
            
            // --- Extract Goals, Assists, and Cards ---
            let actionHtml = '';
            let hasDetails = false;
            
            if (fixture.started) {
                const stats = fixture.stats || [];

                // Define function to safely extract stats
                const extractStats = (identifier) => {
                    const stat = stats.find(s => s.identifier === identifier);
                    // The 'a' array typically holds player IDs and values
                    // We must combine the 'a' (away) and 'h' (home) arrays if needed, but FPL generally puts all info in 'a' for fixtures
                    return stat ? (stat.a || []).concat(stat.h || []) : [];
                };

                const goalsData = extractStats('goals_scored');
                const assistsData = extractStats('assists');
                const redCardsData = extractStats('red_cards'); 

                const allActions = [];

                // Helper to process actions
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
                    // Group actions by type and then list unique players for that type
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
            
            // Append actions if the match has started and has details
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
            rankChangeIndicator = '—';
            rankChangeClass = 'rank-unchanged';
        }
        
        const div = document.createElement("div");
        // Using span tags to target specific elements with CSS for better styling
        div.innerHTML = `
            <span class="rank-number">${team.rank}.</span>
            <span class="${rankChangeClass} rank-change-icon">${rankChangeIndicator}</span>
            <span class="manager-name">${team.player_name} (${team.entry_name})</span>
            <span class="total-points">${team.total} pts</span>
        `;
        
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
      
      // Using span tags for better CSS control
      div.innerHTML = `
        <span class="player-name">${p.first_name} ${p.second_name}</span>
        <span class="player-team">(${teamAbbreviation})</span>
        <span class="player-price">£${playerPrice}m</span>
        <span class="price-change-value">${changeFormatted}</span>
      `;
      
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

      div.innerHTML = `
        <span class="rank-number">${index + 1}.</span>
        <span class="player-name">${p.first_name} ${p.second_name}</span>
        <span class="player-team">(${teamAbbreviation})</span>
        <span class="player-price">£${playerPrice}m</span>
        <span class="transfer-count">${transfers} transfers</span>
      `;
      
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

      div.innerHTML = `
        <span class="rank-number">${index + 1}.</span>
        <span class="player-name">${p.first_name} ${p.second_name}</span>
        <span class="player-team">(${teamAbbreviation})</span>
        <span class="player-price">£${playerPrice}m</span>
        <span class="transfer-count transferred-out-count">${transfers} transfers out</span>
      `;
      
      div.classList.add("transferred-out"); 
      
      container.appendChild(div);
    }, index * 30);
  });
}


// ©️ MOST CAPTAINED PLAYER 
async function loadMostCaptained(data) {
  const container = document.getElementById("most-captained-list");
  if (!container || !data) return;

  // Uses is_current or is_next to find the relevant Gameweek
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
  const captaincyPercentage = currentEvent.most_captained_percentage;

  const teamAbbreviation = teamMap[captain.team] || 'N/A';

  container.innerHTML = "<h3>Most Captained Player (This GW) ©️</h3>";

  const div = document.createElement("div");
  div.innerHTML = `
    <span class="player-name">${captain.first_name} ${captain.second_name}</span>
    <span class="player-team">(${teamAbbreviation})</span>
    <span class="player-price">£${playerPrice}m</span>
    <span class="captaincy-percentage">${captaincyPercentage}% captained</span>
  `;
  div.classList.add("top-rank"); 
  
  container.appendChild(div);
}


// 🥇 CURRENT EPL TABLE (STANDINGS) - Keyless Public API
async function loadEPLTable() {
  const container = document.getElementById("global-standings-list"); // Changed to match HTML ID
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
  const apiURL = `https://www.thesportsdb.com/api/v