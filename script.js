/**
 * KOPALA FPL - ULTIMATE INTEGRATED CORE
 * Features: Live Standings, Manager Expansion, Match Center, and Theme Engine
 */

const state = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    playerMap: {}, 
    livePoints: {},
    currentGW: 1, 
};

const PROXY_ENDPOINT = "/.netlify/functions/fpl-proxy?endpoint=";
const FIXTURES_ENDPOINT = "/.netlify/functions/fpl-proxy?endpoint=fixtures/?event=";

let refreshTimer = null;
let teamLookup = {}; 

/**
 * 1. INITIALIZATION & THEME ENGINE
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Check for saved theme preference
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        const toggle = document.getElementById('dark-mode-toggle');
        if (toggle) toggle.checked = true;
    }

    await initAppData();

    if (state.fplId) {
        document.getElementById('team-id-input').value = state.fplId;
        handleLogin();
    }
});

function handleDarkModeToggle() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function toggleSettings() {
    const drawer = document.getElementById('settings-drawer');
    const overlay = document.getElementById('drawer-overlay');
    
    const isOpen = drawer.classList.toggle('open');
    overlay.style.display = isOpen ? 'block' : 'none';
}

/**
 * 2. DATA INITIALIZATION 
 */
async function initAppData() {
    try {
        const res = await fetch(`${PROXY_ENDPOINT}bootstrap-static/`);
        const data = await res.json();
        
        data.elements.forEach(p => {
            state.playerMap[p.id] = {
                name: p.web_name,
                pos: p.element_type,
                team: p.team
            };
        });

        data.teams.forEach(t => teamLookup[t.id] = t.name);
        
        const activeGW = data.events.find(e => e.is_current) || data.events.find(e => !e.finished);
        if (activeGW) state.currentGW = activeGW.id;

    } catch (err) { console.error("Initialization Error", err); }
}

/**
 * 3. MANAGER & LEAGUE LOGIC 
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
            <tr id="row-${r.entry}" class="manager-row" onclick="toggleManagerExpansion(${r.entry})" style="border-bottom: 1px solid var(--border-gray); cursor: pointer;">
                <td style="padding: 12px;">${r.rank}</td>
                <td style="padding: 12px;"><strong>${r.entry_name}</strong><br><small style="color: var(--text-muted)">${r.player_name}</small></td>
                <td style="padding: 12px; font-weight: bold; color: var(--fpl-purple);">${r.event_total}</td>
                <td style="padding: 12px;">${r.total.toLocaleString()}</td>
            </tr>
        `).join('');
    } catch (err) { console.error("League Error", err); }
}

/**
 * 4. MANAGER EXPANSION (Mini-Pitch) 
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
        const pResp = await fetch(`${PROXY_ENDPOINT}entry/${managerId}/event/${state.currentGW}/picks/`);
        const pData = await pResp.json();

        pData.picks.slice(0, 11).forEach(pick => {
            const player = state.playerMap[pick.element];
            const rowIds = { 1: 'exp-gkp', 2: 'exp-def', 3: 'exp-mid', 4: 'exp-fwd' };
            const container = document.getElementById(rowIds[player.pos]);
            
            if (container) {
                container.innerHTML += `
                    <div class="mini-player" style="text-align: center; width: 60px;">
                        <div style="width: 20px; height: 20px; background: #eee; border-radius: 50%; margin: 0 auto;"></div>
                        <div style="font-size: 10px; margin-top: 4px; overflow: hidden; white-space: nowrap;">${player.name}</div>
                    </div>
                `;
            }
        });
    } catch (e) { console.error("Expansion fail", e); }
}

/**
 * 5. MATCH CENTER ENGINE 
 */
async function updateLiveScores() {
    const container = document.getElementById('fixtures-container');
    if (!container) return;
    clearTimeout(refreshTimer);

    try {
        const response = await fetch(`${FIXTURES_ENDPOINT}${state.currentGW}`);
        const fixtures = await response.json();
        const startedGames = fixtures.filter(f => f.started);
        
        if (startedGames.some(f => !f.finished)) {
            refreshTimer = setTimeout(updateLiveScores, 60000);
        }

        let html = '';
        const sortedGames = [...startedGames].sort((a, b) => new Date(b.kickoff_time) - new Date(a.kickoff_time));

        sortedGames.forEach(game => {
            const homeAbbr = teamLookup[game.team_h].substring(0, 3).toUpperCase();
            const awayAbbr = teamLookup[game.team_a].substring(0, 3).toUpperCase();
            
            html += `
                <div class="match-card" style="display: flex; padding: 15px; border-bottom: 1px solid var(--border-gray); align-items: center; justify-content: space-between;">
                    <span style="font-weight: 700; flex: 1; text-align: right;">${homeAbbr}</span>
                    <span style="background: var(--fpl-purple); color: white; padding: 4px 10px; border-radius: 4px; margin: 0 15px; font-family: monospace;">${game.team_h_score} - ${game.team_a_score}</span>
                    <span style="font-weight: 700; flex: 1; text-align: left;">${awayAbbr}</span>
                </div>`;
        });
        
        container.innerHTML = html || '<p style="text-align:center; padding:40px; color: var(--text-muted);">No live games currently.</p>';
    } catch (err) { console.error("Match Center Error", err); }
}

/**
 * 6. UI NAVIGATION 
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

function resetApp() {
    if(confirm("Logout and return to login screen?")) {
        localStorage.removeItem('kopala_fpl_id');
        location.reload();
    }
}