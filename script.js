const BASE_URL = "https://raw.githubusercontent.com/openfootball/football.json/master/"; 
let currentLeagueFile = "esp.json"; // La Liga file
const matchesContainer = document.getElementById("matches-container");
const ticker = document.getElementById("score-ticker");

// Fetch and parse JSON for the selected league
async function fetchLeagueData(filename) {
  try {
    const res = await fetch(BASE_URL + filename);
    const data = await res.json();
    return data;
  } catch (error) {
    console.error("Failed to load league data:", error);
    return null;
  }
}

// Display matches
function displayMatches(matches) {
  matchesContainer.innerHTML = "";

  matches.forEach(match => {
    const card = document.createElement("div");
    card.className = "match-card";

    const home = match.team1;
    const away = match.team2;
    const homeScore = match.score1 ?? 0;
    const awayScore = match.score2 ?? 0;

    card.innerHTML = `
      <div class="team"><span>${home}</span><span>${away}</span></div>
      <div class="score">${homeScore} - ${awayScore}</div>
    `;

    matchesContainer.appendChild(card);
  });
}

// Update ticker
function updateTicker(matches) {
  if (!matches || matches.length === 0) {
    ticker.innerHTML = `<div class="ticker-content">No matches available</div>`;
    return;
  }

  const text = matches.map(m => {
    return `${m.team1} ${m.score1 ?? 0}-${m.score2 ?? 0} ${m.team2}`;
  }).join("  ⚽  ");

  ticker.innerHTML = `<div class="ticker-content">${text}</div>`;
}

// Main render function
async function refreshData() {
  const leagueData = await fetchLeagueData(currentLeagueFile);
  if (!leagueData) return;

  // Assume matches are in leagueData.matches
  displayMatches(leagueData.matches);
  updateTicker(leagueData.matches);
}

// Tabs
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    currentLeagueFile = btn.dataset.league;
    refreshData();
  });
});

// Initial load
refreshData();

// OPTIONAL: Refresh hourly (not live)
setInterval(refreshData, 3600000);