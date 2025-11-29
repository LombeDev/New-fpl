const proxy = "https://api.allorigins.win/raw?url=";

window.addEventListener("DOMContentLoaded", () => {
  loadStandings();
  loadLivePoints();
  loadBPS();
});

// MINI-LEAGUE STANDINGS
function loadStandings() {
  const leagueID = "YOUR_LEAGUE_ID";
  const container = document.getElementById("standings-list");
  container.innerHTML = "Loading…";

  fetch(proxy + encodeURIComponent(`https://fantasy.premierleague.com/api/leagues-classic/${leagueID}/standings/`))
    .then(r => r.json())
    .then(data => {
      container.innerHTML = "";

      const table = document.createElement("table");
      table.innerHTML = `
        <thead>
          <tr>
            <th>Rank</th>
            <th>Player</th>
            <th>Team</th>
            <th>Points</th>
          </tr>
        </thead>
        <tbody>
          ${data.standings.results.map(team => `
            <tr>
              <td>${team.rank}</td>
              <td>${team.player_name}</td>
              <td>${team.entry_name}</td>
              <td>${team.total}</td>
            </tr>
          `).join('')}
        </tbody>
      `;
      container.appendChild(table);
    });
}

// LIVE POINTS
function loadLivePoints() {
  const container = document.getElementById("live-list");
  container.innerHTML = "Loading…";

  fetch(proxy + encodeURIComponent("https://fantasy.premierleague.com/api/bootstrap-static/"))
    .then(r => r.json())
    .then(data => {
      const currentGW = data.events.find(e => e.is_current).id;
      return fetch(proxy + encodeURIComponent(`https://fantasy.premierleague.com/api/event/${currentGW}/live/`));
    })
    .then(r => r.json())
    .then(live => {
      const container = document.getElementById("live-list");
      container.innerHTML = "";

      const table = document.createElement("table");
      table.innerHTML = `
        <thead>
          <tr>
            <th>Player ID</th>
            <th>Points</th>
            <th>Goals</th>
            <th>Assists</th>
          </tr>
        </thead>
        <tbody>
          ${live.elements.map(p => `
            <tr>
              <td>${p.id}</td>
              <td>${p.stats.total_points}</td>
              <td>${p.stats.goals_scored}</td>
              <td>${p.stats.assists}</td>
            </tr>
          `).join('')}
        </tbody>
      `;
      container.appendChild(table);
    });
}

// BPS Breakdown
function loadBPS() {
  const container = document.getElementById("bps-list");
  container.innerHTML = "Loading…";

  fetch(proxy + encodeURIComponent("https://fantasy.premierleague.com/api/bootstrap-static/"))
    .then(r => r.json())
    .then(data => {
      const playerDict = {};
      data.elements.forEach(p => playerDict[p.id] = `${p.first_name} ${p.second_name}`);
      const currentGW = data.events.find(e => e.is_current).id;

      return fetch(proxy + encodeURIComponent(`https://fantasy.premierleague.com/api/event/${currentGW}/live/`))
        .then(r => r.json())
        .then(live => {
          container.innerHTML = "";

          const table = document.createElement("table");
          table.innerHTML = `
            <thead>
              <tr>
                <th>Player</th>
                <th>BPS</th>
                <th>Points</th>
                <th>Goals</th>
                <th>Assists</th>
              </tr>
            </thead>
            <tbody>
              ${live.elements.map(p => `
                <tr>
                  <td>${playerDict[p.id] || 'Unknown'}</td>
                  <td>${p.stats.bps}</td>
                  <td>${p.stats.total_points}</td>
                  <td>${p.stats.goals_scored}</td>
                  <td>${p.stats.assists}</td>
                </tr>
              `).join('')}
            </tbody>
          `;
          container.appendChild(table);
        });
    });
}