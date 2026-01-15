/**
 * KOPALA FPL - MASTER CORE SCRIPT
 * Version: 2.2 (Analytics Integrated & Functionally Fixed)
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
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        const darkToggle = document.getElementById('dark-mode-toggle');
        if (darkToggle) darkToggle.checked = true;
    }

    await initAppData();

    const loginScreen = document.getElementById('login-screen');
    const dashboard = document.getElementById('dashboard');

    if (state.fplId) {
        if (loginScreen) loginScreen.style.display = 'none';
        if (dashboard) dashboard.style.display = 'block';
        showView(state.activeView);
        await fetchManagerData();
    } else {
        if (loginScreen) loginScreen.style.display = 'flex';
        if (dashboard) dashboard.style.display = 'none';
    }
});

async function initAppData() {
    try {
        const cb = `&t=${Date.now()}`;
        const res = await fetch(`${PROXY_ENDPOINT}bootstrap-static/${cb}`);
        if (!res.ok) throw new Error("API Offline");
        const data = await res.json();
        
        data.elements.forEach(p => {
            state.playerMap[p.id] = { 
                name: p.web_name, 
                code: p.code, 
                pos: p.element_type 
            };
        });

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
 * 2. LOGIN & MANAGER DATA
 */
async function handleLogin() {
    const input = document.getElementById('team-id-input');
    const loginBtn = document.querySelector('.enter-id-btn');
    if (!input || !loginBtn) return;

    const teamId = input.value.trim();
    if (!teamId || isNaN(teamId)) {
        input.classList.add('input-error');
        setTimeout(() => input.classList.remove('input-error'), 500);
        alert("Please enter a valid numeric Team ID.");
        return;
    }

    loginBtn.disabled = true;
    loginBtn.innerText = "VERIFYING...";

    try {
        const cb = `&t=${Date.now()}`;
        const res = await fetch(`${PROXY_ENDPOINT}entry/${teamId}/${cb}`);
        if (!res.ok) throw new Error("ID Not Found");

        localStorage.clear();
        localStorage.setItem('kopala_fpl_id', teamId);
        window.location.href = window.location.pathname + '?v=' + Date.now();
    } catch (error) {
        alert("Invalid Team ID.");
        loginBtn.disabled = false;
        loginBtn.innerText = "ENTER";
    }
}

async function fetchManagerData() {
    try {
        const cb = `&t=${Date.now()}`;
        const res = await fetch(`${PROXY_ENDPOINT}entry/${state.fplId}/${cb}`);
        const data = await res.json();
        
        const nameEl = document.getElementById('disp-name');
        const totalEl = document.getElementById('disp-total');
        const rankEl = document.getElementById('disp-rank');

        if (nameEl) nameEl.textContent = `${data.player_first_name} ${data.player_last_name}`;
        if (totalEl) totalEl.textContent = data.summary_overall_points.toLocaleString();
        if (rankEl) rankEl.textContent = (data.summary_overall_rank || 0).toLocaleString();

        const invitational = data.leagues.classic.filter(l => l.league_type === 'x');
        const select = document.getElementById('league-select');
        
        if (select && invitational.length > 0) {
            select.innerHTML = invitational.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
            changeLeague(invitational[0].id);
        }
    } catch (e) { console.error("Manager data error", e); }
}

/**
 * 3. LEAGUE & ANALYTICS
 */
