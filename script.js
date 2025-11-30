// ----------------------------------------------------------------------
// 1. DOM Element Variables & CORE UTILITIES
// ----------------------------------------------------------------------

const body = document.body;
const menuToggle = document.getElementById('menuToggle');
const sideMenu = document.getElementById('sideMenu');
const menuCloseBtn = document.getElementById('menuCloseBtn');
const menuOverlay = document.getElementById('menuOverlay');
const themeToggle = document.getElementById('themeToggle');
const loadingOverlay = document.getElementById('loading-overlay');
const backToTop = document.getElementById('backToTop');

// Using the more reliable proxy
const proxy = "https://corsproxy.io/?";

// Global variables
let teamMap = {}; // ID -> Abbreviation (e.g., 1 -> 'ARS')
let currentGameweekId = null; 
let playerMap = {}; // Player ID -> Player Name (essential for stats)


// ----------------------------------------------------------------------
// 2. SIDE MENU FUNCTIONALITY
// ----------------------------------------------------------------------

function toggleMenu() {
    body.classList.toggle("menu-open");
    // Set aria-expanded for accessibility
    const isMenuOpen = body.classList.contains('menu-open');
    menuToggle.setAttribute('aria-expanded', isMenuOpen); 
}

// Attach the toggle function to all closing points
menuToggle.addEventListener("click", toggleMenu); // 1. Hamburger Icon
menuOverlay.addEventListener("click", toggleMenu); // 2. Overlay (Clicking outside)
menuCloseBtn.addEventListener("click", toggleMenu); // 3. 'X' Close button

// Close menu when a navigation link is clicked
sideMenu.querySelectorAll('.nav-list li a').forEach(link => {
    link.addEventListener('click', (e) => {
        if (e.target.getAttribute('href').startsWith('#')) {
            setTimeout(toggleMenu, 100); 
        }
    });
});


// ----------------------------------------------------------------------
// 3. DARK MODE TOGGLE AND PERSISTENCE
// ----------------------------------------------------------------------

function updateThemeIcon() {
    // Check if the body currently has the dark-mode class
    const isDarkMode = body.classList.contains('dark-mode');
    const icon = themeToggle.querySelector('i');

    if (icon) {
        // Change the icon class (fa-moon for light, fa-sun for dark)
        icon.classList.remove(isDarkMode ? 'fa-moon' : 'fa-sun');
        icon.classList.add(isDarkMode ? 'fa-sun' : 'fa-moon');
        // Update the screen reader label
        themeToggle.setAttribute('aria-label', isDarkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode');
    }
}

function setInitialTheme() {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const savedTheme = localStorage.getItem('theme');

    if (savedTheme === 'dark' || (savedTheme === null && prefersDark)) {
        body.classList.add('dark-mode');
    }
    updateThemeIcon();
}

function toggleTheme() {
    body.classList.toggle('dark-mode');
    
    // Save preference to local storage
    if (body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
    } else {
        localStorage.setItem('theme', 'light');
    }
    
    updateThemeIcon();
}

// Initialize theme on page load
setInitialTheme();

// Event listener for theme toggle button
themeToggle.addEventListener('click', toggleTheme);


// ----------------------------------------------------------------------
// 4. LOADER AND LAZY LOADING
// ----------------------------------------------------------------------

// Function to hide the loading overlay after initial content has loaded
window.addEventListener('load', () => {
    // Wait 900ms before starting the fade-out
    setTimeout(() => { 
        if (loadingOverlay) {
            loadingOverlay.style.opacity = '0';
            // Remove it from the DOM flow after transition is complete
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
            }, 500); 
        }
    }, 900);
});

// Intersection Observer for Lazy Loading
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


// ----------------------------------------------------------------------
// 5. BACK TO TOP BUTTON
// ----------------------------------------------------------------------

window.addEventListener('scroll', () => {
    if (document.body.scrollTop > 300 || document.documentElement.scrollTop > 300) {
        backToTop.style.display = 'flex';
    } else {
        backToTop.style.display = 'none';
    }
});

backToTop.addEventListener('click', () => {
    window.scrollTo({
        top: 0,
        behavior: 'smooth'
    });
});


// ----------------------------------------------------------------------
// 6. FPL API FETCHING
// ----------------------------------------------------------------------

// On page load 
window.addEventListener("DOMContentLoaded", () => {
  // Bootstrap data fetch must happen first to get team names and GW ID
  loadFPLBootstrapData();
  loadStandings();
  // loadEPLTable() call has been removed.
});

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

        // Create map of Player ID to Full Name
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
        div.innerHTML = `<span class="rank-number">${team.rank}.</span> <span class="rank-change ${rankChangeClass}">${rankChangeIndicator}</span> <span class="manager-name">${team.player_name} (${team.entry_name})</span> <span>${team.total} pts</span>`;
        
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
  div.textContent = `${captain.first_name} ${captain.second_name} (${teamAbbreviation}) (£${playerPrice}m) - ${captaincyPercentage}%`;
  div.classList.add("top-rank"); 
  
  container.appendChild(div);
}