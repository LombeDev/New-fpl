/**
 * KOPALA FPL - MASTER CORE SCRIPT
 * Version: 2.7 (Pitch Pattern Integration & Persistence - Clean)
 */

const state = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    activeView: localStorage.getItem('kopala_active_view') || 'table',
    pitchPattern: localStorage.getItem('kopala_pitch_pattern') || 'p-vertical',
    playerMap: {}, 
    currentGW: 1,
    imageCache: JSON.parse(localStorage.getItem('kopala_img_cache')) || {}
};

const PROXY_ENDPOINT = "/.netlify/functions/fpl-proxy?endpoint=";

document.addEventListener('DOMContentLoaded', async () => {
    // 1. Theme Initialization
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        const darkToggle = document.getElementById('dark-mode-toggle');
        if (darkToggle) darkToggle.checked = true;
    }

    // 2. Pitch Pattern UI Initialization
    updatePitchUIState();

    // 3. Load App Data
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

/**
 * PITCH SELECTOR LOGIC
 */
function setPitchPattern(patternClass) {
    state.pitchPattern = patternClass;
    localStorage.setItem('kopala_pitch_pattern', patternClass);
    
    document.querySelectorAll('.pitch-container').forEach(container => {
        container.className = `pitch-container ${patternClass}`;
    });
    
    updatePitchUIState();
}

function updatePitchUIState() {
    document.querySelectorAll('.pitch-option').forEach(opt => {
        opt.classList.remove('active');
        if (opt.classList.contains(state.pitchPattern)) {
            opt.classList.add('active');
        }
    });
}

/**
 * IMAGE & CACHE SYSTEM
 */
function saveImageCache() {
    localStorage.setItem('kopala_img_cache', JSON.stringify(state.imageCache));
}

function getPlayerImageHtml(playerCode, className = "") {
    const playerKey = `p${playerCode}`;
    if (state.imageCache[playerKey] === 'failed') {
        return `<div class="img-container img-missing ${className}"></div>`;
    }
    const primaryUrl = `https://resources.premierleague.com/premierleague/photos/players/110x140/${playerKey}.png`;
    return `
        <div class="img-container ${className} skeleton-loading">
            <img src="${primaryUrl}" loading="lazy" onload="handleImageSuccess(this, '${playerKey}')" onerror="handleImageError(this, '${playerKey}')">
        </div>
    `;
}

function handleImageSuccess(imgElement, playerKey) {
    imgElement.parentElement.classList.remove('skeleton-loading');
    state.imageCache[playerKey] = 'loaded';
}

function handleImageError(imgElement, playerKey) {
    state.imageCache[playerKey] = 'failed';
    saveImageCache(); 
    const container = imgElement.parentElement;
    if (container) {
        container.classList.remove('skeleton-loading');
        container.classList.add('img-missing');
    }
    imgElement.remove();
}

/**
 * DATA FETCHING & APP INIT
 */
async function initAppData() {
    try {
        const cb = `&t=${Date.now()}`;
        const res = await fetch(`${PROXY_ENDPOINT}bootstrap-static/${cb}`);
        const data = await res.json();
        data.elements.forEach(p => {
            state.playerMap[p.id] = { name: p.web_name, code: p.code, pos: p.element_type };
        });
        const activeGW = data.events.find(e => e.is_current) || data.events.find(e => !e.finished);
        if (activeGW) {
            state.currentGW = activeGW.id;
            const timerEl = document.getElementById('deadline-timer');
            if (timerEl) timerEl.textContent = activeGW.name;
        }
    } catch (e) { console.error("Bootstrap error:", e); }
}

async function handleLogin() {
    const input = document.getElementById('team-id-input');
    const loginBtn = document.querySelector('.enter-id-btn');
    if (!input || !loginBtn) return;
    const teamId = input.value.trim();
    if (!teamId || isNaN(teamId)) {
        input.classList.add('input-error');
        setTimeout(() => input.classList.remove('input-error'), 500);
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
    body.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:40px;">Syncing Standings...</td></tr>';
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
                    <td><span style="color:${arrowColor}">${arrow}</span> ${r.rank}</td>
                    <td>
                        <div class="manager-info-stack">
                            <div style="font-weight:800;">${r.entry_name}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted);">${r.player_name}</div>
                            <div style="font-size:0.7rem; margin-top:4px; display:flex; align-items:center;">
                                <span style="background:var(--fpl-red); color:white; border-radius:50%; width:14px; height:14px; display:flex; align-items:center; justify-content:center; font-size:0.5rem; margin-right:4px; font-weight:bold;">C</span> 
                                <span style="font-weight:600;">${captainName}</span>
                            </div>
                        </div>
                    </td>
                    <td style="text-align:center;">${allPicks[index]?.entry_history?.event_transfers_cost > 0 ? `<div style="color:#e90052; font-weight:900;">-${allPicks[index].entry_history.event_transfers_cost}</div>` : `0`}</td>
                    <td style="text-align:right;"><div style="font-weight:800; color:var(--fpl-red);">${r.event_total}</div><div style="font-size:0.75rem;">${r.total.toLocaleString()}</div></td>
                </tr>
            `;
        }).join('');
        await calculateLeagueAnalytics(standings, allPicks);
    } catch (err) { console.error("League error", err); }
}

async function batchFetchCaptains(standings) {
    let results = [];
    for (let i = 0; i < Math.min(standings.length, 15); i += 5) {
        const batch = standings.slice(i, i + 5);
        const batchRes = await Promise.all(batch.map(r => fetch(`${PROXY_ENDPOINT}entry/${r.entry}/event/${state.currentGW}/picks/&t=${Date.now()}`).then(res => res.json()).catch(() => null)));
        results = [...results, ...batchRes];
        await new Promise(r => setTimeout(r, 100));
    }
    return results;
}

async function calculateLeagueAnalytics(standings, allPicks) {
    const myEntryId = parseInt(state.fplId);
    const myPicksData = allPicks.find((p, index) => standings[index].entry === myEntryId);
    if (!myPicksData) return;
    const liveRes = await fetch(`${PROXY_ENDPOINT}event/${state.currentGW}/live/&t=${Date.now()}`);
    const liveData = await liveRes.json();
    const livePointsMap = {};
    liveData.elements.forEach(el => livePointsMap[el.id] = el.stats.total_points);
    const mySquadIds = new Set(myPicksData.picks.map(p => p.element));
    const leagueSize = allPicks.filter(p => p !== null).length;
    const ownershipCount = {};
    allPicks.forEach(playerPicks => {
        if (!playerPicks) return;
        playerPicks.picks.forEach(p => { ownershipCount[p.element] = (ownershipCount[p.element] || 0) + 1; });
    });
    const analytics = [];
    for (const [id, count] of Object.entries(ownershipCount)) {
        const pId = parseInt(id);
        const ownershipPct = (count / leagueSize) * 100;
        analytics.push({ id: pId, name: state.playerMap[pId]?.name || "Unknown", pts: livePointsMap[pId] || 0, ownedByMe: mySquadIds.has(pId), ownership: ownershipPct, impact: 100 - ownershipPct });
    }
    renderImpactUI('diffs-list', analytics.filter(p => p.ownedByMe).sort((a, b) => a.ownership - b.ownership).slice(0, 3), true);
    renderImpactUI('threats-list', analytics.filter(p => !p.ownedByMe).sort((a, b) => b.ownership - a.ownership).slice(0, 3), false);
}

function renderImpactUI(containerId, players, isGain) {
    const container = document.getElementById(containerId);
    if (container) container.innerHTML = players.map(p => `<div class="player-impact-card"><div class="shirt-wrapper">${getPlayerImageHtml(state.playerMap[p.id]?.code)}</div><div class="player-name-tag">${p.name}</div><div class="player-pts-tag">${p.pts}</div><div class="impact-badge ${isGain ? 'gain' : 'loss'}">${isGain ? '+' : ''}${p.impact.toFixed(1)}%</div></div>`).join('');
}

/**
 * PITCH RENDERING LOGIC
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
        const [picksRes, liveRes] = await Promise.all([
            fetch(`${PROXY_ENDPOINT}entry/${entryId}/event/${state.currentGW}/picks/&t=${Date.now()}`),
            fetch(`${PROXY_ENDPOINT}event/${state.currentGW}/live/&t=${Date.now()}`)
        ]);
        const picksData = await picksRes.json();
        const liveData = await liveRes.json();
        
        const livePointsMap = {};
        liveData.elements.forEach(el => livePointsMap[el.id] = el.stats.total_points);
        
        const squad = picksData.picks.map(p => ({ 
            ...state.playerMap[p.element], 
            isCap: p.is_captain, 
            multiplier: p.multiplier,
            pts: (livePointsMap[p.element] || 0) * (p.multiplier || 1) 
        }));

        detailRow.innerHTML = `
            <td colspan="4" style="padding:0;">
                <div class="pitch-container ${state.pitchPattern}">
                    ${renderPitchRow(squad.filter(p => p.pos === 1))}
                    ${renderPitchRow(squad.filter(p => p.pos === 2))}
                    ${renderPitchRow(squad.filter(p => p.pos === 3))}
                    ${renderPitchRow(squad.filter(p => p.pos === 4))}
                </div>
            </td>`;
    } catch (e) { detailRow.innerHTML = `<td colspan="4">Error loading data.</td>`; }
}

function renderPitchRow(players) {
    return `
        <div class="pitch-row">
            ${players.map(p => `
                <div class="player-card">
                    ${getPlayerImageHtml(p.code, "player-face")}
                    <div class="player-label-stack">
                        <div class="p-name-bar">${p.isCap ? '(C) ' : ''}${p.name}</div>
                        <div class="p-stat-bar">${p.multiplier}x</div>
                        <div class="p-points-bar">${p.pts}</div>
                    </div>
                </div>
            `).join('')}
        </div>`;
}

/**
 * UI TABS & MODALS
 */
function showView(view) {
    state.activeView = view;
    localStorage.setItem('kopala_active_view', view);
    document.getElementById('table-view').style.display = view === 'table' ? 'block' : 'none';
    document.getElementById('pitch-view').style.display = view === 'pitch' ? 'block' : 'none';
    
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    const btnId = view === 'table' ? 'tab-table' : 'tab-pitch';
    const activeBtn = document.getElementById(btnId);
    if (activeBtn) activeBtn.classList.add('active');
    
    moveIndicator(btnId);
}

function moveIndicator(id) {
    const btn = document.getElementById(id);
    const indicator = document.getElementById('main-indicator');
    if (btn && indicator) { 
        indicator.style.width = `${btn.offsetWidth}px`; 
        indicator.style.left = `${btn.offsetLeft}px`; 
    }
}

function handleDarkModeToggle() {
    const isDark = document.getElementById('dark-mode-toggle').checked;
    if (isDark) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('theme', 'dark');
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('theme', 'light');
    }
}

function toggleSettings() {
    const drawer = document.getElementById('settings-drawer');
    if (drawer) drawer.classList.toggle('open');
}

function resetApp() { 
    localStorage.clear(); 
    window.location.href = window.location.pathname; 
}

window.addEventListener('load', () => { 
    setTimeout(() => moveIndicator('tab-table'), 500); 
});

/**
 * THEME & LOGOUT
 */
const themeToggle = document.getElementById('theme-toggle');
const logoutBtn = document.getElementById('logout-btn');

if (themeToggle) {
    themeToggle.addEventListener('click', () => {
        document.body.classList.toggle('dark-mode');
        let isDark = document.body.classList.contains('dark-mode');
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        updateThemeUI(isDark);
    });
}

function updateThemeUI(isDark) {
    const icon = themeToggle?.querySelector('.icon');
    const text = themeToggle?.querySelector('.text');
    if (icon) icon.textContent = isDark ? '☀️' : '🌙';
    if (text) text.textContent = isDark ? 'Day Mode' : 'Night Mode';
}

if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        if (confirm("Are you sure you want to log out?")) {
            resetApp();
        }
    });
}