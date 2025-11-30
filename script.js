/* -----------------------------------------
   SPLIT SCREEN INTRO ANIMATION
----------------------------------------- */
window.addEventListener("load", () => {
  setTimeout(() => {
    const top = document.querySelector(".split-top");
    const bottom = document.querySelector(".split-bottom");

    if (top) top.style.display = "none";
    if (bottom) bottom.style.display = "none";
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

// Global variable to store team map (ID -> Abbreviation)
let teamMap = {}; 

// On page load 
window.addEventListener("DOMContentLoaded", () => {
  // Load initial data and team map first, then proceed to lists
  loadFPLBootstrapData();
  loadStandings();
  loadEPLTable();     
});

// **NEW:** Function to fetch bootstrap data and create the team map
async function loadFPLBootstrapData() {
    try {
        const data = await fetch(
            proxy + "https://fantasy.premierleague.com/api/bootstrap-static/"
        ).then((r) => r.json());

        // Create a map of team ID to 3-letter abbreviation
        data.teams.forEach(team => {
            teamMap[team.id] = team.short_name;
        });

        // Now that teamMap is ready, load the player lists
        loadPriceChanges(data); 
        loadMostTransferred(data); 
        loadMostCaptained(data);

    } catch (err) {
        console.error("Error fetching FPL Bootstrap data:", err);
        // Display generic error message in case of failure
        document.getElementById("price-changes-list").textContent = "Failed to load player data.";
        document.getElementById("most-transferred-list").textContent = "Failed to load player data.";
        document.getElementById("most-captained-list").textContent = "Failed to load player data.";
    }
}


// MINI-LEAGUE STANDINGS (Unchanged logic, kept for completeness)
async function loadStandings() {
  const container = document.getElementById("standings-list");
  if (!container) return; 
  try {
    const leagueID = "101712"; // Replace with your league ID
    const data = await fetch(
      proxy + `https://fantasy.premierleague.com/api/leagues-classic/${leagueID}/standings/`
    ).then((r) => r.json());

    container.innerHTML = "";
    data.standings.results.forEach((team, index) => {
      setTimeout(() => {
        
        // --- RANK CHANGE LOGIC ---
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
        // Note: We use the rankChangeClass only for the color, the text is combined.
        div.innerHTML = `${team.rank}. <span class="${rankChangeClass}">${rankChangeIndicator}</span> ${team.player_name} (${team.entry_name}) - ${team.total} pts`;
        
        // Rank highlights (for top 3 positions)
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

// 💰 FPL PRICE CHANGES (Now accepts data object)
async function loadPriceChanges(data) {
  const container = document.getElementById("price-changes-list");
  if (!container || !data) return;
  
  // Data processing logic using the received data object
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
      
      // *** NEW: Insert team abbreviation ***
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

// ➡️ MOST TRANSFERRED IN (Now accepts data object)
async function loadMostTransferred(data) {
  const container = document.getElementById("most-transferred-list");
  if (!container || !data) return;
  
  // Data processing logic using the received data object
  const topTransferred = data.elements
    .sort((a, b) => b.transfers_in_event - a.transfers_in_event)
    .slice(0, 10); 

  container.innerHTML = "<h3>Most Transferred In (This GW) ➡️</h3>";

  topTransferred.forEach((p, index) => {
    setTimeout(() => {
      const div = document.createElement("div");
      const transfers = p.transfers_in_event.toLocaleString();
      const playerPrice = (p.now_cost / 10).toFixed(1);

      // *** NEW: Insert team abbreviation ***
      const teamAbbreviation = teamMap[p.team] || 'N/A';

      div.textContent = `${index + 1}. ${p.first_name} ${p.second_name} (${teamAbbreviation}) (£${playerPrice}m) - ${transfers} transfers`;
      
      container.appendChild(div);
    }, index * 30);
  });
}

// ©️ MOST CAPTAINED PLAYER (Now accepts data object)
async function loadMostCaptained(data) {
  const container = document.getElementById("most-captained-list");
  if (!container || !data) return;

  // 1. Get the current Gameweek data
  const currentEvent = data.events.find(e => e.is_next || e.is_current);

  if (!currentEvent || !currentEvent.most_captained) {
      container.textContent = "Captain data not yet available for this Gameweek.";
      return;
  }

  const mostCaptainedId = currentEvent.most_captained;
  
  // 2. Find the player object using the ID
  const captain = data.elements.find(p => p.id === mostCaptainedId);

  if (!captain) {
      container.textContent = "Could not find the most captained player.";
      return;
  }

  const playerPrice = (captain.now_cost / 10).toFixed(1);
  const captaincyPercentage = currentEvent.most_captained_percentage;

  // *** NEW: Insert team abbreviation ***
  const teamAbbreviation = teamMap[captain.team] || 'N/A';

  container.innerHTML = "<h3>Most Captained Player (This GW) ©️</h3>";

  const div = document.createElement("div");
  div.textContent = `${captain.first_name} ${captain.second_name} (${teamAbbreviation}) (£${playerPrice}m) - ${captaincyPercentage}%`;
  div.classList.add("top-rank"); // Highlight the captain
  
  container.appendChild(div);
}


// 🥇 CURRENT EPL TABLE (STANDINGS) - Keyless Public API (Unchanged)
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

    // Create a simple table element
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

    // Populate the table rows
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
      // Apply styling for Champions League, Europa, and Relegation zones (optional)
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