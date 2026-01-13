/**
 * KOPALA FPL - ULTIMATE INTEGRATED CORE
 * Features: Live Standings, Manager Expansion Pitch, and Match Center
 */

const state = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    playerMap: {}, 
    livePoints: {},
    currentGW: 1, 
};

// Netlify Proxy or Local Proxy
const PROXY_ENDPOINT = "/.netlify/functions/fpl-proxy?endpoint=";
const FIXTURES_ENDPOINT = "/.netlify/functions/fpl-proxy?endpoint=fixtures/?event=";

let refreshTimer = null;
let teamLookup = {}; // For Match Center

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Player Database & Teams
    await initAppData();

    // 2. Auto-login if ID exists
    if (state.fplId) {
        document.getElementById('team-id-input').value = state.fplId;
        handleLogin();
    }
});

/** * 1. DATA INITIALIZATION 
 */
async function initAppData() {
    try {
        const res = await fetch(`${PROXY_ENDPOINT}bootstrap-static/`);
        const data = await res.json();
        
        // Map players for the Pitch Expansion
        data.elements.forEach(p => {
            state.playerMap[p.id] = {
                name: p.web_name,
                pos: p.element_type,
                team: p.team
            };
        });

        // Map teams for Match Center
        data.teams.forEach(t => teamLookup[t.id] = t.name);
        
        const activeGW = data.events.find(e => e.is_current) || data.events.find(e => !e.finished);
        if (activeGW) state.currentGW = activeGW.id;

    } catch (err) { console.error("Initialization Error", err); }
}

/** * 2. MANAGER & LEAGUE LOGIC 
 */
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
        
        document.getElementById('disp-name').textContent = `${data.player_first_name} ${data.player_last_name}`;
        document.getElementById('disp-gw').textContent = data.summary_event_points || 0;
        document.getElementById('disp-total').textContent = data.summary_overall_points.toLocaleString();
        document.getElementById('disp-rank').textContent = (data.summary_overall_rank || 0).toLocaleString();

        const select = document.getElementById('league-select');
        select.innerHTML = data.leagues.classic.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
        
        if (data.leagues.classic.length > 0) changeLeague(data.leagues.classic[0].id);
    } catch (err) { console.error("Manager Sync Error", err); }
}

async function changeLeague(id) {
    try {
        const res = await fetch(`${PROXY_ENDPOINT}leagues-classic/${id}/standings/`);
        const data = await res.json();
        const body = document.getElementById('league-body');
        
        body.innerHTML = data.standings.results.map(r => `
            <tr id="row-${r.entry}" class="manager-row" onclick="toggleManagerExpansion(${r.entry})">
                <td>${r.rank}</td>
                <td><strong>${r.entry_name}</strong><br><small>${r.player_name}</small></td>
                <td class="score-text">${r.event_total}</td>
                <td>${r.total.toLocaleString()}</td>
            </tr>
        `).join('');
    } catch (err) { console.error("League Error", err); }
}

/** * 3. MANAGER EXPANSION (Mini-Pitch) 
 */
async function toggleManagerExpansion(managerId) {
    const existing = document.querySelector('.details-row');
    const targetRow = document.getElementById(`row-${managerId}`);

    if (existing && existing.previousElementSibling === targetRow) {
        existing.remove();
        return;
    }
    if (existing) existing.remove();

    const template = document.getElementById('manager-details-template');
    const clone = template.content.cloneNode(true);
    targetRow.after(clone);

    try {
        const [pResp, entryResp] = await Promise.all([
            fetch(`${PROXY_ENDPOINT}entry/${managerId}/event/${state.currentGW}/picks/`),
            fetch(`${PROXY_ENDPOINT}entry/${managerId}/`)
        ]);

        const pData = await pResp.json();
        const entryData = await entryResp.json();

        // Render Pitch
        pData.picks.slice(0, 11).forEach(pick => {
            const player = state.playerMap[pick.element];
            const pts = (state.livePoints[pick.element] || 0) * pick.multiplier;
            const rowIds = { 1: 'exp-gkp', 2: 'exp-def', 3: 'exp-mid', 4: 'exp-fwd' };
            const container = document.getElementById(rowIds[player.pos]);
            
            if (container) {
                container.innerHTML += `
                    <div class="mini-player">
                        <div class="player-shirt"></div>
                        <div class="player-name">${player.name}</div>
                        <div class="player-val">${pts}</div>
                    </div>
                `;
            }
        });

        document.getElementById('exp-itb').textContent = (pData.entry_history.bank / 10).toFixed(1);
        document.getElementById('exp-cost').textContent = pData.entry_history.event_transfers_cost;

        const chipMap = { 'wildcard': 'wc', '3xc': 'tc', 'bboost': 'bb', 'freehit': 'fh' };
        entryData.chips.forEach(c => {
            const el = document.getElementById(`chip-${chipMap[c.name]}`);
            if (el) el.classList.add('used');
        });

    } catch (e) { console.error("Expansion fail", e); }
}

