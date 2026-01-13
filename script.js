/**
 * KOPALA FPL - MASTER CORE SCRIPT
 * Full Integration: Auth, Table, Live Match Center, and Pitch Expansion
 */

const state = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    playerMap: {}, 
    livePoints: {},
    currentGW: 1, 
    myPlayerIds: [] // Stores user's squad for live highlighting
};

const PROXY_ENDPOINT = "/.netlify/functions/fpl-proxy?endpoint=";
const FIXTURES_ENDPOINT = "/.netlify/functions/fpl-proxy?endpoint=fixtures/?event=";

let refreshTimer = null;
let teamLookup = {}; 

/**
 * 1. INITIALIZATION & THEME
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Apply Theme
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        const toggle = document.getElementById('dark-mode-toggle');
        if (toggle) toggle.checked = true;
    }

    await initAppData();

    if (state.fplId) {
        document.getElementById('team-id-input').value = state.fplId;
        handleLogin();
    }
});

function handleDarkModeToggle() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

/**
 * 2. DATA BOOTSTRAPPING
 */
async function initAppData() {
    try {
        const res = await fetch(`${PROXY_ENDPOINT}bootstrap-static/`);
        const data = await res.json();
        
        data.elements.forEach(p => {
            state.playerMap[p.id] = {
                name: p.web_name,
                pos: p.element_type,
                team: p.team,
                code: p.code // Required for player photos
            };
        });

        data.teams.forEach(t => teamLookup[t.id] = t.name);
        
        const activeGW = data.events.find(e => e.is_current) || data.events.find(e => !e.finished);
        if (activeGW) state.currentGW = activeGW.id;

    } catch (err) { console.error("Init Error", err); }
}

/**
 * 3. AUTH & SQUAD TRACKING
 */
async function handleLogin() {
    const id = document.getElementById('team-id-input').value;
    if (!id || isNaN(id)) return alert("Enter a numeric Team ID");
    
    state.fplId = id;
    localStorage.setItem('kopala_fpl_id', id);
    
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    
    await fetchMySquad();
    await fetchManagerData();
}

async function fetchMySquad() {
    try {
        const res = await fetch(`${PROXY_ENDPOINT}entry/${state.fplId}/event/${state.currentGW}/picks/`);
        const data = await res.json();
        state.myPlayerIds = data.picks.map(p => p.element);
    } catch (err) { console.error("Squad Sync Error", err); }
}

async function fetchManagerData() {
    try {
        const res = await fetch(`${PROXY_ENDPOINT}entry/${state.fplId}/`);
        const data = await res.json();
        
        document.getElementById('disp-name').textContent = `${data.player_first_name} ${data.player_last_name}`;
        document.getElementById('disp-gw').textContent = data.summary_event_points || 0;
        document.getElementById('disp-total').textContent = data.summary_overall_points.toLocaleString();
        document.getElementById('disp-rank').textContent = (data.summary_overall_rank || 0).toLocaleString();

        const select = document.getElementById('league-select');
        select.innerHTML = data.leagues.classic.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
        
        if (data.leagues.classic.length > 0) changeLeague(data.leagues.classic[0].id);
    } catch (err) { console.error("Manager Error", err); }
}

/**
 * 4. LEAGUE STANDINGS
 */
async function changeLeague(id) {
    try {
        const res = await fetch(`${PROXY_ENDPOINT}leagues-classic/${id}/standings/`);
        const data = await res.json();
        const body = document.getElementById('league-body');
        
        body.innerHTML = data.standings.results.map(r => `
            <tr id="row-${r.entry}" class="manager-row" onclick="toggleManagerExpansion(${r.entry})">
                <td>${r.rank}</td>
                <td><strong>${r.entry_name}</strong><br><small>${r.player_name}</small></td>
                <td class="score-text">${r.event_total}</td>
                <td>${r.total.toLocaleString()}</td>
            </tr>
        `).join('');
    } catch (err) { console.error("League Error", err); }
}

/**
 * 5. PITCH EXPANSION (Starting XI + Bench + Live Points)
 */
