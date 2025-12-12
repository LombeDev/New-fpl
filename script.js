/* -----------------------------------------
    GLOBAL SETUP
----------------------------------------- */
// Using the more reliable proxy for cross-origin requests
const proxy = "https://corsproxy.io/?";

// Global variables initialized at the top
let teamMap = {};    // Team ID -> Abbreviation (e.g., 1 -> 'ARS')
let playerMap = {};  // Player ID -> Full Name
let currentGameweekId = null;

/* -----------------------------------------
    NEW: LOADER MANAGEMENT
----------------------------------------- */
function hideLoadingOverlay() {
    const overlay = document.getElementById("loading-overlay");
    if (overlay) {
        overlay.classList.add('hidden'); 
        setTimeout(() => {
            overlay.remove();
        }, 500); 
    }
}

async function startDataLoadingAndTrackCompletion() {
    try {
        await loadFPLBootstrapData();

        await Promise.all([
            loadStandings(),
            loadGeneralLeagueStandings(),
        ]);

        await new Promise(resolve => setTimeout(resolve, 500));
        hideLoadingOverlay();

    } catch (err) {
        console.error("Critical loading failed:", err);
        hideLoadingOverlay();
    }
}


/* -----------------------------------------
    NAVIGATION MENU TOGGLES
----------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
    const hamburger = document.querySelector('.hamburger');
    const navLinks = document.querySelector('.nav-links');
    const kebab = document.querySelector('.kebab');
    const kebabMenu = document.querySelector('.kebab-menu-dropdown');

    if (hamburger && navLinks) {
        hamburger.addEventListener('click', () => {
            navLinks.classList.toggle('active');
            if (kebabMenu) kebabMenu.classList.remove('active');

            const hamburgerIcon = hamburger.querySelector('i');
            if (hamburgerIcon) {
                if (navLinks.classList.contains('active')) {
                    hamburgerIcon.classList.remove('fa-bars');
                    hamburgerIcon.classList.add('fa-xmark');
                    hamburger.setAttribute('aria-label', 'Close Main Menu');
                } else {
                    hamburgerIcon.classList.remove('fa-xmark');
                    hamburgerIcon.classList.add('fa-bars');
                    hamburger.setAttribute('aria-label', 'Open Main Menu');
                }
            }
        });
    }

    if (kebab && kebabMenu) {
        kebab.addEventListener('click', (event) => {
            kebabMenu.classList.toggle('active');

            if (navLinks) {
                navLinks.classList.remove('active');
                const hamburgerIcon = hamburger.querySelector('i');
                if (hamburgerIcon) {
                    hamburgerIcon.classList.remove('fa-xmark');
                    hamburgerIcon.classList.add('fa-bars');
                    hamburger.setAttribute('aria-label', 'Open Main Menu');
                }
            }
            event.stopPropagation();
        });
    }

    document.addEventListener('click', (event) => {
        if (kebabMenu && !kebabMenu.contains(event.target) && event.target !== kebab && !kebab.contains(event.target)) {
            kebabMenu.classList.remove('active');
        }

        if (navLinks && event.target.closest('.nav-links a')) {
            navLinks.classList.remove('active');
            const hamburgerIcon = hamburger.querySelector('i');
            if (hamburgerIcon) {
                hamburgerIcon.classList.remove('fa-xmark');
                hamburgerIcon.classList.add('fa-bars');
                hamburger.setAttribute('aria-label', 'Open Main Menu');
            }
        }
    });
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
window.addEventListener("DOMContentLoaded", () => {
    startDataLoadingAndTrackCompletion();
});

function getChangeIconHtml(changeValue, isPriceChange) {
    if (changeValue > 0) {
        const icon = isPriceChange ? '▲' : '⬆️';
        const colorClass = isPriceChange ? 'change-up price-up' : 'change-up';
        return `<span class="${colorClass}">${icon}</span>`;
    } else if (changeValue < 0) {
        const icon = isPriceChange ? '▼' : '⬇️';
        const colorClass = isPriceChange ? 'change-down price-down' : 'change-down';
        return `<span class="${colorClass}">${icon}</span>`;
    } else {
        return `<span class="change-no-change">━</span>`;
    }
}

async function loadFPLBootstrapData() {
    try {
        const response = await fetch(
            proxy + "https://fantasy.premierleague.com/api/bootstrap-static/"
        );
        const data = await response.json();

        data.teams.forEach(team => {
            teamMap[team.id] = team.short_name;
        });

        data.elements.forEach(player => {
            playerMap[player.id] = `${player.first_name} ${player.second_name}`;
        });

        let currentEvent = data.events.find(e => e.is_current);

        if (!currentEvent) {
            const finishedEvents = data.events.filter(e => e.finished);
            if (finishedEvents.length > 0) {
                finishedEvents.sort((a, b) => b.id - a.id);
                currentEvent = finishedEvents[0];
            }
        }

        if (currentEvent) currentGameweekId = currentEvent.id;

        loadCurrentGameweekFixtures();
        loadPriceChanges(data);
        loadMostTransferred(data);
        loadMostTransferredOut(data);
        loadMostCaptained(data);
        loadPlayerStatusUpdates(data);
        processDeadlineDisplay(data); 
        loadSimpleEPLTable(data); 

        return data;

    } catch (err) {
        console.error("Error fetching FPL Bootstrap data:", err);
        const sections = ["price-changes-list", "most-transferred-list", "most-transferred-out-list", "most-captained-list", "fixtures-list", "status-list", "countdown-timer"];
        sections.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = "Failed to load data. Check FPL API/Proxy.";
        });
        throw err;
    }
}


/* -----------------------------------------
    GENERAL LEAGUE STANDINGS
----------------------------------------- */
async function loadGeneralLeagueStandings() {
    const container = document.getElementById("general-leagues-list");
    if (!container) return;

    const leaguesToLoad = [
        { id: "258", name: "Zambia", type: "Classic" }, 
        { id: "315", name: "Overall", type: "Classic" }, 
        { id: "276", name: "Gameweek 1", type: "Classic" }, 
        { id: "333", name: "Second Chance", type: "H2H" }, 
    ];

    container.innerHTML = "";

    const loadPromises = leaguesToLoad.map(async (leagueConfig) => {
        const leagueItem = document.createElement('div');
        leagueItem.classList.add('general-league-item');

        const leagueHeader = document.createElement('div');
        leagueHeader.classList.add('general-league-header');
        leagueHeader.innerHTML = `
            <h4>${leagueConfig.name} League Standings</h4>
            <span class="league-type">(${leagueConfig.type})</span>
            <span class="loader-small"></span>
        `;
        
        const standingsContent = document.createElement('div');
        standingsContent.classList.add('league-standings-content');
        
        leagueItem.appendChild(leagueHeader);
        leagueItem.appendChild(standingsContent);
        container.appendChild(leagueItem);

        leagueHeader.addEventListener('click', () => {
            standingsContent.classList.toggle('visible');
            leagueHeader.classList.toggle('active');
        });

        try {
            const apiEndpoint = leagueConfig.type === "H2H" 
                ? `https://fantasy.premierleague.com/api/leagues-h2h/${leagueConfig.id}/standings/`
                : `https://fantasy.premierleague.com/api/leagues-classic/${leagueConfig.id}/standings/`;

            const data = await fetch(proxy + apiEndpoint).then(r => r.json());
            const results = data.standings?.results;

            const loader = leagueHeader.querySelector('.loader-small');
            if (loader) loader.remove();

            if (!results || results.length === 0) {
                standingsContent.innerHTML = `<p class="error-message">No teams found in this league.</p>`;
                return;
            }

            const list = document.createElement('ul');
            list.classList.add('standings-list-general');

            results.forEach((team) => {
                const rankChangeHtml = getChangeIconHtml(team.rank_change, false); 

                const listItem = document.createElement("li");
                listItem.innerHTML = `
                    <span class="rank-number">${team.rank}.</span> 
                    <span class="manager-name">${team.player_name} (${team.entry_name})</span> 
                    ${rankChangeHtml} <span><strong>${team.total}</strong> pts</span>
                `;
                if (team.rank === 1) listItem.classList.add("top-rank-general"); 
                list.appendChild(listItem);
            });

            standingsContent.appendChild(list);

        } catch (err) {
            console.error(`Error loading standings for ${leagueConfig.name}:`, err);
            const loader = leagueHeader.querySelector('.loader-small');
            if (loader) loader.remove();
            standingsContent.innerHTML = `<p class="error-message">❌ Failed to load standings for ${leagueConfig.name}.</p>`;
        }
    });

    await Promise.all(loadPromises);
}


