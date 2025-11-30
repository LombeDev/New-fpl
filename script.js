/* -----------------------------------------
   LOADING OVERLAY REMOVAL
----------------------------------------- */
window.addEventListener("load", () => {
  setTimeout(() => {
    const overlay = document.getElementById("loading-overlay");

    if (overlay) {
      overlay.style.opacity = '0';
      setTimeout(() => {
          overlay.style.display = 'none';
      }, 500); 
    }
  }, 900);
});

/* -----------------------------------------
   LIGHT / DARK MODE TOGGLE + SAVE
----------------------------------------- */
const themeToggle = document.getElementById("themeToggle");

if (localStorage.getItem("theme") === "dark") {
  document.body.classList.add("dark-mode");
  themeToggle.textContent = "☀️";
}

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
const proxy = "https://corsproxy.io/?";

// Global variables (essential for mapping)
let teamMap = {}; 
let playerMap = {}; 
let currentGameweekId = null;

// On page load 
window.addEventListener("DOMContentLoaded", () => {
  // We only load the core data fetcher here.
  loadFPLBootstrapData();
  
  // To avoid errors, we comment out all other functions for now.
  // loadStandings();
  // loadGlobalStandings(); 
  // loadEPLTable();     
});

// Function to fetch bootstrap data, create maps, and initialize dependent loads
async function loadFPLBootstrapData() {
    try {
        const data = await fetch(
            proxy + "https://fantasy.premierleague.com/api/bootstrap-static/"
        ).then((r) => r.json());

        // Create map of team ID to 3-letter abbreviation
        data.teams.forEach(team => {
            teamMap[team.id] = team.short_name;
        });

        // Create map of Player ID to Full Name
        data.elements.forEach(player => {
            playerMap[player.id] = `${player.first_name} ${player.second_name}`;
        });
        
        // Determine current Gameweek ID
        let currentEvent = data.events.find(e => e.is_current);
        if (!currentEvent) {
            const finishedEvents = data.events.filter(e => e.finished);
            if (finishedEvents.length > 0) {
                finishedEvents.sort((a, b) => b.id - a.id);
                currentEvent = finishedEvents[0];
            }
        }
        if (currentEvent) {
            currentGameweekId = currentEvent.id;
        } 

        // 🔥 ONLY CALL THE NEW FEATURE WE WANT TO TEST
        loadStatusList(data);

        // Notify that the core data loaded successfully
        console.log("FPL Bootstrap Data Loaded Successfully.");

    } catch (err) {
        console.error("CRITICAL ERROR in loadFPLBootstrapData:", err);
        // Show the error message on the screen so we can see it
        const welcome = document.getElementById("welcome");
        if (welcome) welcome.innerHTML = `<p style="color: red;">CRITICAL ERROR: Failed to fetch FPL data. Check CORS proxy or API URL. Error: ${err.message}</p>`;
    }
}

// 🏥 PLAYER STATUS UPDATES (The feature we are testing)
async function loadStatusList(data) {
    const container = document.getElementById("status-list");
    if (!container || !data) return;
    
    // Clear initial loading content
    container.innerHTML = '';

    // Filter players based on non-available status or playing chance < 100
    const flaggedPlayers = data.elements
        .filter(p => p.status !== 'a' && p.chance_of_playing_this_round !== 100)
        .sort((a, b) => {
            if (a.status < b.status) return -1;
            if (a.status > b.status) return 1;
            return b.total_points - a.total_points; 
        });

    container.innerHTML = "<h3>Player Status Updates ⚠️</h3>";
    const ul = document.createElement('ul');
    ul.classList.add('status-updates-list');

    if (flaggedPlayers.length === 0) {
        container.innerHTML += "<p style='text-align:center;'>No significant player status updates currently.</p>";
        return;
    }

    flaggedPlayers.forEach(p => {
        const teamAbbr = teamMap[p.team] || 'N/A';
        const price = (p.now_cost / 10).toFixed(1);
        let statusText = '';
        let statusClass = 'status-default';
        let playingChance = p.chance_of_playing_this_round !== null ? p.chance_of_playing_this_round : 0;

        // Map status codes and chance to meaningful text and color classes
        if (p.status === 's') {
            statusText = `Suspended`;
            statusClass = 'status-red';
        } else if (p.status === 'i' || p.status === 'n' || p.status === 'c') { 
            statusText = `Injured`;
            statusClass = 'status-red';
        } else if (p.status === 'd' || p.status === 'u') { 
            statusText = `Doubtful (${playingChance}%)`;
            statusClass = 'status-yellow';
        } else if (p.status === 'a' && playingChance < 100) {
            statusText = `Minor Knock (${playingChance}%)`;
            statusClass = 'status-yellow';
        } else {
             return; 
        }

        const listItem = document.createElement('li');
        listItem.classList.add(statusClass);
        
        listItem.innerHTML = `
            <span class="player-name">${p.first_name} ${p.second_name} (${teamAbbr})</span>
            <span class="player-price">£${price}m</span>
            <span class="player-status">${statusText}</span>
            <span class="news-detail" title="${p.news || 'No detail provided'}">${p.news || 'No news detail'}</span>
        `;
        ul.appendChild(listItem);
    });

    container.appendChild(ul);
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