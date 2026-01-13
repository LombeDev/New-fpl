/**
 * KOPALA FPL - MASTER CORE SCRIPT
 * Features: PWA Install, Auth, League Table (Arrows + Captains), Live Match Center, and Pitch Expansion
 */

const state = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    playerMap: {}, 
    livePoints: {},
    currentGW: 1, 
    myPlayerIds: [] 
};

const PROXY_ENDPOINT = "/.netlify/functions/fpl-proxy?endpoint=";
const FIXTURES_ENDPOINT = "/.netlify/functions/fpl-proxy?endpoint=fixtures/?event=";

let refreshTimer = null;
let teamLookup = {}; 
let deferredPrompt; // For PWA Install

/**
 * 1. INITIALIZATION & PWA EVENT
 */
document.addEventListener('DOMContentLoaded', async () => {
    // Theme setup
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
        const toggle = document.getElementById('dark-mode-toggle');
        if (toggle) toggle.checked = true;
    }

    // PWA Install Prompt Logic
    window.addEventListener('beforeinstallprompt', (e) => {
        e.preventDefault();
        deferredPrompt = e;
        const installBtn = document.getElementById('install-app-btn');
        if (installBtn) installBtn.style.display = 'block';
    });

    await initAppData();

    if (state.fplId) {
        document.getElementById('team-id-input').value = state.fplId;
        handleLogin();
    }
});

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
                code: p.code
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
 * 4. LEAGUE STANDINGS (Rank Arrows + Stacked Captain)
 */
async function changeLeague(leagueId) {
    const body = document.getElementById('league-body');
    body.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px;">Loading Standings...</td></tr>';

    try {
        const res = await fetch(`${PROXY_ENDPOINT}leagues-classic/${leagueId}/standings/`);
        const data = await res.json();
        const standings = data.standings.results;

        // Parallel fetch for all captains
        const captainPromises = standings.map(r => 
            fetch(`${PROXY_ENDPOINT}entry/${r.entry}/event/${state.currentGW}/picks/`)
            .then(res => res.json())
            .catch(() => null)
        );

        const allPicks = await Promise.all(captainPromises);

        body.innerHTML = standings.map((r, index) => {
            // Rank Movement
            let arrow = '';
            if (r.last_rank > r.rank) {
                arrow = '<span style="color: #00ff85; margin-right: 4px;">▲</span>'; 
            } else if (r.last_rank < r.rank && r.last_rank !== 0) {
                arrow = '<span style="color: #e90052; margin-right: 4px;">▼</span>'; 
            } else {
                arrow = '<span style="color: #999; margin-right: 4px;">-</span>';
            }

            // Captain Logic
            const managerPicks = allPicks[index];
            let captainName = "N/A";
            if (managerPicks && managerPicks.picks) {
                const capId = managerPicks.picks.find(p => p.is_captain)?.element;
                captainName = state.playerMap[capId]?.name || "Unknown";
            }

            return `
                <tr id="row-${r.entry}" class="manager-row" onclick="toggleManagerExpansion(${r.entry})">
                    <td style="font-weight: bold; white-space: nowrap;">${arrow}${r.rank}</td>
                    <td>
                        <div style="font-weight: bold; color: #37003c; line-height: 1.2;">${r.entry_name}</div>
                        <div style="font-size: 0.75rem; color: #666;">${r.player_name}</div>
                        <div style="font-size: 0.7rem; margin-top: 4px; display: flex; align-items: center;">
                            <span style="background: #e90052; color: white; border-radius: 50%; width: 14px; height: 14px; display: flex; align-items: center; justify-content: center; font-size: 0.5rem; margin-right: 4px; font-weight: bold;">C</span>
                            <span style="color: #37003c; font-weight: 600;">${captainName}</span>
                        </div>
                    </td>
                    <td class="score-text" style="font-weight: 800; color: #37003c; text-align: center;">${r.event_total}</td>
                    <td style="font-weight: 600; text-align: right;">${r.total.toLocaleString()}</td>
                </tr>
            `;
        }).join('');
        
        initializeStats(leagueId, state.fplId);

    } catch (err) { 
        console.error("League Error", err); 
        body.innerHTML = "<tr><td colspan='4'>Error loading league data.</td></tr>";
    }
}

/**
 * 5. PITCH EXPANSION
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
                            ${multiplier > 1 ? (multiplier === 3 ? 'TC' : 'C') : ''} ${player.name}
                        </div>
                    </div>
                `;
            }
        });
    } catch (e) { console.error("Expansion Error", e); }
}

/**
 * 6. MATCH CENTER
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
            const homeAbbr = teamLookup[game.team_h]?.substring(0, 3).toUpperCase();
            const awayAbbr = teamLookup[game.team_a]?.substring(0, 3).toUpperCase();
            
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
 * 7. STATS HELPERS
 */
