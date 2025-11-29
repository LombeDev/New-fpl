const proxy = "https://api.allorigins.win/raw?url=";

window.addEventListener("DOMContentLoaded", () => {
  loadStandings();
  loadLivePoints();
  loadBPS();
});

// MINI-LEAGUE STANDINGS
async function loadStandings() {
  const container = document.getElementById("standings-list");
  try {
    const leagueID = "101712";
    const response = await fetch(proxy + encodeURIComponent(`https://fantasy.premierleague.com/api/leagues-classic/${leagueID}/standings/`));
    const data = await response.json();

    container.innerHTML = "";
    data.standings.results.forEach((team, index) => {
      setTimeout(() => { // lazy load each line
        const div = document.createElement("div");
        div.className = "fade-in";
        div.textContent = `${team.rank}. ${team.player_name} (${team.entry_name}) - ${team.total} pts`;
        container.appendChild(div);
      }, index * 50); // stagger fade-in
    });
  } catch (err) {
    container.textContent = "Failed to load standings.";
  }
}

// LIVE POINTS
async function loadLivePoints() {
  const container = document.getElementById("live-list");
  try {
    const bootstrap = await fetch(proxy + encodeURIComponent("https://fantasy.premierleague.com/api/bootstrap-static/")).then(r=>r.json());
    const currentGW = bootstrap.events.find(e=>e.is_current).id;
    const live = await fetch(proxy + encodeURIComponent(`https://fantasy.premierleague.com/api/event/${currentGW}/live/`)).then(r=>r.json());

    container.innerHTML = "";
    live.elements.forEach((p, index) => {
      setTimeout(() => {
        const div = document.createElement("div");
        div.className = "fade-in";
        div.textContent = `Player ID ${p.id} - ${p.stats.total_points} pts (G:${p.stats.goals_scored} A:${p.stats.assists})`;
        container.appendChild(div);
      }, index * 30);
    });
  } catch (err) {
    container.textContent = "Failed to load live points.";
  }
}

// BPS BREAKDOWN
async function loadBPS() {
  const container = document.getElementById("bps-list");
  try {
    const bootstrap = await fetch(proxy + encodeURIComponent("https://fantasy.premierleague.com/api/bootstrap-static/")).then(r=>r.json());
    const playerDict = {};
    bootstrap.elements.forEach(p=>playerDict[p.id] = `${p.first_name} ${p.second_name}`);
    const currentGW = bootstrap.events.find(e=>e.is_current).id;
    const live = await fetch(proxy + encodeURIComponent(`https://fantasy.premierleague.com/api/event/${currentGW}/live/`)).then(r=>r.json());

    container.innerHTML = "";
    live.elements.forEach((p, index) => {
      setTimeout(() => {
        const div = document.createElement("div");
        div.className = "fade-in";
        div.textContent = `${playerDict[p.id] || 'Unknown'} - BPS: ${p.stats.bps} | ${p.stats.total_points} pts | G:${p.stats.goals_scored} A:${p.stats.assists}`;
        container.appendChild(div);
      }, index * 30);
    });
  } catch (err) {
    container.textContent = "Failed to load BPS.";
  }
}

// BACK TO TOP BUTTON
const backToTop = document.getElementById("backToTop");

// Show button after scrolling down 200px
window.addEventListener("scroll", () => {
  if (window.scrollY > 200) {
    backToTop.style.display = "flex";
  } else {
    backToTop.style.display = "none";
  }
});

// Smooth scroll to top
backToTop.addEventListener("click", () => {
  window.scrollTo({
    top: 0,
    behavior: "smooth"
  });
});