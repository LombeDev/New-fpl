/**
 * KOPALA FPL - Netlify Integrated Core
 * Coding Partner Edition: Enhanced with Expansion Pitch View
 */

const state = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    playerMap: {}, 
    livePoints: {},
    currentGW: 1, 
};

const PROXY_ENDPOINT = "/.netlify/functions/fpl-proxy?endpoint=";

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Initialize Player & GW Database
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
        
        // Map player ID to name and position for pitch placement
        data.elements.forEach(p => {
            state.playerMap[p.id] = {
                name: p.web_name,
                pos: p.element_type, // 1: GKP, 2: DEF, 3: MID, 4: FWD
                team: p.team
            };
        });
        
        const activeGW = data.events.find(e => e.is_current);
        if (activeGW) state.currentGW = activeGW.id;
    } catch (err) { 
        console.error("DB Load Error", err); 
    }
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
        
        document.getElementById('disp-name').textContent = `${data.player_first_name} ${data.player_last_name}`;
        document.getElementById('disp-gw').textContent = data.summary_event_points || 0;
        document.getElementById('disp-total').textContent = data.summary_overall_points.toLocaleString();
        
        const rankEl = document.getElementById('disp-rank');
        const rankVal = data.summary_overall_rank || 0;
        rankEl.textContent = rankVal.toLocaleString();
        rankEl.style.fontSize = rankVal > 1000000 ? "1rem" : "1.2rem";

        populateLeagueSelector(data.leagues.classic);
        if (data.leagues.classic.length > 0) changeLeague(data.leagues.classic[0].id);
        
    } catch (err) { 
        console.error("Manager Sync Error", err); 
    }
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
        
        // Render rows with IDs and expansion click events
        body.innerHTML = data.standings.results.map(r => `
            <tr id="row-${r.entry}" class="manager-row" onclick="toggleManagerExpansion(${r.entry})">
                <td>${r.rank}</td>
                <td><strong>${r.entry_name}</strong><br><small>${r.player_name}</small></td>
                <td class="score-text">${r.event_total}</td>
                <td>${r.total.toLocaleString()}</td>
            </tr>
        `).join('');
    } catch (err) { 
        console.error("League Error", err); 
    }
}

/** * EXPANSION & PITCH LOGIC 
 */
async function toggleManagerExpansion(managerId) {
    const existing = document.querySelector('.details-row');
    const targetRow = document.getElementById(`row-${managerId}`);

    // If already open, close it
    if (existing && existing.previousElementSibling === targetRow) {
        existing.remove();
        return;
    }
    if (existing) existing.remove(); // Close other open ones

    // 1. Inject the expansion template (from HTML template tag)
    const template = document.getElementById('manager-details-template');
    const clone = template.content.cloneNode(true);
    targetRow.after(clone);

    try {
        const [pResp, lResp, entryResp] = await Promise.all([
            fetch(`${PROXY_ENDPOINT}entry/${managerId}/event/${state.currentGW}/picks/`),
            fetch(`${PROXY_ENDPOINT}event/${state.currentGW}/live/`),
            fetch(`${PROXY_ENDPOINT}entry/${managerId}/`)
        ]);

        const pData = await pResp.json();
        const lData = await lResp.json();
        const entryData = await entryResp.json();

        // Map live points for current GW
        lData.elements.forEach(el => state.livePoints[el.id] = el.stats.total_points);

        // 2. Render Players onto the Mini-Pitch
        pData.picks.slice(0, 11).forEach(pick => {
            const player = state.playerMap[pick.element];
            const pts = (state.livePoints[pick.element] || 0) * pick.multiplier;
            
            // 1:GKP, 2:DEF, 3:MID, 4:FWD
            const rowIds = { 1: 'exp-gkp', 2: 'exp-def', 3: 'exp-mid', 4: 'exp-fwd' };
            const container = document.getElementById(rowIds[player.pos]);
            
            if (container) {
                container.innerHTML += `
                    <div class="mini-player">
                        <div class="player-shirt team-${player.team}"></div>
                        <div class="player-name">${player.name}</div>
                        <div class="player-val">${pts}</div>
                    </div>
                `;
            }
        });

        // 3. Update Chips & Finance Info
        document.getElementById('exp-itb').textContent = (pData.entry_history.bank / 10).toFixed(1);
        document.getElementById('exp-cost').textContent = pData.entry_history.event_transfers_cost;

        const chipMap = { 'wildcard': 'wc', '3xc': 'tc', 'bboost': 'bb', 'freehit': 'fh' };
        if (entryData.chips) {
            entryData.chips.forEach(c => {
                const el = document.getElementById(`chip-${chipMap[c.name]}`);
                if (el) {
                    el.classList.add('used');
                    el.title = `Used in GW${c.event}`;
                }
            });
        }

    } catch (e) { 
        console.error("Expansion fail", e); 
    }
}

/** * UI & STATE UTILITIES 
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
