/**
 * KOPALA FPL - MASTER CORE SCRIPT
 * Features: Live Pitch with Faces, Manager Stats Dashboard, Rate-Limit Protection
 */

const state = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    activeView: localStorage.getItem('kopala_active_view') || 'table',
    playerMap: {}, 
    currentGW: 1, 
};

const PROXY_ENDPOINT = "/.netlify/functions/fpl-proxy?endpoint=";

/**
 * 1. INITIALIZATION
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
        await fetchManagerData();
    }
});

/**
 * 2. BOOTSTRAP DATA (Player Info & Current GW)
 */
async function initAppData() {
    try {
        const res = await fetch(`${PROXY_ENDPOINT}bootstrap-static/`);
        const data = await res.json();
        
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
 * 3. LEAGUE & MANAGER DATA
 */
async function fetchManagerData() {
    try {
        const res = await fetch(`${PROXY_ENDPOINT}entry/${state.fplId}/`);
        const data = await res.json();
        
        document.getElementById('disp-name').textContent = `${data.player_first_name} ${data.player_last_name}`;
        document.getElementById('disp-total').textContent = data.summary_overall_points.toLocaleString();
        document.getElementById('disp-rank').textContent = (data.summary_overall_rank || 0).toLocaleString();

        const invitational = data.leagues.classic.filter(l => l.league_type === 'x');
        const select = document.getElementById('league-select');
        
        if (select && invitational.length > 0) {
            select.innerHTML = invitational.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
            changeLeague(invitational[0].id);
        }
    } catch (e) { console.error("Manager data error", e); }
}

async function changeLeague(leagueId) {
    const body = document.getElementById('league-body');
    body.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Loading Live Standings...</td></tr>';

    try {
        const res = await fetch(`${PROXY_ENDPOINT}leagues-classic/${leagueId}/standings/`);
        const data = await res.json();
        const standings = data.standings.results;

        const allPicks = await batchFetchCaptains(standings);

        body.innerHTML = standings.map((r, index) => {
            const arrow = r.last_rank > r.rank ? '▲' : (r.last_rank < r.rank && r.last_rank !== 0 ? '▼' : '-');
            const arrowColor = r.last_rank > r.rank ? '#00ff85' : '#e90052';
            const capId = allPicks[index]?.picks?.find(p => p.is_captain)?.element;
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
    } catch (err) { console.error("League error", err); }
}

async function batchFetchCaptains(standings) {
    let results = [];
    const batchSize = 5;
    for (let i = 0; i < Math.min(standings.length, 15); i += batchSize) {
        const batch = standings.slice(i, i + batchSize);
        const batchRes = await Promise.all(batch.map(r => 
            fetch(`${PROXY_ENDPOINT}entry/${r.entry}/event/${state.currentGW}/picks/`)
            .then(res => res.json()).catch(() => null)
        ));
        results = [...results, ...batchRes];
        if (i + batchSize < standings.length) await new Promise(r => setTimeout(r, 200));
    }
    return results;
}

/**
 * 4. SQUAD EXPANSION (The Pitch & Stats Dashboard)
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
    detailRow.innerHTML = `<td colspan="4" style="text-align:center; padding:20px; background:#f4f4f4;">Loading Team Data...</td>`;
    row.parentNode.insertBefore(detailRow, row.nextSibling);

    try {
        // Fetch Picks, Live Points, and History for Chips/Transfers
        const [picksRes, liveRes, historyRes] = await Promise.all([
            fetch(`${PROXY_ENDPOINT}entry/${entryId}/event/${state.currentGW}/picks/`),
            fetch(`${PROXY_ENDPOINT}event/${state.currentGW}/live/`),
            fetch(`${PROXY_ENDPOINT}entry/${entryId}/history/`)
        ]);
        
        const picksData = await picksRes.json();
        const liveData = await liveRes.json();
        const historyData = await historyRes.json();

        const livePointsMap = {};
        liveData.elements.forEach(el => livePointsMap[el.id] = el.stats.total_points);

        const squad = picksData.picks.map(p => ({
            ...state.playerMap[p.element],
            isCap: p.is_captain,
            pts: (livePointsMap[p.element] || 0) * (p.multiplier || 1)
        }));

        detailRow.innerHTML = `
            <td colspan="4" style="padding:0;">
                <div class="pitch-container" style="background: #008d53 url('https://fantasy.premierleague.com/static/media/pitch-default.344443a4.svg') no-repeat center; background-size: cover; padding: 20px 0;">
                    ${renderPitchRow(squad.filter(p => p.pos === 1))}
                    ${renderPitchRow(squad.filter(p => p.pos === 2))}
                    ${renderPitchRow(squad.filter(p => p.pos === 3))}
                    ${renderPitchRow(squad.filter(p => p.pos === 4))}
                </div>
                
                <div class="manager-stats-footer" style="background:#f9f9f9; padding:15px; border-top:2px solid #37003c;">
                    <div style="text-align:center; font-weight:800; margin-bottom:12px; font-size:0.7rem; color:#37003c; text-transform:uppercase;">Gameweek Stats & Chips</div>
                    
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; font-size:0.75rem; margin-bottom:15px; padding-bottom:10px; border-bottom:1px solid #ddd;">
                        <div>
                            <div style="display:flex; justify-content:space-between;"><span>GW Hits:</span> <span style="color:#e90052; font-weight:bold;">-${picksData.entry_history.event_transfers_cost}</span></div>
                            <div style="display:flex; justify-content:space-between;"><span>Bank:</span> <span style="font-weight:bold;">£${(picksData.entry_history.bank / 10).toFixed(1)}m</span></div>
                        </div>
                        <div>
                            <div style="display:flex; justify-content:space-between;"><span>Season Transfers:</span> <span style="font-weight:bold;">${historyData.current.reduce((acc, curr) => acc + curr.event_transfers, 0)}</span></div>
                            <div style="display:flex; justify-content:space-between;"><span>Net GW Points:</span> <span style="font-weight:bold; background:#00ff85; padding:0 4px; border-radius:2px;">${picksData.entry_history.points - picksData.entry_history.event_transfers_cost}</span></div>
                        </div>
                    </div>
                    
                    <div style="display:flex; justify-content:space-around; text-align:center;">
                        ${renderChip('WC', historyData.chips, 'wildcard')}
                        ${renderChip('TC', historyData.chips, '3xc')}
                        ${renderChip('BB', historyData.chips, 'bboost')}
                        ${renderChip('FH', historyData.chips, 'freehit')}
                    </div>
                </div>
            </td>
        `;
    } catch (e) { detailRow.innerHTML = `<td colspan="4">Error loading manager data.</td>`; }
}

function renderPitchRow(players) {
    return `<div style="display:flex; justify-content:center; gap:8px; margin-bottom:10px;">
        ${players.map(p => `
            <div style="width:65px; text-align:center;">
                <img src="https://resources.premierleague.com/premierleague/photos/players/110x140/p${p.code}.png" style="width:100%; height:auto;" onerror="this.src='https://fantasy.premierleague.com/static/media/player-missing-110.6625805d.png'">
                <div style="background:#37003c; color:white; font-size:0.6rem; font-weight:bold; padding:2px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">
                    ${p.isCap ? '(C) ' : ''}${p.name}
                </div>
                <div style="background:#00ff85; color:#37003c; font-size:0.7rem; font-weight:900; padding:1px; border-radius:0 0 4px 4px;">${p.pts}</div>
            </div>
        `).join('')}
    </div>`;
}

function renderChip(label, usedChips, chipName) {
    const isUsed = usedChips.some(c => c.name === chipName);
    return `
        <div>
            <div style="width:30px; height:30px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.65rem; font-weight:bold; margin:0 auto; background:${isUsed ? '#ccc' : '#37003c'}; color:${isUsed ? '#888' : '#00ff85'}">${label}</div>
            <div style="font-size:0.55rem; font-weight:bold; margin-top:4px; color:${isUsed ? '#999' : '#333'}">${isUsed ? 'USED' : 'AVAIL'}</div>
        </div>
    `;
}

/**
 * 5. UI HELPERS
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