async function initializeStats(leagueId, myEntryId) {
    try {
        const res = await fetch(`${PROXY_ENDPOINT}leagues-classic/${leagueId}/standings/`);
        const data = await res.json();
        const standings = data.standings.results;

        const staticRes = await fetch(`${PROXY_ENDPOINT}bootstrap-static/`);
        const staticData = await staticRes.json();
        const leagueAvg = staticData.events.find(e => e.is_current)?.average_entry_score || 0;

        renderComparison(standings, myEntryId, leagueAvg);
        renderTopManagers(standings, state.currentGW);
        calculateAndRenderCaptains(standings, state.currentGW, state.playerMap);

    } catch (error) { console.error("Stats Error:", error); }
}

function renderComparison(standings, myEntryId, leagueAvg) {
    const myTeam = standings.find(m => m.entry == myEntryId) || standings[0];
    const container = document.getElementById('comparison-body');
    if (!container) return;
    
    container.innerHTML = `
        <tr style="color: #37003c; border-bottom: 1px solid #f9f9f9;">
            <td style="text-align: left; padding: 10px 0; color: #888;">League Avg</td>
            <td>${leagueAvg}</td>
            <td>-</td>
            <td>-</td>
        </tr>
        <tr style="color: #00ff85; background: #f0fff0;">
            <td style="text-align: left; padding: 10px 0; color: #37003c;">My Team</td>
            <td>${myTeam.event_total}</td>
            <td>${myTeam.rank_sort}</td> 
            <td>${myTeam.total.toLocaleString()}</td>
        </tr>
    `;
}

function renderTopManagers(standings, gw) {
    const sorted = [...standings].sort((a, b) => b.event_total - a.event_total).slice(0, 5);
    const container = document.getElementById('top-managers-body');
    if (!container) return;
    
    container.innerHTML = sorted.map(m => `
        <tr style="border-bottom: 1px solid #f4f4f4;">
            <td style="padding: 8px 0; color: #999; font-size: 0.7rem;">GW${gw}</td>
            <td style="padding: 8px 0; font-weight: 500;">${m.entry_name}</td>
            <td style="padding: 8px 0; text-align: right; color: #37003c; font-weight: 800;">${m.event_total}</td>
        </tr>
    `).join('');
}

async function calculateAndRenderCaptains(standings, gw, playerMap) {
    const captainCounts = {};
    const top15 = standings.slice(0, 15);
    const container = document.getElementById('captained-container');
    if (!container) return;

    const pickPromises = top15.map(m => 
        fetch(`${PROXY_ENDPOINT}entry/${m.entry}/event/${gw}/picks/`).then(r => r.json())
    );

    const results = await Promise.all(pickPromises);
    results.forEach(data => {
        const cap = data.picks?.find(p => p.is_captain);
        if (cap) captainCounts[cap.element] = (captainCounts[cap.element] || 0) + 1;
    });

    const sorted = Object.entries(captainCounts)
        .map(([id, count]) => ({ id, count, pct: Math.round((count / top15.length) * 100) }))
        .sort((a, b) => b.count - a.count).slice(0, 3);

    container.innerHTML = sorted.map((c, i) => `
        <div style="text-align: center; width: 30%;">
            <div style="position: relative; display: inline-block;">
                <img src="https://resources.premierleague.com/premierleague/photos/players/110x140/p${playerMap[c.id]?.code}.png" 
                     style="width: 60px; height: 60px; border-radius: 50%; border: 2px solid ${i==0?'#00ff85':'#37003c'}; background:#eee;">
                <div style="position: absolute; bottom: 0; right: 0; background: #e90052; color: white; border-radius: 50%; width: 18px; height: 18px; font-size: 0.6rem; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 1px solid white;">C</div>
            </div>
            <div style="font-weight: 800; font-size: 0.7rem; margin-top: 5px; color: #37003c;">${playerMap[c.id]?.name}</div>
            <div style="color: #e90052; font-weight: 800; font-size: 1.1rem;">${c.pct}%</div>
        </div>
    `).join('');
}

/**
 * 8. UTILS & NAVIGATION
 */
function showView(view) {
    document.getElementById('table-view').style.display = view === 'table' ? 'block' : 'none';
    document.getElementById('pitch-view').style.display = view === 'pitch' ? 'block' : 'none';
    document.getElementById('tab-table').classList.toggle('active', view === 'table');
    document.getElementById('tab-pitch').classList.toggle('active', view === 'pitch');

    if (view === 'pitch') updateLiveScores();
    else clearTimeout(refreshTimer);
}

function handleDarkModeToggle() {
    const isDark = document.body.classList.toggle('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
}

async function triggerInstall() {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
            document.getElementById('install-app-btn').style.display = 'none';
        }
        deferredPrompt = null;
    }
}

function resetApp() {
    if(confirm("Logout and return to login screen?")) {
        localStorage.removeItem('kopala_fpl_id');
        location.reload();
    }
}