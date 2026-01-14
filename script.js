/**
 * KOPALA FPL - MASTER CORE SCRIPT
 * Features: Squad Expansion, Rate-Limit Protection, Persistent Views, Invitational Filter
 */

const state = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    activeView: localStorage.getItem('kopala_active_view') || 'table',
    playerMap: {}, 
    currentGW: 1, 
    myPlayerIds: [] 
};

const PROXY_ENDPOINT = "/.netlify/functions/fpl-proxy?endpoint=";

/**
 * 1. INITIALIZATION
 */
document.addEventListener('DOMContentLoaded', async () => {
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        const darkToggle = document.getElementById('dark-mode-toggle');
        if (darkToggle) darkToggle.checked = true;
    }

    await initAppData();

    if (state.fplId) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        showView(state.activeView);
        await fetchMySquad();
        await fetchManagerData();
    }
});

/**
 * 2. CORE DATA BOOTSTRAPPING
 */
async function initAppData() {
    try {
        const res = await fetch(`${PROXY_ENDPOINT}bootstrap-static/`);
        const data = await res.json();
        
        // map player data for easy lookup
        data.elements.forEach(p => {
            state.playerMap[p.id] = { 
                name: p.web_name, 
                code: p.code, 
                pos: p.element_type 
            };
        });

        const activeGW = data.events.find(e => e.is_current) || data.events.find(e => !e.finished);
        if (activeGW) state.currentGW = activeGW.id;
    } catch (e) { console.error("Bootstrap error", e); }
}

/**
 * 3. LEAGUE & MANAGER FETCHING
 */
async function fetchManagerData() {
    try {
        const res = await fetch(`${PROXY_ENDPOINT}entry/${state.fplId}/`);
        const data = await res.json();
        
        document.getElementById('disp-name').textContent = `${data.player_first_name} ${data.player_last_name}`;
        document.getElementById('disp-total').textContent = data.summary_overall_points.toLocaleString();
        document.getElementById('disp-rank').textContent = (data.summary_overall_rank || 0).toLocaleString();

        // Filter for Invitational Leagues only
        const invitational = data.leagues.classic.filter(l => l.league_type === 'x');
        const select = document.getElementById('league-select');
        
        if (select && invitational.length > 0) {
            select.innerHTML = invitational.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
            changeLeague(invitational[0].id);
        }
    } catch (e) { console.error("Manager Data Error", e); }
}

async function fetchMySquad() {
    try {
        const res = await fetch(`${PROXY_ENDPOINT}entry/${state.fplId}/event/${state.currentGW}/picks/`);
        const data = await res.json();
        state.myPlayerIds = data.picks.map(p => p.element);
    } catch (e) { console.error("Squad Sync Error", e); }
}

/**
 * 4. LEAGUE TABLE & RATE LIMITING
 */
async function changeLeague(leagueId) {
    const body = document.getElementById('league-body');
    body.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Safe Loading...</td></tr>';

    try {
        const res = await fetch(`${PROXY_ENDPOINT}leagues-classic/${leagueId}/standings/`);
        const data = await res.json();
        const standings = data.standings.results;

        // Batch fetch captains (5 at a time) to avoid 429 Rate Limit errors
        const allPicks = await batchFetchCaptains(standings);

        body.innerHTML = standings.map((r, index) => {
            const arrow = r.last_rank > r.rank ? '▲' : (r.last_rank < r.rank && r.last_rank !== 0 ? '▼' : '-');
            const arrowColor = r.last_rank > r.rank ? '#00ff85' : '#e90052';
            
            const managerPicks = allPicks[index];
            const capId = managerPicks?.picks?.find(p => p.is_captain)?.element;
            const captainName = state.playerMap[capId]?.name || "N/A";

            return `
                <tr id="row-${r.entry}" class="manager-row" onclick="toggleManagerExpansion(${r.entry})">
                    <td style="font-weight: bold;"><span style="color:${arrowColor}">${arrow}</span> ${r.rank}</td>
                    <td>
                        <div style="font-weight: 800; color: #37003c;">${r.entry_name}</div>
                        <div style="font-size: 0.75rem; color: #666;">${r.player_name}</div>
                        <div style="font-size: 0.7rem; margin-top: 4px; display: flex; align-items: center;">
                            <span style="background:#e90052; color:white; border-radius:50%; width:14px; height:14px; display:flex; align-items:center; justify-content:center; font-size:0.5rem; margin-right:4px; font-weight:bold;">C</span>
                            <span style="font-weight:600;">${captainName}</span>
                        </div>
                    </td>
                    <td style="text-align:center; font-weight:800;">${r.event_total}</td>
                    <td style="text-align:right; font-weight:600;">${r.total.toLocaleString()}</td>
                </tr>
            `;
        }).join('');
    } catch (err) { console.error("League Error", err); }
}

