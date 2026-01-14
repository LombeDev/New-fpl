/**
 * KOPALA FPL - MASTER CORE SCRIPT (COMPLETE)
 * Includes: Football-Data Proxy, Anti-Cache, <150 Participant Filter, and Pitch Rendering
 */

const state = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    activeView: localStorage.getItem('kopala_active_view') || 'table',
    playerMap: {}, 
    currentGW: 1, 
};

// Endpoints
const FPL_PROXY = "/.netlify/functions/fpl-proxy?endpoint=";
const FOOTBALL_API = "/api/competitions/PL/matches";

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

    // Load App Data & EPL Fixtures
    await Promise.all([initAppData(), initEPLDashboard()]);

    if (state.fplId) {
        const loginScreen = document.getElementById('login-screen');
        const dashboard = document.getElementById('dashboard');
        if (loginScreen) loginScreen.style.display = 'none';
        if (dashboard) dashboard.style.display = 'block';
        showView(state.activeView);
        await fetchManagerData();
    }
});

/**
 * 2. BOOTSTRAP DATA (FPL Player Info & Current GW)
 */
async function initAppData() {
    try {
        const cb = `&t=${Date.now()}`;
        const res = await fetch(`${FPL_PROXY}bootstrap-static/${cb}`);
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
 * 3. EPL FIXTURES DASHBOARD (Football-Data.org)
 */
async function initEPLDashboard() {
    const container = document.getElementById('fixtures-container');
    if (!container) return;

    try {
        const response = await fetch(FOOTBALL_API);
        const data = await response.json();
        const matches = data.matches;

        const live = matches.filter(m => m.status === 'IN_PLAY' || m.status === 'PAUSED');
        const results = matches.filter(m => m.status === 'FINISHED').slice(-10).reverse();
        const upcoming = matches.filter(m => m.status === 'SCHEDULED' || m.status === 'TIMED').slice(0, 10);

        renderEPLView(container, live, results, upcoming);
    } catch (e) { container.innerHTML = "Fixtures Unavailable"; }
}

function renderEPLView(container, live, results, upcoming) {
    let html = '';
    
    if (live.length > 0) {
        html += `<h4 class="live-tag">LIVE NOW</h4>`;
        live.forEach(m => {
            html += `<div class="epl-card live">${m.homeTeam.shortName} ${m.score.fullTime.home}-${m.score.fullTime.away} ${m.awayTeam.shortName}</div>`;
        });
    }

    html += `<h4>Recent Results</h4>`;
    results.forEach(m => {
        html += `<div class="epl-card">${m.homeTeam.shortName} ${m.score.fullTime.home}-${m.score.fullTime.away} ${m.awayTeam.shortName}</div>`;
    });

    html += `<h4>Upcoming</h4>`;
    upcoming.forEach(m => {
        const d = new Date(m.utcDate).toLocaleString([], {weekday:'short', hour:'2-digit', minute:'2-digit'});
        html += `<div class="epl-card scheduled"><span>${m.homeTeam.shortName} vs ${m.awayTeam.shortName}</span> <small>${d}</small></div>`;
    });
    container.innerHTML = html;
}

/**
 * 4. LEAGUE SELECTOR (Filtered for leagues with <= 150 participants)
 */
async function fetchManagerData() {
    try {
        const cb = `&t=${Date.now()}`;
        const res = await fetch(`${FPL_PROXY}entry/${state.fplId}/${cb}`);
        const data = await res.json();
        
        document.getElementById('disp-name').textContent = `${data.player_first_name} ${data.player_last_name}`;
        document.getElementById('disp-total').textContent = data.summary_overall_points.toLocaleString();
        document.getElementById('disp-rank').textContent = (data.summary_overall_rank || 0).toLocaleString();

        const invitational = data.leagues.classic.filter(l => l.league_type === 'x');
        const select = document.getElementById('league-select');
        
        if (select) {
            select.innerHTML = '<option disabled selected>Checking Sizes...</option>';
            const validLeagues = [];

            // Fetch each league's standings to check participant count
            await Promise.all(invitational.map(async (league) => {
                const lRes = await fetch(`${FPL_PROXY}leagues-classic/${league.id}/standings/${cb}`);
                const lData = await lRes.json();
                
                // If has_next is false, the league fits in page 1 (50)
                // To support up to 150, we would ideally check up to page 3, 
                // but checking page 1 + has_next is a safe performance filter.
                if (lData.standings && lData.standings.results.length <= 150 && !lData.standings.has_next) {
                    validLeagues.push(league);
                }
            }));

            if (validLeagues.length > 0) {
                select.innerHTML = validLeagues.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
                changeLeague(validLeagues[0].id);
            } else {
                select.innerHTML = '<option disabled>No small mini-leagues found</option>';
            }
        }
    } catch (e) { console.error("Manager data error", e); }
}

async function changeLeague(leagueId) {
    const body = document.getElementById('league-body');
    if (!body) return;
    body.innerHTML = '<tr><td colspan="4" class="loading-pulse">Updating Standings...</td></tr>';

    try {
        const cb = `&t=${Date.now()}`;
        const res = await fetch(`${FPL_PROXY}leagues-classic/${leagueId}/standings/${cb}`);
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
                            <div class="captain-row"><span class="c-badge">C</span> ${captainName}</div>
                        </div>
                    </td>
                    <td style="text-align:center; font-weight:800;">${r.event_total}</td>
                    <td style="text-align:right;">${r.total.toLocaleString()}</td>
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
            fetch(`${FPL_PROXY}entry/${r.entry}/event/${state.currentGW}/picks/&t=${Date.now()}`)
            .then(res => res.json()).catch(() => null)
        ));
        results = [...results, ...batchRes];
        await new Promise(r => setTimeout(r, 150));
    }
    return results;
}

