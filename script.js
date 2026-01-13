/**
 * KOPALA FPL - MASTER CORE SCRIPT
 * Features: Persistent Views, PWA Install, League Table (Arrows + Captains), Live Match Center
 */

const state = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    activeView: localStorage.getItem('kopala_active_view') || 'table', // Persistent view
    playerMap: {}, 
    livePoints: {},
    currentGW: 1, 
    myPlayerIds: [] 
};

const PROXY_ENDPOINT = "/.netlify/functions/fpl-proxy?endpoint=";
const FIXTURES_ENDPOINT = "/.netlify/functions/fpl-proxy?endpoint=fixtures/?event=";

let refreshTimer = null;
let teamLookup = {}; 
let deferredPrompt; 

/**
 * 1. INITIALIZATION & PERSISTENCE
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

    // Check if user is already "Logged In"
    if (state.fplId) {
        // Hide login screen and show dashboard immediately
        document.getElementById('login-screen').style.display = 'none';
        document.getElementById('dashboard').style.display = 'block';
        
        // Restore their last view (Table or Pitch)
        showView(state.activeView);
        
        await fetchMySquad();
        await fetchManagerData();
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
    
    // Set default view on first login
    showView('table');
    
    await fetchMySquad();
    await fetchManagerData();
}

/**
 * 4. VIEW PERSISTENCE LOGIC
 */
function showView(view) {
    state.activeView = view;
    localStorage.setItem('kopala_active_view', view); // Save view to storage

    const tableView = document.getElementById('table-view');
    const pitchView = document.getElementById('pitch-view');
    const tabTable = document.getElementById('tab-table');
    const tabPitch = document.getElementById('tab-pitch');

    if (tableView) tableView.style.display = view === 'table' ? 'block' : 'none';
    if (pitchView) pitchView.style.display = view === 'pitch' ? 'block' : 'none';
    
    if (tabTable) tabTable.classList.toggle('active', view === 'table');
    if (tabPitch) tabPitch.classList.toggle('active', view === 'pitch');

    if (view === 'pitch') {
        updateLiveScores();
    } else {
        clearTimeout(refreshTimer);
    }
}

/**
 * 5. LEAGUE STANDINGS (Rank Arrows + Stacked Captain)
 */
async function changeLeague(leagueId) {
    const body = document.getElementById('league-body');
    if (!body) return;
    body.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:30px;">Loading Standings...</td></tr>';

    try {
        const res = await fetch(`${PROXY_ENDPOINT}leagues-classic/${leagueId}/standings/`);
        const data = await res.json();
        const standings = data.standings.results;

        const captainPromises = standings.map(r => 
            fetch(`${PROXY_ENDPOINT}entry/${r.entry}/event/${state.currentGW}/picks/`)
            .then(res => res.json())
            .catch(() => null)
        );

        const allPicks = await Promise.all(captainPromises);

        body.innerHTML = standings.map((r, index) => {
            let arrow = '';
            if (r.last_rank > r.rank) {
                arrow = '<span style="color: #00ff85; margin-right: 4px;">▲</span>'; 
            } else if (r.last_rank < r.rank && r.last_rank !== 0) {
                arrow = '<span style="color: #e90052; margin-right: 4px;">▼</span>'; 
            } else {
                arrow = '<span style="color: #999; margin-right: 4px;">-</span>';
            }

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
 * 6. SQUAD & DATA FETCHING
 */
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
 * (Sections for Pitch Expansion, Match Center, Stats remain the same but included in logic)
 */
// ... [Remaining functions: toggleManagerExpansion, updateLiveScores, initializeStats, etc. from previous response] ...

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
        localStorage.clear(); // Clears ID and View persistence
        location.reload();
    }
}