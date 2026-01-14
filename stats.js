/**
 * KOPALA FPL - STATS ENGINE
 * Handles: Summary, Ownership by Position, and Rival Comparison
 */

// 1. VIEW SWITCHER FOR STATS SUB-TABS
function showSubView(sub) {
    const subs = ['summary', 'ownership', 'compare'];
    subs.forEach(s => {
        const el = document.getElementById(`sub-view-${s}`);
        const tab = document.getElementById(`sub-tab-${s}`);
        if (el) el.style.display = s === sub ? 'block' : 'none';
        if (tab) tab.classList.toggle('active', s === sub);
    });
}

// 2. MAIN STATS RENDERER
async function renderLeagueStats() {
    const leagueId = document.getElementById('league-select').value;
    const comparisonBody = document.getElementById('comparison-body');
    const rivalSelect = document.getElementById('rival-select');

    if (!leagueId) return;

    try {
        comparisonBody.innerHTML = '<tr><td colspan="4">Calculating league insights...</td></tr>';

        // Fetch Standings
        const res = await fetch(`${FPL_PROXY}leagues-classic/${leagueId}/standings/`);
        const data = await res.json();
        const standings = data.standings.results;

        // Update Rival Dropdown for the 'Compare' Tab
        rivalSelect.innerHTML = '<option value="">Choose a Manager...</option>' + 
            standings.filter(m => m.entry != state.fplId)
                     .map(m => `<option value="${m.entry}">${m.player_name}</option>`).join('');

        // Fetch picks for the Top 50 (or total league size if smaller)
        const top50 = standings.slice(0, 50);
        const allPicks = await Promise.all(top50.map(m => 
            fetch(`${FPL_PROXY}entry/${m.entry}/event/${state.currentGW}/picks/`).then(r => r.json())
        ));

        // Data Processing
        let totalGw = 0, totalHits = 0, totalOverall = 0;
        const ownershipMap = {};
        const captainMap = {};

        allPicks.forEach((p, index) => {
            totalGw += p.entry_history.points;
            totalHits += p.entry_history.event_transfers_cost;
            totalOverall += top50[index].total;

            p.picks.forEach(pick => {
                ownershipMap[pick.element] = (ownershipMap[pick.element] || 0) + 1;
                if(pick.is_captain) captainMap[pick.element] = (captainMap[pick.element] || 0) + 1;
            });
        });

        const count = allPicks.length;
        const avg = { gw: totalGw/count, hits: totalHits/count, total: totalOverall/count };
        const myData = standings.find(m => m.entry == state.fplId);
        const myPicks = allPicks.find((p, i) => top50[i].entry == state.fplId);

        // A. Render Summary Table
        comparisonBody.innerHTML = `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="text-align:left; color:#666; font-weight:400;">League Average</td>
                <td>${avg.gw.toFixed(1)}</td>
                <td>-${avg.hits.toFixed(1)}</td>
                <td>${avg.total.toFixed(0)}</td>
            </tr>
            <tr style="border-bottom: 1px solid #eee;">
                <td style="text-align:left; color:var(--fpl-purple);">My Team</td>
                <td>${myPicks.entry_history.points}</td>
                <td>-${myPicks.entry_history.event_transfers_cost}</td>
                <td>${myData.total}</td>
            </tr>
            <tr style="color:var(--fpl-pink);">
                <td style="text-align:left;">Difference</td>
                <td>${(myPicks.entry_history.points - avg.gw) > 0 ? '+' : ''}${(myPicks.entry_history.points - avg.gw).toFixed(1)}</td>
                <td>${(avg.hits - myPicks.entry_history.event_transfers_cost).toFixed(1)}</td>
                <td>${(myData.total - avg.total) > 0 ? '+' : ''}${Math.round(myData.total - avg.total)}</td>
            </tr>
        `;

        // B. Render Top 3 Scorers of the Week
        const top3 = [...standings].sort((a,b) => b.event_total - a.event_total).slice(0, 3);
        document.getElementById('top-managers-list').innerHTML = top3.map((m, i) => `
            <div style="display:flex; justify-content:space-between; padding:10px 0; border-bottom:1px solid #f9f9f9;">
                <span style="font-size:0.85rem;">${i+1}. ${m.player_name}</span>
                <span style="font-weight:bold; color:var(--fpl-purple);">${m.event_total} pts</span>
            </div>
        `).join('');

        // C. Render Rounded Captain Faces
        renderTopCaptains(captainMap);

        // D. Render Ownership Grid
        renderOwnership(ownershipMap, count);

    } catch (err) {
        console.error("Stats Error:", err);
        comparisonBody.innerHTML = '<tr><td colspan="4">Error loading league data.</td></tr>';
    }
}

