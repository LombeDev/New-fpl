/**
 * KOPALA FPL - MASTER CORE SCRIPT
 * Version: 3.0 (Live Match Center & High-Performance UI)
 */

const state = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    activeView: localStorage.getItem('kopala_active_view') || 'table',
    pitchPattern: localStorage.getItem('kopala_pitch_pattern') || 'p-vertical',
    playerMap: {}, 
    currentGW: 1,
    imageCache: JSON.parse(localStorage.getItem('kopala_img_cache')) || {}
};

// Endpoints
const PROXY_ENDPOINT = "/.netlify/functions/fpl-proxy?endpoint=";
const FOOTBALL_API_URL = "/api/competitions/PL/matches?limit=12"; // Uses your redirect

let selectedForComparison = [];
let cardObserver;

/**
 * 1. INITIALIZATION & CORE EVENTS
 */
document.addEventListener('DOMContentLoaded', async () => {
    // A. Setup lazy loading observer
    initIntersectionObserver();

    // B. Theme Check
    if (localStorage.getItem('theme') === 'dark') {
        document.body.classList.add('dark-mode');
    }

    // C. Initialize Pitch UI
    updatePitchUIState();

    // D. Load Global FPL & Live Match Data
    await initAppData();
    await fetchFootballMatches();

    // E. Handle Authentication Flow
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

    // F. Start 60s Refresh Cycle for Live Scores
    setInterval(fetchFootballMatches, 60000);
});

/**
 * 2. PERFORMANCE & UI OBSERVER
 */
function initIntersectionObserver() {
    cardObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('appeared');
                cardObserver.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1, rootMargin: "0px 0px -50px 0px" });
}

/**
 * 3. LIVE FOOTBALL MATCH CENTER
 */
async function fetchFootballMatches() {
    const container = document.getElementById('fixtures-container');
    if (!container) return;

    try {
        const response = await fetch(FOOTBALL_API_URL);
        const data = await response.json();
        
        container.innerHTML = ''; // Remove skeletons

        data.matches.forEach(match => {
            const isLive = match.status === 'IN_PLAY' || match.status === 'LIVE' || match.status === 'PAUSED';
            const homeScore = match.score.fullTime.home ?? '-';
            const awayScore = match.score.fullTime.away ?? '-';

            const matchCard = document.createElement('div');
            matchCard.className = 'fixture-card card-lazy';
            matchCard.innerHTML = `
                <div class="live-status-header">
                    ${isLive ? '<div class="status-badge"><span class="pulse-dot"></span> LIVE</div>' : `<span class="status-label">${match.status.replace('_', ' ')}</span>`}
                </div>
                <div class="fixture-content">
                    <div class="score-col">
                        <div class="team-unit">
                            <img src="${match.homeTeam.crest}" class="team-logo" alt="${match.homeTeam.name}">
                            <span class="team-abbr">${match.homeTeam.tla}</span>
                        </div>
                        <div class="score-box">${homeScore} : ${awayScore}</div>
                        <div class="team-unit">
                            <img src="${match.awayTeam.crest}" class="team-logo" alt="${match.awayTeam.name}">
                            <span class="team-abbr">${match.awayTeam.tla}</span>
                        </div>
                    </div>
                    <button class="expand-btn" onclick="toggleMatchDetails(this)">
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg>
                    </button>
                </div>
                <div class="details-drawer">
                    <div class="details-content">
                        <div class="detail-row"><span>Stadium</span> <strong>${match.venue || 'TBA'}</strong></div>
                        <div class="detail-row"><span>Matchday</span> <strong>GW ${match.matchday}</strong></div>
                        <div class="detail-row"><span>Kickoff</span> <strong>${new Date(match.utcDate).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</strong></div>
                    </div>
                </div>
            `;
            container.appendChild(matchCard);
            cardObserver.observe(matchCard);
        });
    } catch (error) {
        console.error("Match Center Error:", error);
    }
}

function toggleMatchDetails(btn) {
    const card = btn.closest('.fixture-card');
    const drawer = card.querySelector('.details-drawer');
    btn.classList.toggle('active');
    drawer.classList.toggle('open');
}

/**
 * 4. FPL DATA & MANAGER LOGIC
 */
async function initAppData() {
    try {
        const res = await fetch(`${PROXY_ENDPOINT}bootstrap-static/`);
        const data = await res.json();
        data.elements.forEach(p => {
            state.playerMap[p.id] = { name: p.web_name, code: p.code, pos: p.element_type };
        });
        const activeGW = data.events.find(e => e.is_current) || data.events.find(e => !e.finished);
        if (activeGW) state.currentGW = activeGW.id;
    } catch (e) { console.error("FPL Init Error", e); }
}

