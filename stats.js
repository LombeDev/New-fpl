// 1. Configuration - Using Netlify Proxies
const API_URL = "/fpl-api/bootstrap-static/";
const FIXTURES_URL = "/fpl-api/fixtures/";

let allPlayers = [];
let viewMode = 'rise';

// 2. Main Initialization
async function init() {
    try {
        console.log("Fetching FPL data via Netlify proxy...");
        
        // Fetch both datasets simultaneously
        const [bootData, fixtureData] = await Promise.all([
            fetchData(API_URL),
            fetchData(FIXTURES_URL)
        ]);

        if (bootData && fixtureData) {
            processAllData(bootData, fixtureData);
        } else {
            throw new Error("Data returned null");
        }
    } catch (error) {
        console.error("Init Error:", error);
        document.getElementById('loader').innerHTML = "⚠️ Failed to load. Check Netlify _redirects.";
        document.getElementById('ticker-loader').innerHTML = "⚠️ Fixtures unavailable.";
    }
}

// 3. Helper: Fetch Data
async function fetchData(url) {
    try {
        const response = await fetch(url);
        if (!response.ok) return null;
        return await response.json();
    } catch (e) {
        return null;
    }
}

// 4. Data Processing
function processAllData(data, fixtures) {
    // Map teams for easy lookup
    const teams = Object.fromEntries(data.teams.map(t => [t.id, { 
        name: t.name, 
        short: t.short_name 
    }]));

    // A. Process Predictor Logic
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

    // B. Render Sections
    renderPredictor();
    renderTicker(data.teams, fixtures);

    // C. UI Polish
    document.getElementById('loader').style.display = 'none';
    document.getElementById('ticker-loader').style.display = 'none';
    document.getElementById('ticker-table').style.display = 'table';
}

// 5. Render: Fixture Ticker
function renderTicker(teams, allFixtures) {
    const tickerBody = document.getElementById('ticker-body');
    const headerRow = document.getElementById('ticker-gw-headers');
    const teamMap = Object.fromEntries(teams.map(t => [t.id, t.short_name]));
    
    // Filter for upcoming games and find the next 5 unique Gameweeks
    const upcoming = allFixtures.filter(f => !f.finished && f.event !== null);
    const nextGWs = [...new Set(upcoming.map(f => f.event))].sort((a, b) => a - b).slice(0, 5);
    
    // Set GW Headers
    headerRow.innerHTML = '<th style="text-align: left; padding-left:15px;">Team</th>' + 
                          nextGWs.map(gw => `<th>GW${gw}</th>`).join('');

    // Generate Rows
    tickerBody.innerHTML = teams.map(team => {
        const cells = nextGWs.map(gw => {
            const f = upcoming.find(fixture => 
                fixture.event === gw && (fixture.team_h === team.id || fixture.team_a === team.id)
            );
            
            if (!f) return `<td>-</td>`;
            
            const isHome = f.team_h === team.id;
            const oppName = isHome ? teamMap[f.team_a] : teamMap[f.team_h];
            const diff = isHome ? f.team_h_difficulty : f.team_a_difficulty;
            
            // Uppercase for Home, Lowercase for Away
            const displayOpp = isHome ? oppName.toUpperCase() : oppName.toLowerCase();
            const venue = isHome ? '(H)' : '(A)';

            return `<td class="fdr-${diff}">${displayOpp} ${venue}</td>`;
        }).join('');

        return `<tr><td class="team-cell"><strong>${team.short_name}</strong></td>${cells}</tr>`;
    }).join('');
}

// 6. Render: Price Predictor (Existing Logic)
function renderPredictor() {
    const body = document.getElementById('predictor-body');
    const searchVal = document.getElementById('playerSearch').value.toLowerCase();
    
    const filtered = allPlayers.filter(p => {
        const matchesSearch = p.name.toLowerCase().includes(searchVal);
        const matchesView = (viewMode === 'rise' ? p.prog >= -5 : p.prog < 0);
        return matchesSearch && matchesView;
    }).sort((a,b) => viewMode === 'rise' ? b.prog - a.prog : a.prog - b.prog);

    body.innerHTML = filtered.slice(0, 50).map(p => {
        const barColor = viewMode === 'rise' ? '#00ff85' : '#ff005a';
        const nextPrice = (parseFloat(p.price) + (viewMode === 'rise' ? 0.1 : -0.1)).toFixed(1);

        return `
            <tr>
                <td><strong>${p.name}</strong><br><small>${p.pos}</small></td>
                <td>${p.team}</td>
                <td>${p.prog}% <div class="bar-bg"><div class="bar-fill" style="width:${Math.abs(p.prog)}%; background:${barColor}"></div></div></td>
                <td>£${p.price} → <span style="color:${barColor}">£${nextPrice}</span></td>
                <td>${p.pred}%</td>
                <td><i class="fa-solid fa-arrow-${viewMode === 'rise' ? 'up' : 'down'}" style="color:${barColor}"></i></td>
            </tr>
        `;
    }).join('');
}

// 7. Event Listeners
document.getElementById('playerSearch').addEventListener('input', renderPredictor);
document.getElementById('btnRise').onclick = () => { viewMode = 'rise'; renderPredictor(); };
document.getElementById('btnFall').onclick = () => { viewMode = 'fall'; renderPredictor(); };

// 8. Start the App
init();
