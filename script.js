// Mini League ID (CHANGE THIS!)
const LEAGUE_ID = 101712;

// CORS Fix
const proxy = "https://api.allorigins.win/raw?url=";

// Tabs
const tabs = document.querySelectorAll(".tab");
const contents = document.querySelectorAll(".tab-content");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");

    contents.forEach(c => c.classList.remove("active"));
    document.getElementById(tab.dataset.tab).classList.add("active");
  });
});

// Back to top
const backToTop = document.getElementById("back-to-top");

window.addEventListener("scroll", () => {
  backToTop.style.display = window.scrollY > 300 ? "block" : "none";
});

backToTop.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});


// --------------------
// Mini-League Standings
// --------------------
function loadStandings() {
  const url = `https://fantasy.premierleague.com/api/leagues-classic/${LEAGUE_ID}/standings/`;

  fetch(proxy + encodeURIComponent(url))
    .then(res => res.json())
    .then(data => {
      const entries = data.standings.results;
      const container = document.getElementById("standings-list");
      container.innerHTML = "";

      entries.forEach(row => {
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
          <strong>${row.entry_name}</strong> (${row.player_name})<br>
          Rank: ${row.rank}<br>
          Total Points: ${row.total}
        `;
        container.appendChild(card);
      });
    })
    .catch(err => console.error(err));
}

loadStandings();

// --------------------
// Live Points (Per GW)
// --------------------
document.getElementById("load-live").addEventListener("click", () => {
  const gw = document.getElementById("gw-input").value;
  if (!gw) return alert("Enter a valid Gameweek 1–38");

  const url = `https://fantasy.premierleague.com/api/event/${gw}/live/`;

  fetch(proxy + encodeURIComponent(url))
    .then(res => res.json())
    .then(data => {
      const players = data.elements;
      const container = document.getElementById("live-list");
      container.innerHTML = "";

      players.forEach(p => {
        const card = document.createElement("div");
        card.className = "card";
        card.innerHTML = `
          <strong>Player ID: ${p.id}</strong><br>
          Total Points: ${p.stats.total_points}<br>
          Minutes: ${p.stats.minutes}<br>
          Goals: ${p.stats.goals_scored}<br>
          Assists: ${p.stats.assists}
        `;
        container.appendChild(card);
      });
    })
    .catch(err => console.error(err));
});