async function fetchManagerData() {
    try {
        const res = await fetch(`${PROXY_ENDPOINT}entry/${state.fplId}/`);
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
    } catch (e) { console.error("Manager Data Error", e); }
}

async function changeLeague(leagueId) {
    const body = document.getElementById('league-body');
    body.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:40px;">Syncing League...</td></tr>';
    try {
        const res = await fetch(`${PROXY_ENDPOINT}leagues-classic/${leagueId}/standings/`);
        const data = await res.json();
        const standings = data.standings.results;
        const allPicks = await batchFetchCaptains(standings);
        
        body.innerHTML = standings.map((r, index) => {
            const arrow = r.last_rank > r.rank ? '▲' : (r.last_rank < r.rank && r.last_rank !== 0 ? '▼' : '-');
            const arrowColor = r.last_rank > r.rank ? '#00ff85' : '#e90052';
            const capId = allPicks[index]?.picks?.find(p => p.is_captain)?.element;
            const captainName = state.playerMap[capId]?.name || "N/A";

            return `
                <tr id="row-${r.entry}" class="manager-row card-lazy">
                    <td onclick="toggleManagerExpansion(${r.entry})"><span style="color:${arrowColor}">${arrow}</span> ${r.rank}</td>
                    <td onclick="toggleManagerExpansion(${r.entry})">
                        <div class="manager-info-stack">
                            <div style="font-weight:800;">${r.entry_name}</div>
                            <div style="font-size:0.75rem; color:var(--text-muted);">${r.player_name}</div>
                            <div style="font-size:0.7rem; margin-top:4px; display:flex; align-items:center;">
                                <span style="background:var(--fpl-red); color:white; border-radius:50%; width:14px; height:14px; display:flex; align-items:center; justify-content:center; font-size:0.5rem; margin-right:4px; font-weight:bold;">C</span> 
                                <span style="font-weight:600;">${captainName}</span>
                            </div>
                        </div>
                    </td>
                    <td style="text-align:center;"><input type="checkbox" onchange="selectForCompare(${r.entry}, '${r.entry_name.replace(/'/g, "\\'")}')"></td>
                    <td style="text-align:center;">${allPicks[index]?.entry_history?.event_transfers_cost > 0 ? `<div style="color:#e90052; font-weight:900;">-${allPicks[index].entry_history.event_transfers_cost}</div>` : `0`}</td>
                    <td style="text-align:right;"><div style="font-weight:800; color:var(--fpl-red);">${r.event_total}</div><div style="font-size:0.75rem;">${r.total.toLocaleString()}</div></td>
                </tr>
            `;
        }).join('');
        
        document.querySelectorAll('.manager-row').forEach(row => cardObserver.observe(row));
    } catch (err) { console.error("League Error", err); }
}

/**
 * 5. UTILS & UI HELPERS
 */
async function batchFetchCaptains(standings) {
    let results = [];
    for (let i = 0; i < Math.min(standings.length, 10); i += 5) {
        const batch = standings.slice(i, i + 5);
        const batchRes = await Promise.all(batch.map(r => fetch(`${PROXY_ENDPOINT}entry/${r.entry}/event/${state.currentGW}/picks/`).then(res => res.json()).catch(() => null)));
        results = [...results, ...batchRes];
    }
    return results;
}

function getPlayerImageHtml(playerCode, className = "") {
    const playerKey = `p${playerCode}`;
    const primaryUrl = `https://resources.premierleague.com/premierleague/photos/players/110x140/${playerKey}.png`;
    return `
        <div class="img-container ${className} skeleton-loading">
            <img src="${primaryUrl}" loading="lazy" onload="this.parentElement.classList.remove('skeleton-loading')" onerror="this.remove()">
        </div>
    `;
}

function showView(view) {
    state.activeView = view;
    localStorage.setItem('kopala_active_view', view);
    document.getElementById('table-view').style.display = view === 'table' ? 'block' : 'none';
    document.getElementById('pitch-view').style.display = view === 'pitch' ? 'block' : 'none';
}

function updatePitchUIState() {
    document.querySelectorAll('.pitch-option').forEach(opt => {
        opt.classList.toggle('active', opt.classList.contains(state.pitchPattern));
    });
}

function handleLogin() {
    const input = document.getElementById('team-id-input');
    const teamId = input.value.trim();
    if (!teamId || isNaN(teamId)) return;
    localStorage.setItem('kopala_fpl_id', teamId);
    window.location.reload();
}

function resetApp() {
    localStorage.clear();
    window.location.reload();
}