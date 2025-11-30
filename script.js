const proxy = "https://api.allorigins.win/raw?url=";

window.addEventListener("DOMContentLoaded", () => {
  loadStandings();
  loadBPS();
  loadFixtures();
  loadEPLTable();
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
        if (p.stats.bps >= 25) div.classList.add("high-points");
        container.appendChild(div);
      }, index * 20);
    });
  } catch (err) {
    console.error(err);
    container.textContent = "Failed to load BPS data.";
  }
}

// CURRENT GW FIXTURES
async function loadFixtures() {
  const container = document.getElementById("fixtures-list");
  try {
    const bootstrap = await fetch(proxy + encodeURIComponent("https://fantasy.premierleague.com/api/bootstrap-static/"))
      .then(r => r.json());

    const currentGW = bootstrap.events.find(e => e.is_current).id;
    const fixtures = await fetch(proxy + encodeURIComponent(`https://fantasy.premierleague.com/api/fixtures/`))
      .then(r => r.json());

    const gwFixtures = fixtures.filter(f => f.event === currentGW);
    container.innerHTML = "";
    gwFixtures.forEach((f, index) => {
      setTimeout(() => {
        const div = document.createElement("div");
        div.textContent = `${f.team_h} vs ${f.team_a} - Kickoff: ${new Date(f.kickoff_time).toLocaleString()}`;
        container.appendChild(div);
      }, index * 20);
    });
  } catch (err) {
    console.error(err);
    container.textContent = "Failed to load fixtures.";
  }
}

// EPL LEAGUE TABLE
async function loadEPLTable() {
  const container = document.getElementById("epl-table");
  try {
    const bootstrap = await fetch(proxy + encodeURIComponent("https://fantasy.premierleague.com/api/bootstrap-static/"))
      .then(r => r.json());

    const teams = bootstrap.teams.sort((a, b) => a.position - b.position);
    container.innerHTML = "";
    teams.forEach(team => {
      const div = document.createElement("div");
      div.textContent = `${team.position}. ${team.name} - P:${team.played} W:${team.win} D:${team.draw} L:${team.loss} GF:${team.goals_for} GA:${team.goals_against} Pts:${team.points}`;
      container.appendChild(div);
    });
  } catch (err) {
    console.error(err);
    container.textContent = "Failed to load EPL table.";
  }
}

// BACK TO TOP
const backToTop = document.getElementById("backToTop");
window.addEventListener("scroll", () => {
  backToTop.style.display = window.scrollY > 200 ? "flex" : "none";
});
backToTop.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});