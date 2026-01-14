/**
 * KOPALA FPL - MASTER CORE SCRIPT
 * Features: Anti-Cache Fetching, Circular Pitch Layout, Live Manager Stats
 */

const state = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    activeView: localStorage.getItem('kopala_active_view') || 'table',
    playerMap: {}, 
    currentGW: 1, 
};

// Netlify Proxy Endpoint
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
        // Cache buster forces a fresh fetch from the FPL API
        const cb = `&t=${Date.now()}`;
        const res = await fetch(`${PROXY_ENDPOINT}bootstrap-static/${cb}`);
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
        const cb = `&t=${Date.now()}`;
        const res = await fetch(`${PROXY_ENDPOINT}entry/${state.fplId}/${cb}`);
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
    body.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">Fetching Live Standings...</td></tr>';

    try {
        const cb = `&t=${Date.now()}`;
        const res = await fetch(`${PROXY_ENDPOINT}leagues-classic/${leagueId}/standings/${cb}`);
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
                        <div class="manager-info-stack">
                            <div class="manager-entry-name">${r.entry_name}</div>
                            <div class="manager-real-name">${r.player_name}</div>
                            <div class="captain-name-row">
                                <span class="cap-badge">C</span> ${captainName}
                            </div>
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
        const cb = `&t=${Date.now()}`;
        const batchRes = await Promise.all(batch.map(r => 
            fetch(`${PROXY_ENDPOINT}entry/${r.entry}/event/${state.currentGW}/picks/${cb}`)
            .then(res => res.json()).catch(() => null)
        ));
        results = [...results, ...batchRes];
        if (i + batchSize < standings.length) await new Promise(r => setTimeout(r, 200));
    }
    return results;
}

/**
 * 4. SQUAD EXPANSION (The Pitch & Dashboard)
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
    detailRow.innerHTML = `<td colspan="4" style="text-align:center; padding:20px;">Syncing Live Team...</td>`;
    row.parentNode.insertBefore(detailRow, row.nextSibling);

    try {
        const cb = `&t=${Date.now()}`;
        const [picksRes, liveRes, historyRes] = await Promise.all([
            fetch(`${PROXY_ENDPOINT}entry/${entryId}/event/${state.currentGW}/picks/${cb}`),
            fetch(`${PROXY_ENDPOINT}event/${state.currentGW}/live/${cb}`),
            fetch(`${PROXY_ENDPOINT}entry/${entryId}/history/${cb}`)
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
                <div class="pitch-container">
                    ${renderPitchRow(squad.filter(p => p.pos === 1))}
                    ${renderPitchRow(squad.filter(p => p.pos === 2))}
                    ${renderPitchRow(squad.filter(p => p.pos === 3))}
                    ${renderPitchRow(squad.filter(p => p.pos === 4))}
                </div>
                
                <div class="manager-stats-footer">
                    <div style="text-align:center; font-weight:800; margin-bottom:10px; font-size:0.7rem; color:var(--fpl-purple); text-transform:uppercase;">Live GW Stats & Chips</div>
                    
                    <div class="stats-grid">
                        <div style="border-right: 1px solid #ddd; padding-right: 10px;">
                            <div class="stat-item"><span>GW Hits:</span> <span style="color:var(--fpl-pink); font-weight:800;">-${picksData.entry_history.event_transfers_cost}</span></div>
                            <div class="stat-item"><span>Bank:</span> <span style="font-weight:800;">£${(picksData.entry_history.bank / 10).toFixed(1)}m</span></div>
                        </div>
                        <div style="padding-left: 10px;">
                            <div class="stat-item"><span>Season Trfs:</span> <span style="font-weight:800;">${historyData.current.reduce((acc, curr) => acc + curr.event_transfers, 0)}</span></div>
                            <div class="stat-item"><span>Net Pts:</span> <span style="font-weight:800; color:var(--fpl-purple); background:var(--fpl-green); padding:0 4px; border-radius:2px;">${picksData.entry_history.points - picksData.entry_history.event_transfers_cost}</span></div>
                        </div>
                    </div>
                    
                    <div class="chip-status-row">
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
    return `<div class="pitch-row">
        ${players.map(p => `
            <div class="player-card">
                <div class="player-photo-wrapper">
                    <img class="player-face" src="https://resources.premierleague.com/premierleague/photos/players/110x140/p${p.code}.png" onerror="this.src='https://fantasy.premierleague.com/static/media/player-missing-110.6625805d.png'">
                </div>
                <div class="player-info-label">${p.isCap ? '(C) ' : ''}${p.name}</div>
                <div class="player-points-badge">${p.pts}</div>
            </div>
        `).join('')}
    </div>`;
}

function renderChip(label, usedChips, chipName) {
    const isUsed = usedChips.some(c => c.name === chipName);
    return `
        <div>
            <div class="chip-icon ${isUsed ? 'used' : ''}">${label}</div>
            <div class="chip-label">${isUsed ? 'USED' : 'AVAIL'}</div>
        </div>
    `;
}

/**
 * 5. LOGIN / LOGOUT (Hard Refreshes)
 */
async function handleLogin() {
    const id = document.getElementById('team-id-input').value;
    if (!id) return alert("Enter Team ID");
    
    // Clear and set new ID
    localStorage.clear();
    localStorage.setItem('kopala_fpl_id', id);
    
    // Hard refresh with timestamp to bypass index cache
    window.location.href = window.location.pathname + '?v=' + Date.now();
}

function resetApp() {
    if(confirm("Logout and clear all data?")) { 
        localStorage.clear(); 
        window.location.href = window.location.pathname + '?v=' + Date.now();
    }
}

function showView(view) {
    state.activeView = view;
    localStorage.setItem('kopala_active_view', view);
    document.getElementById('table-view').style.display = view === 'table' ? 'block' : 'none';
    document.getElementById('pitch-view').style.display = view === 'pitch' ? 'block' : 'none';
    document.getElementById('tab-table').classList.toggle('active', view === 'table');
    document.getElementById('tab-pitch').classList.toggle('active', view === 'pitch');
}
