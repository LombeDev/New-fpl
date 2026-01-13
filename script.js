/**
 * KOPALA FPL - Netlify Integrated Core
 */

const state = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    playerMap: {}, 
    livePoints: {},
    currentGW: 1, 
};

const PROXY_ENDPOINT = "/.netlify/functions/fpl-proxy?endpoint=";

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize DB
    await loadPlayerDatabase();

    // 2. Auto-login if ID exists
    if (state.fplId) {
        document.getElementById('team-id-input').value = state.fplId;
        handleLogin();
    }
});

/** * DATA ENGINE 
 */
async function loadPlayerDatabase() {
    try {
        const res = await fetch(`${PROXY_ENDPOINT}bootstrap-static/`);
        const data = await res.json();
        data.elements.forEach(p => state.playerMap[p.id] = p.web_name);
        const activeGW = data.events.find(e => e.is_current);
        if (activeGW) state.currentGW = activeGW.id;
    } catch (err) { console.error("DB Load Error", err); }
}

async function handleLogin() {
    const id = document.getElementById('team-id-input').value;
    if (!id || isNaN(id)) return alert("Enter a numeric Team ID");
    
    state.fplId = id;
    localStorage.setItem('kopala_fpl_id', id);
    
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    
    await fetchManagerData();
}

async function fetchManagerData() {
    try {
        const res = await fetch(`${PROXY_ENDPOINT}entry/${state.fplId}/`);
        const data = await res.json();
        
        // Update Stats Bar
        document.getElementById('disp-name').textContent = `${data.player_first_name} ${data.player_last_name}`;
        document.getElementById('disp-gw').textContent = data.summary_event_points || 0;
        document.getElementById('disp-total').textContent = data.summary_overall_points.toLocaleString();
        
        const rankEl = document.getElementById('disp-rank');
        const rankVal = data.summary_overall_rank || 0;
        rankEl.textContent = rankVal.toLocaleString();
        // Dynamic Scaling
        rankEl.style.fontSize = rankVal > 1000000 ? "1rem" : "1.2rem";

        populateLeagueSelector(data.leagues.classic);
        if (data.leagues.classic.length > 0) changeLeague(data.leagues.classic[0].id);
        
    } catch (err) { console.error("Manager Sync Error", err); }
}

function populateLeagueSelector(leagues) {
    const select = document.getElementById('league-select');
    select.innerHTML = leagues.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
}

async function changeLeague(id) {
    try {
        const res = await fetch(`${PROXY_ENDPOINT}leagues-classic/${id}/standings/`);
        const data = await res.json();
        const body = document.getElementById('league-body');
        body.innerHTML = data.standings.results.map(r => `
            <tr onclick="loadPitchView(${r.entry})">
                <td>${r.rank}</td>
                <td><strong>${r.entry_name}</strong><br><small>${r.player_name}</small></td>
                <td class="score-text">${r.event_total}</td>
                <td>${r.total.toLocaleString()}</td>
            </tr>
        `).join('');
    } catch (err) { console.error("League Error", err); }
}

/** * PITCH & BPS LOGIC 
 */
async function loadPitchView(managerId) {
    showView('pitch');
    try {
        const [pResp, lResp] = await Promise.all([
            fetch(`${PROXY_ENDPOINT}entry/${managerId}/event/${state.currentGW}/picks/`),
            fetch(`${PROXY_ENDPOINT}event/${state.currentGW}/live/`)
        ]);
        
        const pData = await pResp.json();
        const lData = await lResp.json();

        // Update Live Points Map
        lData.elements.forEach(el => state.livePoints[el.id] = el.stats.total_points);

        // Render Pitch
        const rows = ['row-gkp', 'row-def', 'row-mid', 'row-fwd'];
        rows.forEach(r => document.getElementById(r).innerHTML = '');

        pData.picks.slice(0, 11).forEach(pick => {
            const player = state.playerMap[pick.element]; // Name from map
            const pts = (state.livePoints[pick.element] || 0) * pick.multiplier;
            const pos = getRowId(pick.element); // This would require a lookup from allPlayers data
            
            // Note: For full images/positions, we'd reference the bootstrap data
            // Keeping it simple for the functional demo:
        });

        // Update BPS List
        const topBps = lData.elements.sort((a,b) => b.stats.bps - a.stats.bps).slice(0, 3);
        document.getElementById('bps-list').innerHTML = `<p>TOP BPS</p>` + 
            topBps.map(p => `<div>${state.playerMap[p.id]}: ${p.stats.bps}</div>`).join('');

    } catch (err) { console.error("Pitch Sync Error", err); }
}

/** * UI UTILITIES 
 */
function showView(view) {
    document.getElementById('table-view').style.display = view === 'table' ? 'block' : 'none';
    document.getElementById('pitch-view').style.display = view === 'pitch' ? 'flex' : 'none';
    document.getElementById('tab-table').classList.toggle('active', view === 'table');
    document.getElementById('tab-pitch').classList.toggle('active', view === 'pitch');
}

function toggleSettings() {
    document.getElementById('settings-drawer').classList.toggle('open');
}

function toggleDarkMode() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function resetApp() {
    localStorage.removeItem('kopala_fpl_id');
    location.reload();
}
