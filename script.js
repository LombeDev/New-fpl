/**
 * KOPALA FPL - MASTER CORE SCRIPT
 * Version: 2.0 (Red Theme + Validation + Telegram Dark Mode)
 */

const state = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    activeView: localStorage.getItem('kopala_active_view') || 'table',
    playerMap: {}, 
    currentGW: 1, 
};

// Ensure this matches your netlify.toml redirect path
const PROXY_ENDPOINT = "/.netlify/functions/fpl-proxy?endpoint=";

/**
 * 1. INITIALIZATION & ROUTING
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Handle Theme Persistence
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        const darkToggle = document.getElementById('dark-mode-toggle');
        if (darkToggle) darkToggle.checked = true;
    }

    // Load static data (players, teams, current GW)
    await initAppData();

    // Route: Dashboard or Login
    if (state.fplId) {
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        showView(state.activeView);
        await fetchManagerData();
    } else {
        document.getElementById('login-screen').style.display = 'flex';
        document.getElementById('dashboard').style.display = 'none';
    }
});

/**
 * 2. BOOTSTRAP DATA (Player Info & Current GW)
 */
async function initAppData() {
    try {
        const cb = `&t=${Date.now()}`;
        const res = await fetch(`${PROXY_ENDPOINT}bootstrap-static/${cb}`);
        if (!res.ok) throw new Error("API Offline");
        const data = await res.json();
        
        // Map players for quick lookup
        data.elements.forEach(p => {
            state.playerMap[p.id] = { 
                name: p.web_name, 
                code: p.code, 
                pos: p.element_type 
            };
        });

        // Determine current Gameweek
        const activeGW = data.events.find(e => e.is_current) || data.events.find(e => !e.finished);
        if (activeGW) {
            state.currentGW = activeGW.id;
            const timerEl = document.getElementById('deadline-timer');
            if (timerEl) timerEl.textContent = activeGW.name;
        }
    } catch (e) { 
        console.error("Bootstrap error:", e); 
    }
}

/**
 * 3. VALIDATED LOGIN
 */
async function handleLogin() {
    const input = document.getElementById('team-id-input');
    const loginBtn = document.querySelector('.action-button');
    const teamId = input.value.trim();

    // Basic Validation
    if (!teamId || isNaN(teamId)) {
        input.classList.add('input-error');
        alert("Please enter a valid numeric Team ID.");
        return;
    }

    // UI Feedback
    const originalText = loginBtn.innerText;
    loginBtn.disabled = true;
    loginBtn.innerHTML = `Verifying ID...`;

    try {
        const cb = `&t=${Date.now()}`;
        const res = await fetch(`${PROXY_ENDPOINT}entry/${teamId}/${cb}`);
        
        if (!res.ok) throw new Error("ID Not Found");

        // Success: Save and Reload
        localStorage.clear();
        localStorage.setItem('kopala_fpl_id', teamId);
        window.location.href = window.location.pathname + '?v=' + Date.now();

    } catch (error) {
        alert("Invalid Team ID. Please check and try again.");
        loginBtn.disabled = false;
        loginBtn.innerText = originalText;
        input.classList.add('input-error');
    }
}

/**
 * 4. LEAGUE STANDINGS
 */
