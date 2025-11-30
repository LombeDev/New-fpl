const proxy = "https://api.allorigins.win/raw?url=";

// On page load
window.addEventListener("DOMContentLoaded", () => {
  loadStandings();
  loadBPS();
});

// MINI-LEAGUE STANDINGS
async function loadStandings() {
  const container = document.getElementById("standings-list");
  try {
    const leagueID = "101712"; // Replace with your league ID
    const data = await fetch(proxy + encodeURIComponent(`https://fantasy.premierleague.com/api/leagues-classic/${leagueID}/standings/`))
      .then(r => r.json());

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
  try {
    const bootstrap = await fetch(proxy + encodeURIComponent("https://fantasy.premierleague.com/api/bootstrap-static/"))
      .then(r => r.json());

    const playerDict = {};
    bootstrap.elements.forEach(p => playerDict[p.id] = `${p.first_name} ${p.second_name}`);

    const currentGW = bootstrap.events.find(e => e.is_current).id;
    const live = await fetch(proxy + encodeURIComponent(`https://fantasy.premierleague.com/api/event/${currentGW}/live/`))
      .then(r => r.json());

    container.innerHTML = "";
    live.elements.forEach((p, index) => {
      setTimeout(() => {
        const div = document.createElement("div");
        div.textContent = `${playerDict[p.id] || 'Unknown'} - BPS: ${p.stats.bps} | Points: ${p.stats.total_points} | G:${p.stats.goals_scored} A:${p.stats.assists}`;

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

// BACK TO TOP BUTTON
const backToTop = document.getElementById("backToTop");
window.addEventListener("scroll", () => {
  backToTop.style.display = window.scrollY > 200 ? "flex" : "none";
});
backToTop.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});