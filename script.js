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
// NEW, MORE RELIABLE PROXY USED HERE
const proxy = "https://corsproxy.io/?";

// On page load 
window.addEventListener("DOMContentLoaded", () => {
  loadStandings();
  loadPriceChanges(); 
  loadMostTransferred(); 
  loadMostCaptained();   
  loadEPLTable();     
});

// MINI-LEAGUE STANDINGS
async function loadStandings() {
  const container = document.getElementById("standings-list");
  if (!container) return; 
  try {
    const leagueID = "101712"; // Replace with your league ID
    // Note: FPL API uses a different encoding method for this endpoint, so no encodeURIComponent needed with the new proxy
    const data = await fetch(
      proxy + `https://fantasy.premierleague.com/api/leagues-classic/${leagueID}/standings/`
    ).then((r) => r.json());

    container.innerHTML = "";
    data.standings.results.forEach((team, index) => {
      setTimeout(() => {
        const div = document.createElement("div");
        div.textContent = `${team.rank}. ${team.player_name} (${team.entry_name}) - ${team.total} pts`;

        // Rank highlights
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

// 💰 FPL PRICE CHANGES (RISERS AND FALLERS)
async function loadPriceChanges() {
  const container = document.getElementById("price-changes-list");
  if (!container) return;
  try {
    const data = await fetch(
      proxy + "https://fantasy.premierleague.com/api/bootstrap-static/"
    ).then((r) => r.json());

    // Filter players who had a price change (now_cost is not the original price)
    const priceChangedPlayers = data.elements
      .filter(p => p.cost_change_event !== 0) // Changed price since last Gameweek deadline
      .sort((a, b) => b.cost_change_event - a.cost_change_event); // Sort risers first

    container.innerHTML = "<h3>Price Risers and Fallers (Since GW Deadline) 📈📉</h3>";

    priceChangedPlayers.forEach((p, index) => {
      setTimeout(() => {
        const div = document.createElement("div");
        const change = p.cost_change_event / 10; // FPL API stores price in tenths of a million
        const changeFormatted = change > 0 ? `+£${change.toFixed(1)}m` : `-£${Math.abs(change).toFixed(1)}m`;
        const playerPrice = (p.now_cost / 10).toFixed(1);

        div.textContent = `${p.first_name} ${p.second_name} (£${playerPrice}m) - ${changeFormatted}`;
        
        // Apply class for styling
        if (change > 0) {
          div.classList.add("price-riser"); // Risers in green/up arrow
        } else {
          div.classList.add("price-faller"); // Fallers in red/down arrow
        }

        container.appendChild(div);
      }, index * 20);
    });

  } catch (err) {
    console.error("Error loading price changes:", err);
    container.textContent = "Failed to load price change data. Check proxy/FPL API.";
  }
}

// ➡️ MOST TRANSFERRED IN (This and Captained use bootstrap-static, same fix applies)
async function loadMostTransferred() {
  const container = document.getElementById("most-transferred-list");
  if (!container) return;
  try {
    const data = await fetch(
      proxy + "https://fantasy.premierleague.com/api/bootstrap-static/"
    ).then((r) => r.json());

    // Sort players by transfers_in_event (transfers since the last deadline)
    const topTransferred = data.elements
      .sort((a, b) => b.transfers_in_event - a.transfers_in_event)
      .slice(0, 10); // Take the top 10

    container.innerHTML = "<h3>Most Transferred In (This GW) ➡️</h3>";

    topTransferred.forEach((p, index) => {
      setTimeout(() => {
        const div = document.createElement("div");
        const transfers = p.transfers_in_event.toLocaleString(); // Add commas for readability
        const playerPrice = (p.now_cost / 10).toFixed(1);

        div.textContent = `${index + 1}. ${p.first_name} ${p.second_name} (£${playerPrice}m) - ${transfers} transfers`;
        
        container.appendChild(div);
      }, index * 30);
    });
  } catch (err) {
    console.error("Error loading transfers data:", err);
    container.textContent = "Failed to load transfers data. Check proxy/FPL API.";
  }
}

// ©️ MOST CAPTAINED PLAYER
async function loadMostCaptained() {
  const container = document.getElementById("most-captained-list");
  if (!container) return;
  try {
    const data = await fetch(
      proxy + "https://fantasy.premierleague.com/api/bootstrap-static/"
    ).then((r) => r.json());

    // 1. Get the current Gameweek data (assuming the first event in events is the current/next one)
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

    container.innerHTML = "<h3>Most Captained Player (This GW) ©️</h3>";

    const div = document.createElement("div");
    div.textContent = `${captain.first_name} ${captain.second_name} (£${playerPrice}m) - ${captaincyPercentage}%`;
    div.classList.add("top-rank"); // Highlight the captain
    
    container.appendChild(div);

  } catch (err) {
    console.error("Error loading captaincy data:", err);
    container.textContent = "Failed to load captaincy data. Check proxy/FPL API.";
  }
}


// 🥇 CURRENT EPL TABLE (STANDINGS) - Keyless Public API
async function loadEPLTable() {
  const container = document.getElementById("epl-table-list");
  if (!container) return;

  // --- Dynamic Season Calculation ---
  // EPL Season is usually August to May. We calculate the current season string YYYY-YYYY+1
  const currentYear = new Date().getFullYear();
  const currentMonth = new Date().getMonth(); // 0 = Jan, 11 = Dec

  let seasonStartYear;
  // If month is Aug (7) or later, the season started this year.
  if (currentMonth >= 7) { 
    seasonStartYear = currentYear;
  } 
  // If month is Jan (0) to Jul (6), the season started last year.
  else {
    seasonStartYear = currentYear - 1;
  }
  const currentSeason = `${seasonStartYear}-${seasonStartYear + 1}`; 
  
  // This uses TheSportsDB's free API for EPL Standings (League ID 4328)
  const EPL_LEAGUE_ID = "4328"; 
  const apiURL = `https://www.thesportsdb.com/api/v1/json/60130162/lookuptable.php?l=${EPL_LEAGUE_ID}&s=${currentSeason}`; 
  
  try {
    // TheSportsDB API can be strict about CORS, so we must use the proxy here.
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