async function batchFetchCaptains(standings) {
    let results = [];
    const batchSize = 5;
    for (let i = 0; i < standings.length; i += batchSize) {
        const batch = standings.slice(i, i + batchSize);
        const batchRes = await Promise.all(batch.map(r => 
            fetch(`${PROXY_ENDPOINT}entry/${r.entry}/event/${state.currentGW}/picks/`)
            .then(res => res.json()).catch(() => null)
        ));
        results = [...results, ...batchRes];
        if (i + batchSize < standings.length) await new Promise(r => setTimeout(r, 250));
    }
    return results;
}

/**
 * 5. SQUAD EXPANSION LOGIC
 */
async function toggleManagerExpansion(entryId) {
    const row = document.getElementById(`row-${entryId}`);
    const existingDetail = document.getElementById(`details-${entryId}`);

    if (existingDetail) {
        existingDetail.remove();
        return;
    }

    const detailRow = document.createElement('tr');
    detailRow.id = `details-${entryId}`;
    detailRow.className = 'details-row';
    detailRow.innerHTML = `<td colspan="4" style="padding:20px; text-align:center; background:#eee;">Loading Squad...</td>`;
    row.parentNode.insertBefore(detailRow, row.nextSibling);

    try {
        const res = await fetch(`${PROXY_ENDPOINT}entry/${entryId}/event/${state.currentGW}/picks/`);
        const data = await res.json();
        
        const squad = data.picks.map(p => ({
            ...state.playerMap[p.element],
            isCap: p.is_captain
        }));

        // Render mini-pitch rows
        detailRow.innerHTML = `
            <td colspan="4" style="background: #008d53; padding: 15px;">
                <div class="mini-pitch-container" style="display:flex; flex-direction:column; gap:8px;">
                    ${renderPitchRow(squad.filter(p => p.pos === 1))}
                    ${renderPitchRow(squad.filter(p => p.pos === 2))}
                    ${renderPitchRow(squad.filter(p => p.pos === 3))}
                    ${renderPitchRow(squad.filter(p => p.pos === 4))}
                </div>
            </td>
        `;
    } catch (e) { detailRow.innerHTML = `<td colspan="4">Error loading squad.</td>`; }
}

function renderPitchRow(players) {
    return `<div style="display:flex; justify-content:center; gap:5px;">
        ${players.map(p => `
            <div style="text-align:center; width:65px;">
                <div style="background:white; color:black; font-size:0.6rem; padding:3px; border-radius:3px; font-weight:bold; overflow:hidden; white-space:nowrap; text-overflow:ellipsis;">
                    ${p.isCap ? '<span style="color:red">C</span> ' : ''}${p.name}
                </div>
            </div>
        `).join('')}
    </div>`;
}

/**
 * 6. UI HELPERS & PERSISTENCE
 */
function showView(view) {
    state.activeView = view;
    localStorage.setItem('kopala_active_view', view);
    document.getElementById('table-view').style.display = view === 'table' ? 'block' : 'none';
    document.getElementById('pitch-view').style.display = view === 'pitch' ? 'block' : 'none';
    document.getElementById('tab-table').classList.toggle('active', view === 'table');
    document.getElementById('tab-pitch').classList.toggle('active', view === 'pitch');
}

function toggleSettings() {
    const drawer = document.getElementById('settings-drawer');
    const overlay = document.getElementById('drawer-overlay');
    const isOpen = drawer.classList.contains('open');
    drawer.classList.toggle('open', !isOpen);
    overlay.style.display = !isOpen ? 'block' : 'none';
}

function handleDarkModeToggle() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

async function handleLogin() {
    const id = document.getElementById('team-id-input').value;
    if (!id) return alert("Enter Team ID");
    localStorage.setItem('kopala_fpl_id', id);
    location.reload();
}

function resetApp() {
    if(confirm("Logout?")) { localStorage.clear(); location.reload(); }
}