async function changeLeague(leagueId) {
    const body = document.getElementById('league-body');
    if (!body) return;
    
    body.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:40px;">Syncing Standings...</td></tr>';

    try {
        const cb = `&t=${Date.now()}`;
        const res = await fetch(`${PROXY_ENDPOINT}leagues-classic/${leagueId}/standings/${cb}`);
        const data = await res.json();
        const standings = data.standings.results;

        // Fetch picks for the top 15 managers
        const allPicks = await batchFetchCaptains(standings);

        // Populate Table
        body.innerHTML = standings.map((r, index) => {
            const arrow = r.last_rank > r.rank ? '▲' : (r.last_rank < r.rank && r.last_rank !== 0 ? '▼' : '-');
            const arrowColor = r.last_rank > r.rank ? '#00ff85' : '#e90052';
            const capId = allPicks[index]?.picks?.find(p => p.is_captain)?.element;
            const captainName = state.playerMap[capId]?.name || "N/A";

           // Inside changeLeague standings.map...
// Inside changeLeague standings.map...
return `
    <tr id="row-${r.entry}" class="manager-row">
        <td style="font-weight: bold;" onclick="toggleManagerExpansion(${r.entry})">
            <span style="color:${arrowColor}">${arrow}</span> ${r.rank}
        </td>

        <td onclick="toggleManagerExpansion(${r.entry})">
            <div class="manager-info-stack">
                <div class="manager-entry-name" style="font-weight:800;">${r.entry_name}</div>
                <div class="manager-real-name" style="font-size:0.75rem; color:var(--text-muted);">${r.player_name}</div>
                
                <div class="captain-name-row" style="font-size:0.7rem; margin-top:4px; display:flex; align-items:center;">
                    <span class="cap-badge" style="background:var(--fpl-red); color:white; border-radius:50%; width:14px; height:14px; display:flex; align-items:center; justify-content:center; font-size:0.5rem; margin-right:4px; font-weight:bold;">C</span> 
                    <span style="font-weight:600;">${state.playerMap[allPicks[index]?.picks?.find(p => p.is_captain)?.element]?.name || "N/A"}</span>
                </div>
            </div>
        </td>

        <td style="text-align:center; vertical-align: middle;">
            <input type="checkbox" class="compare-chk" onchange="selectForCompare(${r.entry}, '${r.entry_name.replace(/'/g, "\\'")}')">
        </td>

        <td style="text-align:center; vertical-align: middle;">
            ${allPicks[index]?.entry_history?.event_transfers_cost > 0 
                ? `<div style="color:#e90052; font-weight:900; font-size:0.9rem;">-${allPicks[index].entry_history.event_transfers_cost}</div>
                   <div style="font-size:0.6rem; text-transform:uppercase; font-weight:700; opacity:0.7;">HIT</div>`
                : `<div style="color:var(--text-muted); font-size:0.8rem; font-weight:500;">0</div>`
            }
        </td>

        <td style="text-align:right;">
            <div style="font-weight:800; color:var(--fpl-red); font-size: 0.9rem;">${r.event_total}</div>
            <div style="font-size: 0.75rem; font-weight:600; color: var(--text-muted);">${r.total.toLocaleString()}</div>
        </td>
    </tr>
`;
        }).join('');

        // TRIGGER ANALYTICS (Differentials & Threats)
        await calculateLeagueAnalytics(standings, allPicks);

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

async function calculateLeagueAnalytics(standings, allPicks) {
    const myEntryId = parseInt(state.fplId);
    const myPicksData = allPicks.find((p, index) => standings[index].entry === myEntryId);
    if (!myPicksData) return;

    // Get Live points for the small point tags
    const liveRes = await fetch(`${PROXY_ENDPOINT}event/${state.currentGW}/live/&t=${Date.now()}`);
    const liveData = await liveRes.json();
    const livePointsMap = {};
    liveData.elements.forEach(el => livePointsMap[el.id] = el.stats.total_points);

    const mySquadIds = new Set(myPicksData.picks.map(p => p.element));
    const leagueSize = allPicks.filter(p => p !== null).length;
    const ownershipCount = {};

    allPicks.forEach(playerPicks => {
        if (!playerPicks) return;
        playerPicks.picks.forEach(p => {
            ownershipCount[p.element] = (ownershipCount[p.element] || 0) + 1;
        });
    });

    const analytics = [];
    for (const [id, count] of Object.entries(ownershipCount)) {
        const pId = parseInt(id);
        const ownershipPct = (count / leagueSize) * 100;
        analytics.push({
            id: pId,
            name: state.playerMap[pId]?.name || "Unknown",
            pts: livePointsMap[pId] || 0,
            ownedByMe: mySquadIds.has(pId),
            ownership: ownershipPct,
            impact: 100 - ownershipPct 
        });
    }

    const differentials = analytics.filter(p => p.ownedByMe).sort((a, b) => a.ownership - b.ownership).slice(0, 3);
    const threats = analytics.filter(p => !p.ownedByMe).sort((a, b) => b.ownership - a.ownership).slice(0, 3);

    renderImpactUI('diffs-list', differentials, true);
    renderImpactUI('threats-list', threats, false);
}

function renderImpactUI(containerId, players, isGain) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = players.map(p => `
        <div class="player-impact-card">
            <div class="shirt-wrapper">
                <img src="https://resources.premierleague.com/premierleague/photos/players/110x140/p${state.playerMap[p.id]?.code}.png" 
                     onerror="this.src='https://fantasy.premierleague.com/static/media/player-missing-110.6625805d.png'">
            </div>
            <div class="player-name-tag">${p.name}</div>
            <div class="player-pts-tag">${p.pts}</div>
            <div class="impact-badge ${isGain ? 'gain' : 'loss'}">
                ${isGain ? '+' : ''}${p.impact.toFixed(1)}%
            </div>
        </div>
    `).join('');
}

/**
 * 4. UI UTILS
 */
async function toggleManagerExpansion(entryId) {
    const row = document.getElementById(`row-${entryId}`);
    const existingDetail = document.getElementById(`details-${entryId}`);
    if (existingDetail) { existingDetail.remove(); return; }

    const detailRow = document.createElement('tr');
    detailRow.id = `details-${entryId}`;
    detailRow.className = 'details-row';
    detailRow.innerHTML = `<td colspan="4" style="text-align:center; padding:20px;">FETCHING PITCH...</td>`;
    row.parentNode.insertBefore(detailRow, row.nextSibling);

    try {
        const cb = `&t=${Date.now()}`;
        const [picksRes, liveRes] = await Promise.all([
            fetch(`${PROXY_ENDPOINT}entry/${entryId}/event/${state.currentGW}/picks/${cb}`),
            fetch(`${PROXY_ENDPOINT}event/${state.currentGW}/live/${cb}`)
        ]);
        
        const picksData = await picksRes.json();
        const liveData = await liveRes.json();

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
            </td>
        `;
    } catch (e) { detailRow.innerHTML = `<td colspan="4">Error loading data.</td>`; }
}

function renderPitchRow(players) {
    return `<div class="pitch-row">${players.map(p => `
        <div class="player-card">
            <img class="player-face" src="https://resources.premierleague.com/premierleague/photos/players/110x140/p${p.code}.png">
            <div class="player-info-label">${p.isCap ? '(C) ' : ''}${p.name}</div>
            <div class="player-points-badge">${p.pts}</div>
        </div>`).join('')}</div>`;
}

function showView(view) {
    state.activeView = view;
    localStorage.setItem('kopala_active_view', view);
    const tableView = document.getElementById('table-view');
    const pitchView = document.getElementById('pitch-view');
    if (tableView) tableView.style.display = view === 'table' ? 'block' : 'none';
    if (pitchView) pitchView.style.display = view === 'pitch' ? 'block' : 'none';
}

function toggleSettings() {
    const drawer = document.getElementById('settings-drawer');
    if (drawer) drawer.classList.toggle('open');
    else if (confirm("Logout?")) resetApp();
}

function resetApp() {
    localStorage.clear();
    window.location.href = window.location.pathname;
}




/**
 * 5. COMPARISON ENGINE (New)
 */
let selectedForComparison = [];

function selectForCompare(entryId, entryName) {
    // If already selected, remove it (toggle)
    if (selectedForComparison.find(s => s.id === entryId)) {
        selectedForComparison = selectedForComparison.filter(s => s.id !== entryId);
    } else {
        // Only allow 2 selections
        if (selectedForComparison.length >= 2) selectedForComparison.shift();
        selectedForComparison.push({ id: entryId, name: entryName });
    }
    
    updateCompareButtonUI();
}

function updateCompareButtonUI() {
    const btn = document.getElementById('tab-compare');
    if (!btn) return;
    
    if (selectedForComparison.length === 2) {
        btn.style.background = "var(--fpl-green)";
        btn.innerText = "COMPARE (2)";
        btn.disabled = false;
    } else {
        btn.style.background = "var(--fpl-purple)";
        btn.innerText = `COMPARE (${selectedForComparison.length})`;
        btn.disabled = selectedForComparison.length < 2;
    }
}

async function openCompareModal() {
    const modal = document.getElementById('compare-modal');
    const col1 = document.getElementById('team-1-col');
    const col2 = document.getElementById('team-2-col');
    
    modal.style.display = 'block';
    col1.innerHTML = '<div class="loader-small"></div>';
    col2.innerHTML = '<div class="loader-small"></div>';

    try {
        const [id1, id2] = selectedForComparison.map(s => s.id);
        const cb = `&t=${Date.now()}`;
        
        // Fetch Live Points and Picks
        const [res1, res2, liveRes] = await Promise.all([
            fetch(`${PROXY_ENDPOINT}entry/${id1}/event/${state.currentGW}/picks/${cb}`),
            fetch(`${PROXY_ENDPOINT}entry/${id2}/event/${state.currentGW}/picks/${cb}`),
            fetch(`${PROXY_ENDPOINT}event/${state.currentGW}/live/${cb}`)
        ]);

        const data1 = await res1.json();
        const data2 = await res2.json();
        const liveData = await liveRes.json();
        
        const pointsMap = {};
        liveData.elements.forEach(el => pointsMap[el.id] = el.stats.total_points);

        renderCompareColumn(col1, data1.picks, pointsMap, selectedForComparison[0].name);
        renderCompareColumn(col2, data2.picks, pointsMap, selectedForComparison[1].name);

    } catch (e) {
        console.error("Comparison Error", e);
    }
}

function renderCompareColumn(container, picks, pointsMap, teamName) {
    container.innerHTML = `<div class="compare-header">${teamName}</div>`;
    
    picks.forEach(pick => {
        const p = state.playerMap[pick.element];
        const pts = (pointsMap[pick.element] || 0) * (pick.multiplier || 1);
        
        container.innerHTML += `
            <div class="compare-card">
                <img src="https://resources.premierleague.com/premierleague/photos/players/110x140/p${p.code}.png" 
                     onerror="this.src='https://fantasy.premierleague.com/static/media/player-missing-110.6625805d.png'">
                <div class="compare-info">
                    <span class="p-name">${p.name}</span>
                    <span class="p-pts">${pts} pts</span>
                </div>
                ${pick.is_captain ? '<span class="c-tag">C</span>' : ''}
            </div>
        `;
    });
}

function closeCompareModal() {
    document.getElementById('compare-modal').style.display = 'none';
}



function updateActiveTab(clickedId) {
    // Remove active class from all
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    // Add to the one we clicked
    document.getElementById(clickedId).classList.add('active');
}


function showView(view) {
    const btnId = view === 'table' ? 'tab-table' : 'tab-pitch';
    
    // Update Active Classes
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById(btnId).classList.add('active');

    // Move the Underline
    moveIndicator(btnId);

    // Logic to show/hide your views
    if(view === 'table') {
        document.getElementById('table-view').style.display = 'block';
        document.getElementById('pitch-view').style.display = 'none';
    } else {
        document.getElementById('table-view').style.display = 'none';
        document.getElementById('pitch-view').style.display = 'block';
    }
}

// Separate function for Compare to handle the modal + underline
function handleCompareClick() {
    moveIndicator('tab-compare');
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    document.getElementById('tab-compare').classList.add('active');
    openCompareModal();
}

function moveIndicator(id) {
    const btn = document.getElementById(id);
    const indicator = document.getElementById('main-indicator');
    
    if (btn && indicator) {
        // We use offsetLeft and offsetWidth to calculate exact position relative to the centered container
        indicator.style.width = `${btn.offsetWidth}px`;
        indicator.style.left = `${btn.offsetLeft}px`;
    }
}

// Initial position on load
window.addEventListener('load', () => {
    setTimeout(() => moveIndicator('tab-table'), 100);
});