// 3. RENDER ROUNDED CAPTAIN FACES
function renderTopCaptains(map) {
    const sorted = Object.entries(map).sort((a,b) => b[1] - a[1]).slice(0, 3);
    const container = document.getElementById('top-captains-list');
    
    container.innerHTML = sorted.map(([id, count]) => {
        const p = state.playerMap[id];
        return `
            <div style="text-align:center;">
                <img class="player-face-circle" src="https://resources.premierleague.com/premierleague/photos/players/110x140/p${p.code}.png" 
                     onerror="this.src='https://fantasy.premierleague.com/static/media/player-missing-110.6625805d.png'">
                <div style="font-size: 0.7rem; font-weight: bold; margin-top:5px;">${p.name}</div>
                <div style="font-size: 0.65rem; color: var(--fpl-pink); font-weight:800;">${count} Picks</div>
            </div>
        `;
    }).join('');
}

// 4. RENDER OWNERSHIP BY POSITION
function renderOwnership(map, total) {
    const players = Object.entries(map).map(([id, count]) => ({
        id, count, pct: Math.round((count/total)*100), ...state.playerMap[id]
    }));

    [1, 2, 3, 4].forEach(pos => {
        const topPlayers = players.filter(p => p.pos === pos).sort((a,b) => b.count - a.count).slice(0, 4);
        const grid = document.getElementById(`pos-${pos}`);
        if (grid) {
            grid.innerHTML = topPlayers.map(p => `
                <div class="player-item">
                    <img class="player-face-circle" src="https://resources.premierleague.com/premierleague/photos/players/110x140/p${p.code}.png" 
                         onerror="this.src='https://fantasy.premierleague.com/static/media/player-missing-110.6625805d.png'">
                    <span class="ownership-pct">${p.pct}%</span>
                    <span class="player-name-small">${p.name}</span>
                </div>
            `).join('');
        }
    });
}

// 5. RIVAL COMPARISON LOGIC
async function runRivalComparison(rivalId) {
    if (!rivalId) return;
    const resultDiv = document.getElementById('comparison-results');
    resultDiv.innerHTML = '<div class="loading-pulse">Comparing squads...</div>';

    try {
        const [myRes, rivalRes] = await Promise.all([
            fetch(`${FPL_PROXY}entry/${state.fplId}/event/${state.currentGW}/picks/`),
            fetch(`${FPL_PROXY}entry/${rivalId}/event/${state.currentGW}/picks/`)
        ]);

        const myData = await myRes.json();
        const rivalData = await rivalRes.json();

        const myPicks = myData.picks.map(p => p.element);
        const rivalPicks = rivalData.picks.map(p => p.element);

        const myDifferentials = myPicks.filter(id => !rivalPicks.includes(id));
        const rivalDifferentials = rivalPicks.filter(id => !myPicks.includes(id));

        resultDiv.innerHTML = `
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px; text-align: left; margin-top:15px;">
                <div>
                    <h5 style="color:var(--fpl-purple); border-bottom:1px solid #eee;">Only You Have</h5>
                    ${myDifferentials.map(id => `<div style="font-size:0.75rem; padding:3px 0;">• ${state.playerMap[id].name}</div>`).join('')}
                </div>
                <div>
                    <h5 style="color:var(--fpl-pink); border-bottom:1px solid #eee;">Only Rival Has</h5>
                    ${rivalDifferentials.map(id => `<div style="font-size:0.75rem; padding:3px 0;">• ${state.playerMap[id].name}</div>`).join('')}
                </div>
            </div>
            <div style="margin-top:15px; padding-top:10px; border-top:1px dashed #ccc; font-size:0.8rem;">
                <strong>Captain Battle:</strong><br>
                You: ${state.playerMap[myData.picks.find(p => p.is_captain).element].name} <br>
                Rival: ${state.playerMap[rivalData.picks.find(p => p.is_captain).element].name}
            </div>
        `;
    } catch (e) {
        resultDiv.innerHTML = "Error comparing teams.";
    }
}