async function toggleManagerExpansion(managerId) {
    const existing = document.querySelector('.details-row');
    const targetRow = document.getElementById(`row-${managerId}`);

    if (existing && existing.previousElementSibling === targetRow) {
        existing.remove();
        return;
    }
    if (existing) existing.remove();

    const template = document.getElementById('manager-details-template');
    const clone = template.content.cloneNode(true);
    targetRow.after(clone);

    try {
        const [pResp, liveResp] = await Promise.all([
            fetch(`${PROXY_ENDPOINT}entry/${managerId}/event/${state.currentGW}/picks/`),
            fetch(`${PROXY_ENDPOINT}event/${state.currentGW}/live/`)
        ]);

        const pData = await pResp.json();
        const liveData = await liveResp.json();

        const livePointsMap = {};
        liveData.elements.forEach(item => {
            livePointsMap[item.id] = item.stats.total_points;
        });

        pData.picks.forEach((pick, index) => {
            const player = state.playerMap[pick.element];
            const points = livePointsMap[pick.element] || 0;
            const multiplier = pick.multiplier;
            const photoUrl = `https://resources.premierleague.com/premierleague/photos/players/110x140/p${player.code}.png`;
            
            let containerId;
            if (index < 11) {
                const rowIds = { 1: 'exp-gkp', 2: 'exp-def', 3: 'exp-mid', 4: 'exp-fwd' };
                containerId = rowIds[player.pos];
            } else {
                containerId = 'exp-bench';
            }

            const container = document.getElementById(containerId);
            if (container) {
                container.innerHTML += `
                    <div class="mini-player ${index >= 11 ? 'is-bench' : ''}">
                        <div class="player-photo-wrapper">
                            <img src="${photoUrl}" class="player-face" onerror="this.src='https://fantasy.premierleague.com/static/media/player-missing-110.43794689.png'">
                            <div class="player-points-badge">${points * (multiplier || 1)}</div>
                        </div>
                        <div class="player-name-tag ${multiplier > 1 ? 'is-captain' : ''}">
                            ${multiplier > 1 ? 'C' : ''} ${player.name}
                        </div>
                    </div>
                `;
            }
        });
    } catch (e) { console.error("Expansion Error", e); }
}

/**
 * 6. CENTERED MATCH CENTER (Live Bonus & My Players)
 */
async function updateLiveScores() {
    const container = document.getElementById('fixtures-container');
    if (!container) return;
    clearTimeout(refreshTimer);

    try {
        const response = await fetch(`${FIXTURES_ENDPOINT}${state.currentGW}`);
        const fixtures = await response.json();
        const startedGames = fixtures.filter(f => f.started);
        
        if (startedGames.some(f => !f.finished)) {
            refreshTimer = setTimeout(updateLiveScores, 60000);
        }

        let html = '';
        const sortedGames = [...startedGames].sort((a, b) => new Date(b.kickoff_time) - new Date(a.kickoff_time));

        sortedGames.forEach(game => {
            const homeAbbr = teamLookup[game.team_h].substring(0, 3).toUpperCase();
            const awayAbbr = teamLookup[game.team_a].substring(0, 3).toUpperCase();
            
            const bpsData = game.stats.find(s => s.identifier === 'bps');
            let bonusListHtml = '';
            
            if (bpsData) {
                const top3 = [...bpsData.h, ...bpsData.a].sort((a, b) => b.value - a.value).slice(0, 3);
                const bonusValues = [3, 2, 1];

                top3.forEach((player, index) => {
                    const isMyPlayer = state.myPlayerIds.includes(player.element);
                    const playerName = state.playerMap[player.element]?.name || "Unknown";
                    
                    bonusListHtml += `
                        <div class="bonus-row ${isMyPlayer ? 'my-player-bonus' : ''}">
                            <span>
                                <span class="bonus-badge">${bonusValues[index]}pts</span> 
                                ${isMyPlayer ? '<span class="star-icon">★</span> ' : ''}${playerName}
                            </span>
                            <span class="bps-val">${player.value} BPS</span>
                        </div>`;
                });
            }

            html += `
                <div class="match-card">
                    <div class="match-scoreline">
                        <span class="team-name" style="text-align: right;">${homeAbbr}</span>
                        <span class="score-badge">${game.team_h_score} - ${game.team_a_score}</span>
                        <span class="team-name" style="text-align: left;">${awayAbbr}</span>
                    </div>
                    <div class="bonus-section">
                        <div class="bonus-title">Live Bonus</div>
                        ${bonusListHtml || '<div class="calculating">Calculating...</div>'}
                    </div>
                </div>`;
        });
        
        container.innerHTML = html || '<p class="no-games">No live games currently.</p>';
    } catch (err) { console.error("Match Center Error", err); }
}

/**
 * 7. NAVIGATION & UTILS
 */
function showView(view) {
    document.getElementById('table-view').style.display = view === 'table' ? 'block' : 'none';
    document.getElementById('pitch-view').style.display = view === 'pitch' ? 'block' : 'none';
    document.getElementById('tab-table').classList.toggle('active', view === 'table');
    document.getElementById('tab-pitch').classList.toggle('active', view === 'pitch');

    if (view === 'pitch') updateLiveScores();
    else clearTimeout(refreshTimer);
}

function toggleSettings() {
    const drawer = document.getElementById('settings-drawer');
    const overlay = document.getElementById('drawer-overlay');
    const isOpen = drawer.classList.toggle('open');
    overlay.style.display = isOpen ? 'block' : 'none';
}

function resetApp() {
    if(confirm("Logout and return to login screen?")) {
        localStorage.removeItem('kopala_fpl_id');
        location.reload();
    }
}