/** * 4. MATCH CENTER ENGINE (The "Pitch" Button View) 
 */
async function updateLiveScores() {
    const container = document.getElementById('fixtures-container');
    if (!container) return;
    clearTimeout(refreshTimer);

    try {
        const response = await fetch(`${FIXTURES_ENDPOINT}${state.currentGW}`);
        const fixtures = await response.json();
        const startedGames = fixtures.filter(f => f.started);
        
        // Auto-refresh every 60s if games are live
        if (startedGames.some(f => !f.finished)) {
            refreshTimer = setTimeout(updateLiveScores, 60000);
        }

        let html = '';
        const sortedGames = [...startedGames].sort((a, b) => new Date(b.kickoff_time) - new Date(a.kickoff_time));

        sortedGames.forEach(game => {
            const homeAbbr = teamLookup[game.team_h].substring(0, 3).toUpperCase();
            const awayAbbr = teamLookup[game.team_a].substring(0, 3).toUpperCase();
            
            // Goals & Assists Logic
            const goals = game.stats.find(s => s.identifier === 'goals_scored');
            let homeEvents = '', awayEvents = '';
            if (goals) {
                goals.h.forEach(s => homeEvents += `<div>${state.playerMap[s.element]?.name} ⚽</div>`);
                goals.a.forEach(s => awayEvents += `<div>⚽ ${state.playerMap[s.element]?.name}</div>`);
            }

            // Bonus Points Logic
            const bps = game.stats.find(s => s.identifier === 'bps');
            let bonusHtml = '';
            if (bps) {
                const top = [...bps.h, ...bps.a].sort((a, b) => b.value - a.value).slice(0, 3);
                const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                top.forEach((p, i) => {
                    bonusHtml += `
                        <div style="display:flex; align-items:center; gap:6px; margin-bottom:4px; font-size:0.65rem;">
                            <span style="background:${colors[i]}; color:#000; width:13px; height:13px; display:flex; align-items:center; justify-content:center; border-radius:2px; font-weight:900; font-size:0.5rem;">${3-i}</span>
                            <span style="font-weight:700;">${state.playerMap[p.element]?.name} <span style="opacity:0.3;">${p.value}</span></span>
                        </div>`;
                });
            }

            html += `
                <div class="match-card" style="display: flex; padding: 12px; border-bottom: 1px solid #eee; min-height: 100px;">
                    <div style="flex: 1.5; border-right: 1px solid #eee; padding-right:10px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                            <span style="font-weight: 800;">${homeAbbr}</span>
                            <span style="background: #37003c; color: white; padding: 2px 8px; border-radius: 4px; font-family: monospace;">${game.team_h_score} - ${game.team_a_score}</span>
                            <span style="font-weight: 800;">${awayAbbr}</span>
                        </div>
                        <div style="font-size: 0.6rem; display: flex; justify-content: space-between;">
                            <div>${homeEvents}</div>
                            <div>${awayEvents}</div>
                        </div>
                    </div>
                    <div style="flex: 1; padding-left: 10px;">
                        <div style="font-size: 0.55rem; font-weight: 800; color: #37003c; margin-bottom: 5px; opacity: 0.6;">🏆 BONUS</div>
                        ${bonusHtml || '<span style="opacity:0.3; font-size:0.6rem;">Awaiting...</span>'}
                    </div>
                </div>`;
        });
        
        container.innerHTML = html || '<p style="text-align:center; padding:20px; opacity:0.5;">No live games currently.</p>';
    } catch (err) { console.error("Match Center Error", err); }
}

/** * 5. UI UTILITIES 
 */
function showView(view) {
    document.getElementById('table-view').style.display = view === 'table' ? 'block' : 'none';
    document.getElementById('pitch-view').style.display = view === 'pitch' ? 'block' : 'none';
    document.getElementById('tab-table').classList.toggle('active', view === 'table');
    document.getElementById('tab-pitch').classList.toggle('active', view === 'pitch');

    if (view === 'pitch') {
        updateLiveScores();
    } else {
        clearTimeout(refreshTimer);
    }
}

function toggleSettings() {
    document.getElementById('settings-drawer').classList.toggle('open');
}

function resetApp() {
    localStorage.removeItem('kopala_fpl_id');
    location.reload();
}
