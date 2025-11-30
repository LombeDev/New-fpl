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

/* ----------------------------------------------------
   LIVE FIXTURES + LIVE SCORES (Scorebat API - NO KEY)
-----------------------------------------------------*/

const SCOREBAT_API = "https://www.scorebat.com/video-api/v3/feed/?token=null"; 
// Token=null = free public access

async function fetchJSON(url) {
    try {
        const res = await fetch(url);
        return await res.json();
    } catch (err) {
        console.error("Fetch failed:", err);
        return null;
    }
}

/* -------------------------
   LOAD LIVE FIXTURES + SCORES
-------------------------*/
async function loadLiveFixtures() {
    const box = document.getElementById("fixtures-list");
    box.innerHTML = `<div class="loader"></div>`;

    const data = await fetchJSON(SCOREBAT_API);
    if (!data || !data.response) {
        box.innerHTML = "Failed to load fixtures.";
        return;
    }

    // Filter only PREMIER LEAGUE games
    const epl = data.response.filter(item =>
        item.competition?.toLowerCase().includes("premier league")
    );

    if (epl.length === 0) {
        box.innerHTML = "No current EPL fixtures.";
        return;
    }

    box.innerHTML = "";

    epl.forEach(match => {
        const div = document.createElement("div");
        div.className = "fixture";

        const home = match.title.split(" vs ")[0] || "Home";
        const away = match.title.split(" vs ")[1] || "Away";

        const status = match.matchviewUrl ? "LIVE" : "Finished";

        div.innerHTML = `
            <strong>${home} vs ${away}</strong><br>
            <span>⏱ ${match.date}</span><br>
            <span><b>${match.side1?.score ?? "-"} - ${match.side2?.score ?? "-"}</b></span><br>
            <small>${status}</small>
        `;

        box.appendChild(div);
    });
}

/* -------------------------
   EPL TABLE (Still no key)
-------------------------*/

const TABLE_URL = "https://raw.githubusercontent.com/openfootball/england/master/2024-25/en.1.standings.json";

async function loadEPLTable() {
    const box = document.getElementById("epl-table");
    box.innerHTML = `<div class="loader"></div>`;

    const data = await fetchJSON(TABLE_URL);
    if (!data || !data.standings) {
        box.innerHTML = "Failed to load EPL Table.";
        return;
    }

    box.innerHTML = "";

    data.standings.forEach(team => {
        const div = document.createElement("div");
        div.className = "epl-row";

        div.innerHTML = `
            ${team.position}. ${team.team} — ${team.points} pts 
            (W:${team.wins} D:${team.draws} L:${team.losses})
        `;

        box.appendChild(div);
    });
}

/* -------------------------
   INIT ON PAGE LOAD
-------------------------*/
window.addEventListener("DOMContentLoaded", () => {
    loadLiveFixtures();
    loadEPLTable();
});

// BACK TO TOP
const backToTop = document.getElementById("backToTop");
window.addEventListener("scroll", () => {
  backToTop.style.display = window.scrollY > 200 ? "flex" : "none";
});
backToTop.addEventListener("click", () => {
  window.scrollTo({ top: 0, behavior: "smooth" });
});