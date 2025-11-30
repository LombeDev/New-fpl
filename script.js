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
   FPL API FETCHING (UPDATED)
----------------------------------------- */
const proxy = "https://api.allorigins.win/raw?url=";

// On page load - UPDATED to include new functions
window.addEventListener("DOMContentLoaded", () => {
  loadStandings();
  loadBPS();
  loadPriceChanges(); // <-- NEW: Load Price Changes
  loadEPLTable();     // <-- NEW: Load EPL Table
});

// MINI-LEAGUE STANDINGS
async function loadStandings() {
  const container = document.getElementById("standings-list");
  if (!container) return; // Safegard
  try {
    const leagueID = "101712"; // Replace with your league ID
    const data = await fetch(
      proxy + encodeURIComponent(`https://fantasy.premierleague.com/api/leagues-classic/${leagueID}/standings/`)
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
    console.error(err);
    container.textContent = "Failed to load standings.";
  }
}

// BPS BREAKDOWN
async function loadBPS() {
  const container = document.getElementById("bps-list");
  if (!container) return; // Safegard
  try {
    const bootstrap = await fetch(
      proxy + encodeURIComponent("https://fantasy.premierleague.com/api/bootstrap-static/")
    ).then((r) => r.json());

    const playerDict = {};
    bootstrap.elements.forEach((p) => {
      playerDict[p.id] = `${p.first_name} ${p.second_name}`;
    });

    const currentGW = bootstrap.events.find((e) => e.is_current).id;

    const live = await fetch(
      proxy + encodeURIComponent(`https://fantasy.premierleague.com/api/event/${currentGW}/live/`)
    ).then((r) => r.json());

    container.innerHTML = "";
    live.elements.forEach((p, index) => {
      setTimeout(() => {
        const div = document.createElement("div");
        div.textContent = `${playerDict[p.id] || "Unknown"} - BPS: ${p.stats.bps} | Points: ${p.stats.total_points} | G:${p.stats.goals_scored} A:${p.stats.assists}`;

        // Highlight high BPS players
        if (p.stats.bps >= 25) div.classList.add("high-points");

        container.appendChild(div);
      }, index * 20);
    });
  } catch (err) {
    console.error(err);
    container.textContent = "Failed to load BPS data.";
  }
}

// 💰 FPL PRICE CHANGES (RISERS AND FALLERS)
async function loadPriceChanges() {
  const container = document.getElementById("price-changes-list"); // Make sure this ID exists in your HTML
  if (!container) return;
  try {
    const data = await fetch(
      proxy + encodeURIComponent("https://fantasy.premierleague.com/api/bootstrap-static/")
    ).then((r) => r.json());

    // Filter players who had a price change (now_cost is not the original price)
    const priceChangedPlayers = data.elements
      .filter(p => p.cost_change_event !== 0) // Changed price since last Gameweek deadline
      .sort((a, b) => b.cost_change_event - a.cost_change_event); // Sort risers first

    container.innerHTML = "### Price Risers and Fallers (Since GW Deadline) 📈📉";

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
    console.error(err);
    container.textContent = "Failed to load price change data.";
  }
}

// 🥇 CURRENT EPL TABLE (STANDINGS)
async function loadEPLTable() {
  const container = document.getElementById("epl-table-list"); // Make sure this ID exists in your HTML
  if (!container) return;

  // NOTE: This uses TheSportsDB's free API for the Premier League table.
  // You might need a more robust paid API for a production application.
  const EPL_LEAGUE_ID = "4328"; 
  const apiURL = `https://www.thesportsdb.com/api/v1/json/60130162/lookuptable.php?l=${EPL_LEAGUE_ID}&s=2024-2025`; // Update season if needed

  try {
    const response = await fetch(proxy + encodeURIComponent(apiURL));
    const data = await response.json();

    if (!data.table) {
        container.textContent = "EPL Table data not available.";
        return;
    }

    container.innerHTML = "### Current Premier League Standings 🏆";

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
    console.error(err);
    container.textContent = "Failed to load EPL table.";
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