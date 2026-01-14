/**
 * KOPALA FPL - MASTER CORE SCRIPT
 * Version: 3.0 (Full Integration)
 */

const state = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    activeView: localStorage.getItem('kopala_active_view') || 'table',
    playerMap: {}, 
    currentGW: 1, 
};

// Netlify Function Proxy Endpoint
const PROXY_ENDPOINT = "/.netlify/functions/fpl-proxy?endpoint=";

/**
 * 1. INITIALIZATION
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Theme Persistence
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        const darkToggle = document.getElementById('dark-mode-toggle');
        if (darkToggle) darkToggle.checked = true;
    }

    // Load Global FPL Data
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
 * 2. BOOTSTRAP DATA (Players & Teams)
 */
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
                pos: p.element_type,
                team_code: p.team_code
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
 * 3. DASHBOARD & LIVE DATA
 */
async function fetchManagerData() {
    try {
        const cb = `&t=${Date.now()}`;
        
        // Parallel fetch for speed
        const [entryRes, liveRes, picksRes] = await Promise.all([
            fetch(`${PROXY_ENDPOINT}entry/${state.fplId}/${cb}`),
            fetch(`${PROXY_ENDPOINT}event/${state.currentGW}/live/${cb}`),
            fetch(`${PROXY_ENDPOINT}entry/${state.fplId}/event/${state.currentGW}/picks/${cb}`)
        ]);

        const data = await entryRes.json();
        const liveData = await liveRes.json();
        const picksData = await picksRes.json();

        // Map live points
        const livePointsMap = {};
        liveData.elements.forEach(el => {
            livePointsMap[el.id] = el.stats.total_points;
        });

        // Update Text Stats
        document.getElementById('disp-name').textContent = `${data.player_first_name} ${data.player_last_name}`;
        document.getElementById('disp-total').textContent = data.summary_overall_points.toLocaleString();
        document.getElementById('disp-rank').textContent = (data.summary_overall_rank || 0).toLocaleString();
        document.getElementById('disp-gw').textContent = `${data.summary_event_points} points`;
        document.getElementById('disp-transfers').textContent = picksData.entry_history.event_transfers;

        // Arrow & Status Logic
        const arrowEl = document.getElementById('rank-arrow');
        const statusText = document.getElementById('arrow-status-text');
        const isUp = data.summary_overall_rank < (data.last_deadline_overall_rank || 1000000);
        
        if(arrowEl) {
            arrowEl.textContent = isUp ? "▲" : "▼";
            arrowEl.style.background = isUp ? "#00ff85" : "#e90052";
        }
        if(statusText) {
            statusText.textContent = isUp ? "GREEN ARROW" : "RED ARROW";
            statusText.style.color = isUp ? "#008d4c" : "#e90052";
        }

        // Safety Score Mockup
        const pointsBox = document.querySelector('.points-box');
        if (pointsBox) {
            pointsBox.innerHTML = `
                <div class="status-icon-small">🔢</div>
                <div class="status-text-wrap">
                    <p class="status-label">Gameweek points</p>
                    <h2>${data.summary_event_points}</h2>
                    <p class="status-detail">Safety Score: 55 pts 🚀</p>
                </div>
            `;
        }

        // Differentials (Top 4 Picks)
        const myDiffs = picksData.picks.slice(0, 4).map(p => ({
            ...state.playerMap[p.element],
            points: livePointsMap[p.element] || 0,
            impact: (90 + Math.random() * 9).toFixed(1)
        }));
        renderImpactPlayers('diffs-list', myDiffs, 'diff');

        // Threats (Example static threats)
        const threats = [
            { name: 'Haaland', team_code: 43, points: livePointsMap[355] || 0, impact: 98.2 },
            { name: 'Salah', team_code: 14, points: livePointsMap[308] || 0, impact: 92.5 }
        ];
        renderImpactPlayers('threats-list', threats, 'threat');

        // Load League Selector
        const invitational = data.leagues.classic.filter(l => l.league_type === 'x');
        const select = document.getElementById('league-select');
        if (select && invitational.length > 0) {
            select.innerHTML = invitational.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
            changeLeague(invitational[0].id);
        }

    } catch (e) { console.error("Manager data error", e); }
}

function renderImpactPlayers(containerId, players, type) {
    const container = document.getElementById(containerId);
    if (!container) return;
    container.innerHTML = players.map(p => `
        <div class="player-impact-card">
            <div class="shirt-wrapper">
                <img src="https://fantasy.premierleague.com/static/media/shirts/standard/shirt_${p.team_code}-8.webp">
            </div>
            <div class="player-name-tag">${p.name}</div>
            <div class="player-pts-tag">${p.points}</div>
            <div class="impact-badge ${type === 'diff' ? 'gain' : 'loss'}">
                ${type === 'diff' ? '+' : '-'}${p.impact}%
            </div>
        </div>
    `).join('');
}

