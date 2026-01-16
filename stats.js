const API_URL = "https://fantasy.premierleague.com/api/bootstrap-static/";
const FIXTURES_URL = "https://fantasy.premierleague.com/api/fixtures/";
const PROXIES = [
    "https://corsproxy.io/?url=",
    "https://api.allorigins.win/get?url="
];

let allPlayers = [];
let viewMode = 'rise';

async function init() {
    const loader = document.getElementById('loader');
    const tickerLoader = document.getElementById('ticker-loader');

    try {
        // Fetch both datasets simultaneously
        const [bootData, fixtureData] = await Promise.all([
            fetchWithProxy(API_URL),
            fetchWithProxy(FIXTURES_URL)
        ]);

        if (!bootData || !fixtureData) {
            throw new Error("Could not load FPL data");
        }

        // Process everything
        processData(bootData, fixtureData);
        
    } catch (error) {
        console.error("Initialization Error:", error);
        if(loader) loader.innerText = "⚠️ Error loading data. Please refresh.";
        if(tickerLoader) tickerLoader.innerText = "⚠️ Fixtures unavailable.";
    }
}

async function fetchWithProxy(url) {
    for (let proxy of PROXIES) {
        try {
            const response = await fetch(`${proxy}${encodeURIComponent(url)}`);
            if (!response.ok) continue;
            const data = await response.json();
            // Handle AllOrigins wrapper vs direct JSON
            return data.contents ? JSON.parse(data.contents) : data;
        } catch (e) {
            console.warn(`Proxy ${proxy} failed for ${url}`);
        }
    }
    return null;
}

function processData(data, fixtures) {
    const teams = Object.fromEntries(data.teams.map(t => [t.id, { 
        name: t.name, 
        short: t.short_name 
    }]));

    // 1. Predictor Logic
    allPlayers = data.elements.map(p => {
        const net = p.transfers_in_event - p.transfers_out_event;
        const currentPrice = p.now_cost / 10;
        return {
            name: p.web_name,
            team: teams[p.team].short,
            price: currentPrice.toFixed(1),
            prog: parseFloat((net / 480).toFixed(1)),
            pred: parseFloat(((net / 480) * 1.05).toFixed(1)),
            pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type]
        };
    });

    // 2. Render Both Sections
    renderPredictor();
    renderTicker(data.teams, fixtures);

    // Hide Loaders
    document.getElementById('loader').style.display = 'none';
    document.getElementById('ticker-loader').style.display = 'none';
    document.getElementById('ticker-table').style.display = 'table';
}

function renderTicker(teams, allFixtures) {
    const tickerBody = document.getElementById('ticker-body');
    const headerRow = document.getElementById('ticker-gw-headers');
    const teamMap = Object.fromEntries(teams.map(t => [t.id, t.short_name]));
    
    // Get upcoming Gameweeks
    const upcoming = allFixtures.filter(f => !f.finished);
    const nextGWs = [...new Set(upcoming.map(f => f.event))].filter(n => n != null).slice(0, 5);
    
    // Headers
    headerRow.innerHTML = '<th style="text-align: left; padding-left:15px;">Team</th>' + 
                          nextGWs.map(gw => `<th>GW${gw}</th>`).join('');

    // Rows
    tickerBody.innerHTML = teams.map(team => {
        const cells = nextGWs.map(gw => {
            const f = upcoming.find(fixture => 
                fixture.event === gw && (fixture.team_h === team.id || fixture.team_a === team.id)
            );
            
            if (!f) return `<td>-</td>`;
            
            const isHome = f.team_h === team.id;
            const oppId = isHome ? f.team_a : f.team_h;
            const oppName = teamMap[oppId];
            const diff = isHome ? f.team_h_difficulty : f.team_a_difficulty;
            
            return `<td class="fdr-${diff}">${isHome ? oppName.toUpperCase() : oppName.toLowerCase()} ${isHome ? '(H)' : '(A)'}</td>`;
        }).join('');

        return `<tr><td class="team-cell">${team.short_name}</td>${cells}</tr>`;
    }).join('');
}

function renderPredictor() {
    // ... insert your existing render() function logic here ...
    // Note: ensure you rename it to renderPredictor or update the call
}

// Initial Call
init();
