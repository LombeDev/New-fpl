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
} else {
  themeToggle.textContent = "🌙";
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
   FPL API FETCHING
----------------------------------------- */
const proxy = "https://api.allorigins.win/raw?url=";

// On page load
window.addEventListener("DOMContentLoaded", () => {
  loadStandings();
  loadBPS();
});

/* -----------------------------------------
   MINI-LEAGUE STANDINGS
   Now includes: Manager | Team | GW Points | Total
----------------------------------------- */
async function loadStandings() {
  const container = document.getElementById("standings-list");

  try {
    const leagueID = "101712";

    // Fetch league standings
    const leagueData = await fetch(
      proxy +
        encodeURIComponent(
          `https://fantasy.premierleague.com/api/leagues-classic/${leagueID}/standings/`
        )
    ).then((r) => r.json());

    container.innerHTML = "";

    // Fetch current GW
    const bootstrap = await fetch(
      proxy + encodeURIComponent("https://fantasy.premierleague.com/api/bootstrap-static/")
    ).then((r) => r.json());

    const currentGW = bootstrap.events.find((e) => e.is_current).id;

    // Header
    const header = document.createElement("div");
    header.className = "standings-header";
    header.innerHTML = `
      <span>Manager</span>
      <span>Team</span>
      <span>GW</span>
      <span>Total</span>
    `;
    container.appendChild(header);

    // Load rows
    leagueData.standings.results.forEach((team, index) => {
      setTimeout(async () => {
        // Fetch GW points for each manager
        const gwData = await fetch(
          proxy +
            encodeURIComponent(
              `https://fantasy.premierleague.com/api/entry/${team.entry}/event/${currentGW}/`
            )
        )
          .then((r) => r.json())
          .catch(() => null);

        const gwPoints = gwData?.entry_history?.points || 0;

        const row = document.createElement("div");
        row.className = "standings-row";

        row.innerHTML = `
          <span>${team.player_name}</span>
          <span>${team.entry_name}</span>
          <span>${gwPoints}</span>
          <span>${team.total}</span>
        `;

        // Rank highlights
        if (team.rank === 1) row.classList.add("top-rank");
        if (team.rank === 2) row.classList.add("second-rank");
        if (team.rank === 3) row.classList.add("third-rank");

        container.appendChild(row);
      }, index * 80);
    });
  } catch (err) {
    console.error(err);
    container.textContent = "Failed to load standings.";
  }
}

/* -----------------------------------------
   BPS BREAKDOWN
----------------------------------------- */
async function loadBPS() {
  const container = document.getElementById("bps-list");

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
      proxy +
        encodeURIComponent(
          `https://fantasy.premierleague.com/api/event/${currentGW}/live/`
        )
    ).then((r) => r.json());

    container.innerHTML = "";

    live.elements.forEach((p, index) => {
      setTimeout(() => {
        const div = document.createElement("div");
        div.className = "bps-row";

        div.textContent = `${playerDict[p.id] || "Unknown"} - BPS: ${
          p.stats.bps
        } | Points: ${p.stats.total_points} | G:${p.stats.goals_scored} A:${
          p.stats.assists
        }`;

        if (p.stats.bps >= 25) div.classList.add("high-points");

        container.appendChild(div);
      }, index * 20);
    });
  } catch (err) {
    console.error(err);
    container.textContent = "Failed to load BPS data.";
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