/**
 * 4. LEAGUE & PITCH LOGIC
 */
async function changeLeague(leagueId) {
    const body = document.getElementById('league-body');
    if (!body) return;
    body.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:40px;">Syncing...</td></tr>';

    try {
        const cb = `&t=${Date.now()}`;
        const res = await fetch(`${PROXY_ENDPOINT}leagues-classic/${leagueId}/standings/${cb}`);
        const data = await res.json();
        const standings = data.standings.results;

        body.innerHTML = standings.map(r => {
            const arrow = r.last_rank > r.rank ? '▲' : (r.last_rank < r.rank ? '▼' : '-');
            const arrowColor = r.last_rank > r.rank ? '#00ff85' : '#e90052';
            return `
                <tr id="row-${r.entry}" class="manager-row" onclick="toggleManagerExpansion(${r.entry})">
                    <td style="font-weight: bold;"><span style="color:${arrowColor}">${arrow}</span> ${r.rank}</td>
                    <td>
                        <div class="manager-info-stack">
                            <div style="font-weight:800;">${r.entry_name}</div>
                            <div style="font-size:0.75rem; opacity:0.6;">${r.player_name}</div>
                        </div>
                    </td>
                    <td style="text-align:center; font-weight:800; color:var(--fpl-red);">${r.event_total}</td>
                    <td style="text-align:right;">${r.total.toLocaleString()}</td>
                </tr>
            `;
        }).join('');
    } catch (err) { console.error("League error", err); }
}

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
    detailRow.innerHTML = `<td colspan="4" style="text-align:center; padding:20px;">Fetching Team...</td>`;
    row.parentNode.insertBefore(detailRow, row.nextSibling);

    try {
        const cb = `&t=${Date.now()}`;
        const [picksRes, liveRes] = await Promise.all([
            fetch(`${PROXY_ENDPOINT}entry/${entryId}/event/${state.currentGW}/picks/${cb}`),
            fetch(`${PROXY_ENDPOINT}event/${state.currentGW}/live/${cb}`)
        ]);
        
        const picksData = await picksRes.json();
        const liveData = await liveRes.json();

        const liveMap = {};
        liveData.elements.forEach(el => liveMap[el.id] = el.stats.total_points);

        const squad = picksData.picks.map(p => ({
            ...state.playerMap[p.element],
            isCap: p.is_captain,
            pts: (liveMap[p.element] || 0) * (p.multiplier || 1)
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
    } catch (e) { detailRow.innerHTML = `<td colspan="4">Error loading team.</td>`; }
}

function renderPitchRow(players) {
    return `<div class="pitch-row" style="display:flex; justify-content:center; gap:10px; padding:10px;">
        ${players.map(p => `
            <div class="player-card" style="text-align:center; width:60px;">
                <img src="https://resources.premierleague.com/premierleague/photos/players/110x140/p${p.code}.png" style="width:100%;" onerror="this.src='https://fantasy.premierleague.com/static/media/player-missing-110.6625805d.png'">
                <div style="font-size:0.6rem; background:#242f3d; color:white; padding:2px;">${p.isCap ? 'C ' : ''}${p.name}</div>
                <div style="font-size:0.7rem; font-weight:bold;">${p.pts}</div>
            </div>
        `).join('')}
    </div>`;
}

/**
 * 5. UTILS & NAVIGATION
 */
function showView(view) {
    state.activeView = view;
    localStorage.setItem('kopala_active_view', view);
    
    document.querySelectorAll('.view-section').forEach(el => el.style.display = 'none');
    const activeEl = document.getElementById(`${view}-view`);
    if(activeEl) activeEl.style.display = 'block';

    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.classList.toggle('active', btn.getAttribute('onclick').includes(view));
    });
}

async function refreshLiveScores() {
    const icon = document.getElementById('refresh-icon');
    if (icon) icon.style.transform = "rotate(360deg)";
    await fetchManagerData();
    setTimeout(() => { if (icon) icon.style.transform = "rotate(0deg)"; }, 1000);
}

function toggleSettings() {
    const drawer = document.getElementById('settings-drawer');
    if (drawer) drawer.classList.toggle('open');
}

function handleDarkModeToggle() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

async function handleLogin() {
    const input = document.getElementById('team-id-input');
    const teamId = input.value.trim();
    if (!teamId || isNaN(teamId)) return alert("Enter a valid ID");
    
    localStorage.setItem('kopala_fpl_id', teamId);
    window.location.reload();
}

function resetApp() {
    if(confirm("Logout?")) { 
        localStorage.clear(); 
        window.location.reload(); 
    }
}