/* -----------------------------------------
    PLAYER STATUS UPDATES
----------------------------------------- */
async function loadPlayerStatusUpdates(data) {
    const container = document.getElementById("status-list");
    if (!container || !data) return;

    container.innerHTML = '';

    try {
        const unavailablePlayers = data.elements
            .filter(player =>
                player.status !== 'a' && player.news.trim().length > 0
            ).sort((a, b) => b.status.localeCompare(a.status));

        if (unavailablePlayers.length === 0) {
            container.innerHTML = '<div class="player-news-item"><p class="no-data">🥳 All relevant players are currently available.</p></div>';
            return;
        }

        const newsHtml = unavailablePlayers.map(player => {
            const teamShortName = teamMap[player.team] || 'N/A';
            const fullName = `${player.first_name} ${player.second_name}`;
            
            let statusLabel = '';
            let statusClass = 'status-default';

            switch (player.status) {
                case 'd':
                    statusLabel = 'Doubtful';
                    statusClass = 'status-doubtful';
                    break;
                case 'i':
                    statusLabel = 'Injured';
                    statusClass = 'status-injured';
                    break;
                case 's':
                    statusLabel = 'Suspended';
                    statusClass = 'status-injured';
                    break;
                case 'u':
                    statusLabel = 'Unavailable';
                    statusClass = 'status-unavailable';
                    break;
                default:
                    statusLabel = 'Uncertain';
                    break;
            }

            return `
                <div class="player-news-item">
                    <div class="player-info">
                        <strong>${fullName} (${teamShortName})</strong>
                        <span class="status-badge ${statusClass}">${statusLabel}</span>
                    </div>
                    <p class="news-detail">${player.news}</p>
                </div>
            `;
        }).join('');

        container.innerHTML = newsHtml;

    } catch (error) {
        console.error("Failed to load player status updates:", error);
        container.innerHTML = '<p class="error-message">❌ Could not load player status updates. Check FPL API/Proxy.</p>';
    }
}


