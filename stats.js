const FIXTURES_URL = "https://fantasy.premierleague.com/api/fixtures/";

async function init(force = false) {
    const lastFetched = localStorage.getItem(CACHE_TIME);
    const now = Date.now();

    // Fetch both Bootstrap Static and Fixtures
    try {
        const [bootData, fixtureData] = await Promise.all([
            fetchData(API_URL),
            fetchData(FIXTURES_URL)
        ]);

        if (bootData && fixtureData) {
            localStorage.setItem(CACHE_KEY, JSON.stringify(bootData));
            localStorage.setItem(CACHE_TIME, now.toString());
            processData(bootData, fixtureData);
            updateCacheUI(now, false);
        }
    } catch (e) {
        console.error("Initialization failed", e);
    }
}

async function fetchData(url) {
    for (let proxy of PROXIES) {
        try {
            const response = await fetch(`${proxy}${encodeURIComponent(url)}`);
            const result = await response.json();
            return result.contents ? JSON.parse(result.contents) : result;
        } catch (e) { continue; }
    }
    return null;
}

function processData(data, fixtures) {
    const teams = Object.fromEntries(data.teams.map(t => [t.id, { 
        name: t.name, 
        short: t.short_name,
        id: t.id
    }]));

    // 1. Process Predictor Table (Existing logic)
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

    // 2. Process Fixture Ticker
    renderTicker(data.teams, fixtures);
    
    document.getElementById('loader').style.display = 'none';
    render(); // Render Predictor
}

function renderTicker(teams, allFixtures) {
    const tickerBody = document.getElementById('ticker-body');
    const headerRow = document.getElementById('ticker-gw-headers');
    const teamMap = Object.fromEntries(teams.map(t => [t.id, t.short_name]));
    
    // Get upcoming fixtures (not finished)
    const upcoming = allFixtures.filter(f => !f.finished).slice(0, 100);
    
    // Determine the next 5 unique Gameweeks available
    const nextGWs = [...new Set(upcoming.map(f => f.event))].filter(Boolean).slice(0, 5);
    
    // Update Headers
    headerRow.innerHTML = '<th style="text-align: left; padding-left:15px;">Team</th>' + 
                          nextGWs.map(gw => `<th>GW${gw}</th>`).join('');

    tickerBody.innerHTML = teams.map(team => {
        const teamFixtures = nextGWs.map(gw => {
            const f = upcoming.find(fixture => 
                fixture.event === gw && (fixture.team_h === team.id || fixture.team_a === team.id)
            );
            
            if (!f) return `<td>-</td>`;
            
            const isHome = f.team_h === team.id;
            const opponent = isHome ? teamMap[f.team_a] : teamMap[f.team_h];
            const difficulty = isHome ? f.team_h_difficulty : f.team_a_difficulty;
            const venue = isHome ? '(H)' : '(A)';
            
            // Lowercase for Away, Uppercase for Home (Classic FPL style)
            const displayOpp = isHome ? opponent.toUpperCase() : opponent.toLowerCase();

            return `<td class="fdr-${difficulty}">${displayOpp} ${venue}</td>`;
        }).join('');

        return `<tr><td class="team-cell">${team.short_name}</td>${teamFixtures}</tr>`;
    }).join('');

    document.getElementById('ticker-loader').style.display = 'none';
    document.getElementById('ticker-table').style.display = 'table';
}
