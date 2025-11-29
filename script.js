// CORS Proxy
const proxy = "https://api.allorigins.win/raw?url=";

// --------------------
// TAB SWITCHING
// --------------------
document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
    document.getElementById(btn.dataset.tab).classList.add("active");
  });
});

// --------------------
// LOAD MINI-LEAGUE STANDINGS
// --------------------
document.getElementById("load-standings").addEventListener("click", () => {
  const leagueID = "101712";  // put your league id here
  const url = `https://fantasy.premierleague.com/api/leagues-classic/${leagueID}/standings/`;

  const container = document.getElementById("standings-list");
  container.innerHTML = "Loading…";

  fetch(proxy + encodeURIComponent(url))
    .then(res => res.json())
    .then(data => {
      container.innerHTML = "";
      data.standings.results.forEach(team => {
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
          <strong>${team.player_name}</strong><br>
          Team: ${team.entry_name}<br>
          Rank: ${team.rank}<br>
          Points: ${team.total}
        `;
        container.appendChild(card);
      });
    });
});

// --------------------
// LIVE POINTS
// --------------------
document.getElementById("load-live").addEventListener("click", () => {
  const url = "https://fantasy.premierleague.com/api/bootstrap-static/";
  const container = document.getElementById("live-list");

  container.innerHTML = "Loading…";

  fetch(proxy + encodeURIComponent(url))
    .then(res => res.json())
    .then(data => {
      const currentGW = data.events.find(e => e.is_current).id;
      const liveURL = `https://fantasy.premierleague.com/api/event/${currentGW}/live/`;

      return fetch(proxy + encodeURIComponent(liveURL));
    })
    .then(res => res.json())
    .then(live => {
      container.innerHTML = "";
      live.elements.forEach(p => {
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
          <strong>Player ID: ${p.id}</strong><br>
          Total Points: ${p.stats.total_points}<br>
          Goals: ${p.stats.goals_scored}<br>
          Assists: ${p.stats.assists}
        `;
        container.appendChild(card);
      });
    });
});

// --------------------
// BPS BREAKDOWN (with player names)
// --------------------
document.getElementById("load-bps").addEventListener("click", loadBPS);

function loadBPS() {
  const container = document.getElementById("bps-list");
  container.innerHTML = "Loading BPS…";

  const bootstrapURL = "https://fantasy.premierleague.com/api/bootstrap-static/";
  let playerDict = {};
  let currentGW = null;

  // STEP 1: GET PLAYER NAMES + CURRENT GW
  fetch(proxy + encodeURIComponent(bootstrapURL))
    .then(res => res.json())
    .then(data => {
      data.elements.forEach(p => {
        playerDict[p.id] = `${p.first_name} ${p.second_name}`;
      });

      currentGW = data.events.find(e => e.is_current).id;

      const liveURL = `https://fantasy.premierleague.com/api/event/${currentGW}/live/`;
      return fetch(proxy + encodeURIComponent(liveURL));
    })
    .then(res => res.json())
    .then(live => {
      container.innerHTML = "";

      live.elements.forEach(p => {
        const name = playerDict[p.id] ?? "Unknown Player";

        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
          <strong>${name}</strong><br>
          BPS: ${p.stats.bps}<br>
          Points: ${p.stats.total_points}<br>
          Goals: ${p.stats.goals_scored}<br>
          Assists: ${p.stats.assists}
        `;
        container.appendChild(card);
      });
    });
}