/* -----------------------------------------
    CURRENT GAMEWEEK FIXTURES
----------------------------------------- */
async function loadCurrentGameweekFixtures() {
    const container = document.getElementById("fixtures-list");
    if (!container) return;

    if (!currentGameweekId) {
        container.innerHTML = "<h3>Gameweek Scores</h3><p>Current Gameweek information is not yet available.</p>";
        return;
    }

    try {
        const data = await fetch(
            proxy + "https://fantasy.premierleague.com/api/fixtures/"
        ).then((r) => r.json());

        const currentGWFixtures = data.filter(f => f.event === currentGameweekId);

        if (currentGWFixtures.length === 0) {
            container.innerHTML = `<h3>Gameweek ${currentGameweekId} Scores</h3><p>No fixtures found for Gameweek ${currentGameweekId}.</p>`;
            return;
        }

        container.innerHTML = `<h3>Gameweek ${currentGameweekId} Scores</h3>`;

        const list = document.createElement('ul');
        list.classList.add('fixtures-list-items');

        currentGWFixtures.forEach(fixture => {
            const homeTeamAbbr = teamMap[fixture.team_h] || `T${fixture.team_h}`;
            const awayTeamAbbr = teamMap[fixture.team_a] || `T${fixture.team_a}`;

            let scoreDisplay = `<span class="vs-label">vs</span>`;
        });

    } catch (error) {
        container.innerHTML = `<p class="error-message">Failed to load fixtures.</p>`;
    }
}