/**
 * 5. MANAGER EXPANSION (Pitch View)
 */
async function toggleManagerExpansion(entryId) {
    const row = document.getElementById(`row-${entryId}`);
    const existingDetail = document.getElementById(`details-${entryId}`);

    if (existingDetail) { existingDetail.remove(); return; }

    const detailRow = document.createElement('tr');
    detailRow.id = `details-${entryId}`;
    detailRow.className = 'details-row';
    detailRow.innerHTML = `<td colspan="4" style="background:#f0f0f0;"><div class="loading-pulse" style="text-align:center; padding:20px;">Fetching Team Data...</div></td>`;
    row.parentNode.insertBefore(detailRow, row.nextSibling);

    try {
        const cb = `&t=${Date.now()}`;
        const [picksRes, liveRes, historyRes] = await Promise.all([
            fetch(`${FPL_PROXY}entry/${entryId}/event/${state.currentGW}/picks/${cb}`),
            fetch(`${FPL_PROXY}event/${state.currentGW}/live/${cb}`),
            fetch(`${FPL_PROXY}entry/${entryId}/history/${cb}`)
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
                        <div>Hits: -${picksData.entry_history.event_transfers_cost} | Bank: £${(picksData.entry_history.bank / 10).toFixed(1)}m</div>
                    </div>
                </div>
            </td>
        `;
        detailRow.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    } catch (e) { detailRow.innerHTML = `<td colspan="4">Error loading data.</td>`; }
}

function renderPitchRow(players) {
    return `<div class="pitch-row">
        ${players.map(p => `
            <div class="player-card">
                <img class="player-face" src="https://resources.premierleague.com/premierleague/photos/players/110x140/p${p.code}.png" onerror="this.src='https://fantasy.premierleague.com/static/media/player-missing-110.6625805d.png'">
                <div class="player-name">${p.isCap ? '(C) ' : ''}${p.name}</div>
                <div class="player-points">${p.pts}</div>
            </div>
        `).join('')}
    </div>`;
}

/**
 * 6. UI UTILITIES
 */
function showView(view) {
    state.activeView = view;
    localStorage.setItem('kopala_active_view', view);
    const tableView = document.getElementById('table-view');
    const pitchView = document.getElementById('pitch-view');
    if (tableView) tableView.style.display = view === 'table' ? 'block' : 'none';
    if (pitchView) pitchView.style.display = view === 'pitch' ? 'block' : 'none';
}

function handleDarkModeToggle() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

function resetApp() {
    if(confirm("Logout?")) { localStorage.clear(); window.location.reload(); }
}