async function fetchManagerData() {
    try {
        const cb = `&t=${Date.now()}`;
        const res = await fetch(`${PROXY_ENDPOINT}entry/${state.fplId}/${cb}`);
        const data = await res.json();
        
        document.getElementById('disp-name').textContent = `${data.player_first_name} ${data.player_last_name}`;
        document.getElementById('disp-total').textContent = data.summary_overall_points.toLocaleString();
        document.getElementById('disp-rank').textContent = (data.summary_overall_rank || 0).toLocaleString();

        // Populate Private Leagues Select
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
    body.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:40px;" class="loading-pulse">Syncing Standings...</td></tr>';

    try {
        const cb = `&t=${Date.now()}`;
        const res = await fetch(`${PROXY_ENDPOINT}leagues-classic/${leagueId}/standings/${cb}`);
        const data = await res.json();
        const standings = data.standings.results;

        // Fetch Captains for the top managers
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
                            <div class="manager-entry-name" style="font-weight:800; color:var(--text-main);">${r.entry_name}</div>
                            <div class="manager-real-name" style="font-size:0.75rem; color:var(--text-muted);">${r.player_name}</div>
                            <div class="captain-name-row" style="font-size:0.7rem; margin-top:4px; display:flex; align-items:center;">
                                <span class="cap-badge" style="background:var(--fpl-red); color:white; border-radius:50%; width:14px; height:14px; display:flex; align-items:center; justify-content:center; font-size:0.5rem; margin-right:4px; font-weight:bold;">C</span> 
                                <span style="font-weight:600; color:var(--text-main);">${captainName}</span>
                            </div>
                        </div>
                    </td>
                    <td style="text-align:center; font-weight:800; color:var(--fpl-red);">${r.event_total}</td>
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
        await new Promise(r => setTimeout(r, 100));
    }
    return results;
}

/**
 * 5. SQUAD EXPANSION
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
    
    // Skeleton Loader
    detailRow.innerHTML = `
        <td colspan="4" style="background: var(--card-bg); padding: 30px;">
            <div style="display:flex; flex-direction:column; align-items:center; gap:12px;">
                <div class="skeleton-loader loading-ball"></div>
                <div class="skeleton-loader loading-text"></div>
                <div style="font-size:0.6rem; color:var(--text-muted); font-weight:bold; letter-spacing:1px;">FETCHING PITCH DATA</div>
            </div>
        </td>
    `;
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
                    <div class="stats-grid">
                        <div style="border-right: 1px solid var(--border-color); padding-right: 10px;">
                            <div style="font-size:0.75rem;">Hits: <span style="color:var(--fpl-red); font-weight:800;">-${picksData.entry_history.event_transfers_cost}</span></div>
                            <div style="font-size:0.75rem;">Bank: <span style="font-weight:800; color:var(--text-main);">£${(picksData.entry_history.bank / 10).toFixed(1)}m</span></div>
                        </div>
                        <div style="padding-left: 10px;">
                            <div style="font-size:0.75rem;">GW Net: <span style="font-weight:800; color:var(--fpl-red);">${picksData.entry_history.points - picksData.entry_history.event_transfers_cost}</span></div>
                            <div style="font-size:0.75rem;">Overall: <span style="font-weight:800; color:var(--text-main);">${picksData.entry_history.total_points.toLocaleString()}</span></div>
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

        detailRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    } catch (e) { 
        detailRow.innerHTML = `<td colspan="4" style="text-align:center; padding:15px; color:var(--fpl-red);">Fetch Failed.</td>`; 
    }
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
            <div class="chip-circle ${isUsed ? 'used' : ''}">${label}</div>
            <div style="font-size:0.55rem; font-weight:bold; text-align:center; color:var(--text-muted);">${isUsed ? 'USED' : 'AVAIL'}</div>
        </div>
    `;
}

/**
 * 6. SETTINGS & UTILS
 */
function showView(view) {
    state.activeView = view;
    localStorage.setItem('kopala_active_view', view);
    document.getElementById('table-view').style.display = view === 'table' ? 'block' : 'none';
    document.getElementById('pitch-view').style.display = view === 'pitch' ? 'block' : 'none';
    document.getElementById('tab-table').classList.toggle('active', view === 'table');
    document.getElementById('tab-pitch').classList.toggle('active', view === 'pitch');
}

function handleDarkModeToggle() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function toggleSettings() {
    const drawer = document.getElementById('settings-drawer');
    drawer.classList.toggle('open');
}

function resetApp() {
    if(confirm("Logout and switch Team ID?")) { 
        localStorage.clear(); 
        window.location.href = window.location.pathname + '?v=' + Date.now();
    }
}
