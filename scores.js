const API_KEY = "YOUR_API_KEY"; // Replace with your API-Football key
let currentLeague = "140"; // Default La Liga
const matchesContainer = document.getElementById("matches-container");
const ticker = document.getElementById("score-ticker");

let previousScores = {}; // Track previous scores for goal detection

// Fetch live matches for both leagues
async function fetchLiveMatches() {
  try {
    const resLaLiga = await fetch(`https://v3.football.api-sports.io/fixtures?live=all&league=140`, {
      headers: { "x-apisports-key": API_KEY }
    });
    const resSerieA = await fetch(`https://v3.football.api-sports.io/fixtures?live=all&league=135`, {
      headers: { "x-apisports-key": API_KEY }
    });

    const [dataLaLiga, dataSerieA] = await Promise.all([resLaLiga.json(), resSerieA.json()]);
    const allMatches = [...dataLaLiga.response, ...dataSerieA.response];

    updateMatches(allMatches);
    updateTicker(allMatches);
  } catch(err) {
    console.error(err);
  }
}

// Update match cards
function updateMatches(matches) {
  matchesContainer.innerHTML = "";

  matches.forEach(match => {
    const card = document.createElement("div");
    card.className = "match-card";

    const homeTeam = match.teams.home.name;
    const awayTeam = match.teams.away.name;
    const homeScore = match.goals.home ?? 0;
    const awayScore = match.goals.away ?? 0;
    const status = match.fixture.status.short;

    card.innerHTML = `
      <div class="team"><span>${homeTeam}</span><span>${awayTeam}</span></div>
      <div class="score">${homeScore} - ${awayScore}</div>
      <div class="status">${formatElapsed(match.fixture)}</div>
      <div class="timer" id="timer-${match.fixture.id}"></div>
    `;
    matchesContainer.appendChild(card);

    // Goal animation detection
    const matchId = match.fixture.id;
    const prev = previousScores[matchId] || {home: 0, away: 0};

    if(homeScore > prev.home || awayScore > prev.away) {
      const goalAnim = document.createElement("div");
      goalAnim.className = "goal-animation";
      goalAnim.textContent = "GOAL!";
      card.appendChild(goalAnim);
      setTimeout(() => goalAnim.remove(), 2000);
    }

    previousScores[matchId] = {home: homeScore, away: awayScore};

    // Timer for ongoing match
    if(match.fixture.status.elapsed !== null && status !== "FT") {
      const timerEl = document.getElementById(`timer-${match.fixture.id}`);
      let elapsed = match.fixture.status.elapsed;

      const interval = setInterval(() => {
        elapsed++;
        timerEl.textContent = `${elapsed}'`;
        if(elapsed >= 90) clearInterval(interval);
      }, 60000);
    }
  });
}

// Update ticker
function updateTicker(matches) {
  if(matches.length === 0) {
    ticker.innerHTML = `<div class="ticker-content">No live matches currently</div>`;
    return;
  }

  const tickerText = matches.map(match => {
    const home = match.teams.home.name;
    const away = match.teams.away.name;
    const homeScore = match.goals.home ?? 0;
    const awayScore = match.goals.away ?? 0;

    const matchId = match.fixture.id;
    const prev = previousScores[matchId] || {home: 0, away: 0};
    let text = `${home} ${homeScore}-${awayScore} ${away}`;

    // Highlight new goal
    if(homeScore > prev.home || awayScore > prev.away) {
      text = `<span class="goal-highlight">${text} ⚽</span>`;
    }

    return text;
  }).join("  ⚽  ");

  ticker.innerHTML = `<div class="ticker-content">${tickerText}</div>`;
}

// Format elapsed time
function formatElapsed(fixture) {
  const status = fixture.status.short;
  if(status === "NS") return "Not started";
  if(status === "FT") return "Full Time";
  if(status === "HT") return "Half Time";
  if(fixture.status.elapsed !== null) return `${fixture.status.elapsed}'`;
  return status;
}

// Tabs functionality
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentLeague = btn.dataset.league;
    fetchLiveMatches();
  });
});

// Initial fetch
fetchLiveMatches();
setInterval(fetchLiveMatches, 30000); // Refresh every 30 seconds