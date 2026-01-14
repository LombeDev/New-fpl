/**
 * KOPALA FPL - MASTER CORE SCRIPT
 * Features: Rate-Limit Safe, Persistent View, Settings Toggle, Invitational Filter
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
 * 1. INITIALIZATION & PERSISTENCE
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Theme setup
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
 * 2. SETTINGS TOGGLE LOGIC
 */
function toggleSettings() {
    const drawer = document.getElementById('settings-drawer');
    const overlay = document.getElementById('drawer-overlay');
    
    if (!drawer || !overlay) return;

    const isOpen = drawer.classList.contains('open');
    
    if (isOpen) {
        drawer.classList.remove('open');
        overlay.style.display = 'none';
    } else {
        drawer.classList.add('open');
        overlay.style.display = 'block';
    }
}

/**
 * 3. VIEW PERSISTENCE
 */
function showView(view) {
    state.activeView = view;
    localStorage.setItem('kopala_active_view', view);

    const tableView = document.getElementById('table-view');
    const pitchView = document.getElementById('pitch-view');
    const tabTable = document.getElementById('tab-table');
    const tabPitch = document.getElementById('tab-pitch');

    if (tableView) tableView.style.display = view === 'table' ? 'block' : 'none';
    if (pitchView) pitchView.style.display = view === 'pitch' ? 'block' : 'none';
    
    if (tabTable) tabTable.classList.toggle('active', view === 'table');
    if (tabPitch) tabPitch.classList.toggle('active', view === 'pitch');
}

/**
 * 4. RATE-LIMIT SAFE BATCH FETCH
 */
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
        // 250ms pause between batches to respect FPL API limits
        if (i + batchSize < standings.length) await new Promise(r => setTimeout(r, 250));
    }
    return results;
}

/**
 * 5. LEAGUE STANDINGS
 */
async function changeLeague(leagueId) {
    const body = document.getElementById('league-body');
    if (!body) return;
    body.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Safe Loading...</td></tr>';

    try {
        const res = await fetch(`${PROXY_ENDPOINT}leagues-classic/${leagueId}/standings/`);
        const data = await res.json();
        const standings = data.standings.results;

        const allPicks = await batchFetchCaptains(standings);

        body.innerHTML = standings.map((r, index) => {
            const arrow = r.last_rank > r.rank ? '▲' : (r.last_rank < r.rank && r.last_rank !== 0 ? '▼' : '-');
            const arrowColor = r.last_rank > r.rank ? '#00ff85' : '#e90052';
            
            const managerPicks = allPicks[index];
            const capId = managerPicks?.picks?.find(p => p.is_captain)?.element;
            const captainName = state.playerMap[capId]?.name || "N/A";

            return `
                <tr class="manager-row" onclick="toggleManagerExpansion(${r.entry})">
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
        
        // Removed initializeStats call to prevent ReferenceError
    } catch (err) { console.error("League Load Error", err); }
}

/**
 * 6. CORE DATA FETCHERS
 */
async function initAppData() {
    try {
        const res = await fetch(`${PROXY_ENDPOINT}bootstrap-static/`);
        const data = await res.json();
        data.elements.forEach(p => state.playerMap[p.id] = { name: p.web_name, code: p.code });
        
        const activeGW = data.events.find(e => e.is_current) || data.events.find(e => !e.finished);
        if (activeGW) state.currentGW = activeGW.id;
    } catch (e) { console.error("Bootstrap error", e); }
}

async function fetchMySquad() {
    try {
        const res = await fetch(`${PROXY_ENDPOINT}entry/${state.fplId}/event/${state.currentGW}/picks/`);
        const data = await res.json();
        state.myPlayerIds = data.picks.map(p => p.element);
    } catch (e) { console.error("Squad error", e); }
}

async function fetchManagerData() {
    try {
        const res = await fetch(`${PROXY_ENDPOINT}entry/${state.fplId}/`);
        const data = await res.json();
        document.getElementById('disp-name').textContent = `${data.player_first_name} ${data.player_last_name}`;
        document.getElementById('disp-total').textContent = data.summary_overall_points.toLocaleString();
        document.getElementById('disp-rank').textContent = (data.summary_overall_rank || 0).toLocaleString();
        
        const invitational = data.leagues.classic.filter(l => l.league_type === 'x');
        const select = document.getElementById('league-select');
        if (select) {
            select.innerHTML = invitational.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
            if (invitational.length > 0) changeLeague(invitational[0].id);
        }
    } catch (e) { console.error("Manager data error", e); }
}

/**
 * 7. UTILS
 */
function handleDarkModeToggle() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function resetApp() {
    if(confirm("Logout?")) { localStorage.clear(); location.reload(); }
}

async function handleLogin() {
    const id = document.getElementById('team-id-input').value;
    if (!id) return alert("Enter ID");
    state.fplId = id;
    localStorage.setItem('kopala_fpl_id', id);
    location.reload();
}

function toggleManagerExpansion(entryId) {
    console.log("Expanding manager:", entryId);
    // Placeholder for manager details logic
}
