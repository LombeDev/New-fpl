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

// Note: MY_ENTRY_ID has been removed.

// ----------------------------------------------------------------------
// 2. SIDE MENU FUNCTIONALITY
// ----------------------------------------------------------------------

function toggleMenu() {
    body.classList.toggle("menu-open");
    const isMenuOpen = body.classList.contains('menu-open');
    menuToggle.setAttribute('aria-expanded', isMenuOpen); 
}

if (menuToggle) menuToggle.addEventListener("click", toggleMenu);
if (menuOverlay) menuOverlay.addEventListener("click", toggleMenu);
if (menuCloseBtn) menuCloseBtn.addEventListener("click", toggleMenu);

if (sideMenu) {
    sideMenu.querySelectorAll('.nav-list li a').forEach(link => {
        link.addEventListener('click', (e) => {
            if (e.target.getAttribute('href').startsWith('#')) {
                setTimeout(toggleMenu, 100); 
            }
        });
    });
}

// ----------------------------------------------------------------------
// 3. DARK MODE TOGGLE AND PERSISTENCE
// ----------------------------------------------------------------------

function updateThemeIcon() {
    const isDarkMode = body.classList.contains('dark-mode');
    const icon = themeToggle ? themeToggle.querySelector('i') : null;

    if (icon) {
        icon.classList.remove(isDarkMode ? 'fa-moon' : 'fa-sun');
        icon.classList.add(isDarkMode ? 'fa-sun' : 'fa-moon');
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
    
    if (body.classList.contains('dark-mode')) {
        localStorage.setItem('theme', 'dark');
    } else {
        localStorage.setItem('theme', 'light');
    }
    
    updateThemeIcon();
}

setInitialTheme();

if (themeToggle) {
    themeToggle.addEventListener('click', toggleTheme);
}

// ----------------------------------------------------------------------
// 4. LOADER, LAZY LOADING & BACK TO TOP
// ----------------------------------------------------------------------

// Hides the initial loading overlay
window.addEventListener("load", () => {
    setTimeout(() => { 
        if (loadingOverlay) {
            loadingOverlay.style.opacity = '0';
            setTimeout(() => {
                loadingOverlay.style.display = 'none';
            }, 500); 
        }
    }, 900);
});

// Lazy Loading Intersection Observer
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

// Back to Top button
if (backToTop) {
    window.addEventListener('scroll', () => {
        backToTop.style.display = window.scrollY > 300 ? 'flex' : 'none';
    });
    backToTop.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}


// ----------------------------------------------------------------------
// 5. FPL API FETCHING
// ----------------------------------------------------------------------

window.addEventListener("DOMContentLoaded", () => {
  // Start the chain of data loading
  loadFPLBootstrapData();
  loadStandings(); // Doesn't rely on bootstrap data
});

/**
 * Fetches core FPL data, creates maps, and triggers dependent functions.
 */
async function loadFPLBootstrapData() {
    try {
        const data = await fetch(
            proxy + "https://fantasy.premierleague.com/api/bootstrap-static/"
        ).then((r) => r.json());

        // Create essential maps
        data.teams.forEach(team => { teamMap[team.id] = team.short_name; });
        data.elements.forEach(player => { playerMap[player.id] = `${player.first_name} ${player.second_name}`; });
        
        // Determine current Gameweek ID
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
        
        // Trigger all dependent loads
        loadCurrentGameweekFixtures();
        loadPriceChanges(data); 
        loadMostTransferred(data); 
        loadMostTransferredOut(data); 
        loadMostCaptained(data);
        loadPlayerStatusUpdates(data); // Player status is still included

    } catch (err) {
        console.error("Error fetching FPL Bootstrap data:", err);
        const sections = ["price-changes-list", "most-transferred-list", "most-transferred-out-list", "most-captained-list", "fixtures-list", "player-status-list"];
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = "Failed to load data. Check FPL API/Proxy/Network.";
        });
    }
}

// 🚨 PLAYER STATUS UPDATES (INJURY/SUSPENSIONS)
async function loadPlayerStatusUpdates(data) {
    const container = document.getElementById("player-status-list");
    if (!container || !data || !data.elements) return;

    // Filter players who are not 100% likely to play AND have news attached.
    const flaggedPlayers = data.elements
        .filter(p => p.chance_of_playing_next_event < 100 && p.news)
        .sort((a, b) => a.chance_of_playing_next_event - b.chance_of_playing_next_event);

    container.innerHTML = "<h3>Player Status Updates 🚨</h3>";

    if (flaggedPlayers.length === 0) {
        container.innerHTML += "<p>No major flags or injury news reported for the next Gameweek.</p>";
        return;
    }

    const list = document.createElement('ul');
    list.classList.add('player-status-items');

    flaggedPlayers.forEach((p, index) => {
        setTimeout(() => {
            const teamAbbreviation = teamMap[p.team] || 'N/A';
            const status = p.news;
            const chance = p.chance_of_playing_next_event; // 0, 25, 50, 75, 100

            let statusClass = 'status-unknown';
            if (chance === 0) statusClass = 'status-out';
            else if (chance <= 50) statusClass = 'status-doubtful';
            else if (chance < 100) statusClass = 'status-slight-doubt';

            const listItem = document.createElement('li');
            listItem.classList.add(statusClass);

            listItem.innerHTML = `
                <span class="player-name-flagged">
                    ${p.first_name} ${p.second_name} (${teamAbbreviation})
                </span>
                <span class="player-status-info">
                    <span class="status-chance">Chance: ${chance}%</span>
                    — ${status}
                </span>
            `;
            list.appendChild(listItem);
        }, index * 40); // Stagger the display
    });
    
    container.appendChild(list);
}

// Note: loadMyTeamSelection function has been removed.

// 📅 CURRENT GAMEWEEK FIXTURES 
async function loadCurrentGameweekFixtures() {
    const container = document.getElementById("fixtures-list");
    if (!container || !currentGameweekId) return;
    
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
                    if (groupedActions.goal) actionHtml += `<p><span class="action-label action-goal">⚽ Goals:</span> ${Array.from(groupedActions.goal).join(', ')}</p>`;
                    if (groupedActions.assist) actionHtml += `<p><span class="action-label action-assist">👟 Assists:</span> ${Array.from(groupedActions.assist).join(', ')}</p>`;
                    if (groupedActions.red_card) actionHtml += `<p><span class="action-label action-red-card">🟥 Red Cards:</span> ${Array.from(groupedActions.red_card).join(', ')}</p>`;
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
  if (!container || !data || !data.elements) return;
  
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
  if (!container || !data || !data.elements) return;
  
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
  if (!container || !data || !data.elements) return;
  
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
  if (!container || !data || !data.events || !data.elements) return;

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