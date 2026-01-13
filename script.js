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



/**
 * FPL Stats Controller
 */
const FPL_BASE_URL = "https://fantasy.premierleague.com/api";

async function initializeStats(leagueId, myEntryId) {
    try {
        // 1. Fetch Static Data (Player names, photos, and current Gameweek)
        const staticRes = await fetch(`${FPL_BASE_URL}/bootstrap-static/`);
        const staticData = await staticRes.json();
        
        const currentGW = staticData.events.find(e => e.is_current).id;
        const leagueAvg = staticData.events.find(e => e.is_current).average_entry_score;

        // Create Player Map for quick lookup
        const playerMap = {};
        staticData.elements.forEach(p => {
            playerMap[p.id] = { web_name: p.web_name, code: p.code };
        });

        // 2. Fetch League Standings
        const leagueRes = await fetch(`${FPL_BASE_URL}/leagues-classic/${leagueId}/standings/`);
        const leagueData = await leagueRes.json();
        const standings = leagueData.standings.results;

        // 3. Update UI: Comparison & Top Managers
        renderComparison(standings, myEntryId, leagueAvg);
        renderTopManagers(standings, currentGW);

        // 4. Update UI: Captaincy (This requires fetching individual picks)
        calculateAndRenderCaptains(standings, currentGW, playerMap);

    } catch (error) {
        console.error("Error loading league stats:", error);
    }
}

/**
 * Renders the comparison between League Average and My Team
 */
function renderComparison(standings, myEntryId, leagueAvg) {
    const myTeam = standings.find(m => m.entry === myEntryId) || standings[0];
    const container = document.getElementById('comparison-body');
    
    container.innerHTML = `
        <tr style="color: #37003c; border-bottom: 1px solid #eee;">
            <td style="text-align: left; padding: 10px; color: #666;">League Avg</td>
            <td>${leagueAvg}</td>
            <td>-</td>
            <td>-</td>
        </tr>
        <tr style="color: #00ff85; background: #f9f9f9;">
            <td style="text-align: left; padding: 10px; color: #666;">My Team</td>
            <td>${myTeam.event_total}</td>
            <td>${myTeam.rank_sort}</td>
            <td>${myTeam.total}</td>
        </tr>
    `;
}

/**
 * Renders the Top Scoring Managers for the week
 */
function renderTopManagers(standings, gw) {
    const sorted = [...standings].sort((a, b) => b.event_total - a.event_total).slice(0, 5);
    const container = document.getElementById('top-managers-body');
    
    container.innerHTML = sorted.map(m => `
        <tr style="border-bottom: 1px solid #f0f0f0;">
            <td style="padding: 12px; color: #999;">GW${gw}</td>
            <td style="padding: 12px; font-weight: 500;">${m.player_name}</td>
            <td style="padding: 12px; text-align: right; color: #37003c; font-weight: 800;">${m.event_total}</td>
        </tr>
    `).join('');
}

/**
 * Calculates most captained players and renders cards
 */
async function calculateAndRenderCaptains(standings, gw, playerMap) {
    const captainCounts = {};
    const topManagers = standings.slice(0, 15); // Limiting to top 15 to avoid API rate limits

    const pickPromises = topManagers.map(m => 
        fetch(`${FPL_BASE_URL}/entry/${m.entry}/event/${gw}/picks/`).then(r => r.json())
    );

    const results = await Promise.all(pickPromises);

    results.forEach(data => {
        const cap = data.picks.find(p => p.is_captain);
        if (cap) {
            captainCounts[cap.element] = (captainCounts[cap.element] || 0) + 1;
        }
    });

    const sortedCaps = Object.entries(captainCounts)
        .map(([id, count]) => ({ id, count, pct: Math.round((count / topManagers.length) * 100) }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 3);

    const container = document.getElementById('captained-container');
    container.innerHTML = sortedCaps.map(c => `
        <div style="text-align: center; width: 30%;">
            <img src="https://resources.premierleague.com/premierleague/photos/players/110x140/p${playerMap[c.id].code}.png" 
                 style="width: 55px; height: 55px; border-radius: 50%; object-fit: cover; border: 2px solid #37003c; background: #eee;">
            <div style="font-weight: 800; font-size: 0.7rem; margin-top: 5px;">${playerMap[c.id].web_name}</div>
            <div style="color: #e90052; font-weight: 800; font-size: 1.1rem;">${c.count}</div>
            <div style="font-size: 0.6rem; color: #666; font-weight: bold;">${c.pct}%</div>
        </div>
    `).join('');
}

function resetApp() {
    if(confirm("Logout and return to login screen?")) {
        localStorage.removeItem('kopala_fpl_id');
        location.reload();
    }
}


/**
 * Main function to load all league-specific statistics
 */
async function initializeStats(leagueId, myEntryId) {
    try {
        // 1. Fetch League Standings
        const res = await fetch(`${PROXY_ENDPOINT}leagues-classic/${leagueId}/standings/`);
        const data = await res.json();
        const standings = data.standings.results;

        // 2. Load Global/Average Stats from bootstrap (static data)
        const staticRes = await fetch(`${PROXY_ENDPOINT}bootstrap-static/`);
        const staticData = await staticRes.json();
        const currentGW = staticData.events.find(e => e.is_current).id;
        const leagueAvg = staticData.events.find(e => e.is_current).average_entry_score;

        // Populate Rival Dropdown
        const rivalSelect = document.getElementById('rival-select');
        rivalSelect.innerHTML = '<option>Select Rival...</option>' + 
            standings.filter(m => m.entry != myEntryId)
            .map(m => `<option value="${m.entry}">${m.entry_name}</option>`).join('');

        // 3. Render Sections
        renderComparison(standings, myEntryId, leagueAvg);
        renderTopManagers(standings, currentGW);
        calculateAndRenderCaptains(standings, currentGW, state.playerMap);

    } catch (error) {
        console.error("Stats Error:", error);
    }
}

/**
 * Table Comparison: Me vs Average
 */
function renderComparison(standings, myEntryId, leagueAvg) {
    const myTeam = standings.find(m => m.entry == myEntryId) || standings[0];
    const container = document.getElementById('comparison-body');
    
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
            <td>${myTeam.rank_sort}</td> <td>${myTeam.total.toLocaleString()}</td>
        </tr>
    `;
}

/**
 * Top 5 Managers list for the current GW
 */
function renderTopManagers(standings, gw) {
    const sorted = [...standings].sort((a, b) => b.event_total - a.event_total).slice(0, 5);
    const container = document.getElementById('top-managers-body');
    
    container.innerHTML = sorted.map(m => `
        <tr style="border-bottom: 1px solid #f4f4f4;">
            <td style="padding: 8px 0; color: #999; font-size: 0.7rem;">GW${gw}</td>
            <td style="padding: 8px 0; font-weight: 500;">${m.entry_name}</td>
            <td style="padding: 8px 0; text-align: right; color: #37003c; font-weight: 800;">${m.event_total}</td>
        </tr>
    `).join('');
}

/**
 * Captaincy UI Cards
 */
async function calculateAndRenderCaptains(standings, gw, playerMap) {
    const captainCounts = {};
    const top15 = standings.slice(0, 15);

    const pickPromises = top15.map(m => 
        fetch(`${PROXY_ENDPOINT}entry/${m.entry}/event/${gw}/picks/`).then(r => r.json())
    );

    const results = await Promise.all(pickPromises);
    results.forEach(data => {
        const cap = data.picks.find(p => p.is_captain);
        if (cap) captainCounts[cap.element] = (captainCounts[cap.element] || 0) + 1;
    });

    const sorted = Object.entries(captainCounts)
        .map(([id, count]) => ({ id, count, pct: Math.round((count / top15.length) * 100) }))
        .sort((a, b) => b.count - a.count).slice(0, 3);

    document.getElementById('captained-container').innerHTML = sorted.map((c, i) => `
        <div style="text-align: center; width: 30%;">
            <div style="position: relative; display: inline-block;">
                <img src="https://resources.premierleague.com/premierleague/photos/players/110x140/p${playerMap[c.id].code}.png" 
                     style="width: 60px; height: 60px; border-radius: 50%; border: 2px solid ${i==0?'#00ff85':'#37003c'}; background:#eee;">
                <div style="position: absolute; bottom: 0; right: 0; background: #e90052; color: white; border-radius: 50%; width: 18px; height: 18px; font-size: 0.6rem; display: flex; align-items: center; justify-content: center; font-weight: bold; border: 1px solid white;">C</div>
            </div>
            <div style="font-weight: 800; font-size: 0.7rem; margin-top: 5px; color: #37003c;">${playerMap[c.id].name}</div>
            <div style="color: #e90052; font-weight: 800; font-size: 1.1rem;">${c.pct}%</div>
        </div>
    `).join('');
}

/**
 * Rival Analysis Master Trigger
 */
async function runRivalAnalysis() {
    const rivalId = document.getElementById('rival-select').value;
    if (!rivalId || isNaN(rivalId)) return;

    const chartContainer = document.getElementById('rival-chart-container');
    const chipContainer = document.getElementById('rival-chips-hits');
    const transContainer = document.getElementById('transfer-log-container');

    try {
        const [hisRes, transRes, meRes] = await Promise.all([
            fetch(`${PROXY_ENDPOINT}entry/${rivalId}/history/`),
            fetch(`${PROXY_ENDPOINT}entry/${rivalId}/transfers/`),
            fetch(`${PROXY_ENDPOINT}entry/${state.fplId}/history/`)
        ]);

        const his = await hisRes.json();
        const trans = await transRes.json();
        const me = await meRes.json();

        // 1. Hits & Chips
        const currentGWData = his.current.find(h => h.event === state.currentGW);
        const hitCost = currentGWData ? currentGWData.event_transfers_cost : 0;
        
        chipContainer.innerHTML = `
            <div style="display:flex; gap:5px; flex-wrap:wrap;">
                ${his.chips.map(c => `<span style="background:#37003c; color:white; font-size:0.6rem; padding:2px 6px; border-radius:10px; font-weight:bold;">${c.name.toUpperCase()} GW${c.event}</span>`).join('')}
            </div>
            ${hitCost > 0 ? `<div style="color:#ff005a; font-weight:800; font-size:0.7rem;">⚠️ TOOK -${hitCost} HIT THIS GW</div>` : ''}
        `;

        // 2. Chart Bars
        const history = me.current.slice(-5).reverse();
        chartContainer.innerHTML = history.map(gw => {
            const rivalGw = his.current.find(t => t.event === gw.event);
            const diff = gw.total_points - (rivalGw?.total_points || 0);
            const barWidth = Math.min(Math.abs(diff), 150);
            return `
                <div style="display:flex; align-items:center; font-size:0.7rem;">
                    <span style="width:35px; font-weight:bold;">GW${gw.event}</span>
                    <div style="height:12px; background:${diff>=0?'#00ff85':'#ff005a'}; width:${barWidth}px; border-radius:2px;"></div>
                    <span style="margin-left:8px; font-weight:bold; color:${diff>=0?'#00ff85':'#ff005a'}">${diff > 0 ? '+' : ''}${diff}</span>
                </div>
            `;
        }).join('');

        // 3. Transfers
        transContainer.innerHTML = trans.slice(0, 3).map(t => `
            <div style="display:flex; justify-content:space-between; font-size:0.7rem; background:#f9f9f9; padding:5px; border-radius:4px;">
                <span style="color:#00ff85; font-weight:bold;">IN: ${state.playerMap[t.element_in]?.name}</span>
                <span style="color:#e90052; font-weight:bold;">OUT: ${state.playerMap[t.element_out]?.name}</span>
            </div>
        `).join('');

    } catch (e) { console.error(e); }
}



/**
 * Main function to populate the Stats View
 * @param {Array} leagueEntries - Array of manager objects from the FPL API
 */
function populateStatsView(leagueEntries) {
    // 1. Calculate League Average for the Summary Table
    const totalGWScore = leagueEntries.reduce((sum, m) => sum + (m.event_total || 0), 0);
    const avgGWScore = Math.round(totalGWScore / leagueEntries.length);
    
    const comparisonBody = document.getElementById('comparison-body');
    if (comparisonBody) {
        comparisonBody.innerHTML = `
            <tr>
                <td style="text-align: left;">League Avg</td>
                <td>${avgGWScore}</td>
                <td>-0</td> <td>-</td> 
            </tr>
        `;
    }

    // 2. Populate the Top Managers Table (Top 5 this GW)
    const topManagersBody = document.getElementById('top-managers-body');
    const sortedThisGW = [...leagueEntries].sort((a, b) => b.event_total - a.event_total).slice(0, 5);
    
    if (topManagersBody) {
        topManagersBody.innerHTML = sortedThisGW.map(m => `
            <tr style="border-bottom: 1px solid #eee;">
                <td style="padding: 8px 0; text-align: left;">${m.player_name}</td>
                <td style="text-align: right; font-weight: bold; color: #00ff85;">${m.event_total} pts</td>
            </tr>
        `).join('');
    }

    // 3. Populate Rival Select Dropdown
    const rivalSelect = document.getElementById('rival-select');
    if (rivalSelect) {
        rivalSelect.innerHTML = '<option>Select Rival...</option>' + 
            leagueEntries.map(m => `<option value="${m.entry}">${m.entry_name}</option>`).join('');
    }
}



let deferredPrompt;
const installBtn = document.getElementById('installBtn');

// 1. Listen for the browser's install prompt event
window.addEventListener('beforeinstallprompt', (e) => {
  // Prevent the mini-infobar from appearing on mobile
  e.preventDefault();
  // Stash the event so it can be triggered later.
  deferredPrompt = e;
  // Update UI notify the user they can install the PWA
  installBtn.style.display = 'block';

  console.log("'beforeinstallprompt' event was fired.");
});

// 2. Handle the click event on your custom button
installBtn.addEventListener('click', async () => {
  if (deferredPrompt) {
    // Show the install prompt
    deferredPrompt.prompt();
    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    // We've used the prompt, and can't use it again, throw it away
    deferredPrompt = null;
    // Hide the button again
    installBtn.style.display = 'none';
  }
});

// 3. (Optional) Clear the button if the app is successfully installed
window.addEventListener('appinstalled', () => {
  console.log('PWA was installed');
  installBtn.style.display = 'none';
});