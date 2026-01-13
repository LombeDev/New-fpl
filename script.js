/**
 * KOPALA FPL - ULTIMATE INTEGRATED PRO DASHBOARD
 */

const state = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    playerMap: {}, 
    myPlayerIds: [],
    currentGW: 1,
    currentViewGW: 1, // For Upcoming Fixtures Navigation
    allEplMatches: []
};

// Endpoints
const FPL_PROXY = "/.netlify/functions/fpl-proxy?endpoint=";
const FIXTURES_ENDPOINT = "/.netlify/functions/fpl-proxy?endpoint=fixtures/?event=";
const EPL_DATA_PROXY = "/api/competitions/PL/"; // Football-Data.org Proxy

let teamLookup = {};
let refreshTimer = null;

const TEAM_SHORT_CODES = {
    "Manchester City FC": "MCI", "Manchester United FC": "MUN", "Arsenal FC": "ARS",
    "Liverpool FC": "LIV", "Chelsea FC": "CHE", "Tottenham Hotspur FC": "TOT",
    "Aston Villa FC": "AVL", "Newcastle United FC": "NEW", "Everton FC": "EVE",
    "Brighton & Hove Albion FC": "BHA", "West Ham United FC": "WHU", 
    "Crystal Palace FC": "CRY", "Wolverhampton Wanderers FC": "WOL",
    "Brentford FC": "BRE", "Fulham FC": "FUL", "Nottingham Forest FC": "NFO",
    "Leicester City FC": "LEI", "Southampton FC": "SOU", "Ipswich Town FC": "IPS"
};

/**
 * 1. INITIALIZATION
 */
document.addEventListener('DOMContentLoaded', async () => {
    await initAppData();
    await initUpcomingFixtures(); // Fetch Schedule
    
    if (state.fplId) {
        handleLogin();
    }
});

async function initAppData() {
    try {
        const res = await fetch(`${FPL_PROXY}bootstrap-static/`);
        const data = await res.json();
        
        data.elements.forEach(p => {
            state.playerMap[p.id] = { name: p.web_name, pos: p.element_type, code: p.code };
        });
        data.teams.forEach(t => teamLookup[t.id] = t.name);
        
        const active = data.events.find(e => e.is_current) || data.events.find(e => !e.finished);
        state.currentGW = active ? active.id : 1;
        state.currentViewGW = state.currentGW; // Sync upcoming view with current GW
    } catch (err) { console.error("FPL Init Error", err); }
}

/**
 * 2. LIVE MATCH CENTER (Centering + Bonus + My Players)
 */
async function updateLiveScores() {
    const container = document.getElementById('fixtures-container');
    if (!container) return;
    clearTimeout(refreshTimer);

    try {
        const res = await fetch(`${FIXTURES_ENDPOINT}${state.currentGW}`);
        const fixtures = await res.json();
        const startedGames = fixtures.filter(f => f.started);
        
        if (startedGames.some(f => !f.finished)) refreshTimer = setTimeout(updateLiveScores, 60000);

        let html = '';
        const sortedGames = [...startedGames].sort((a, b) => new Date(b.kickoff_time) - new Date(a.kickoff_time));

        sortedGames.forEach(game => {
            const homeAbbr = teamLookup[game.team_h].substring(0, 3).toUpperCase();
            const awayAbbr = teamLookup[game.team_a].substring(0, 3).toUpperCase();
            
            // Goals & Assists
            const goals = game.stats.find(s => s.identifier === 'goals_scored');
            const assists = game.stats.find(s => s.identifier === 'assists');
            let hEvents = '', aEvents = '';
            
            if (goals) {
                goals.h.forEach(s => hEvents += `<div>${state.playerMap[s.element]?.name} ⚽</div>`);
                goals.a.forEach(s => aEvents += `<div>⚽ ${state.playerMap[s.element]?.name}</div>`);
            }
            if (assists) {
                assists.h.forEach(s => hEvents += `<div style="opacity:0.4; font-size:0.55rem;">${state.playerMap[s.element]?.name} <span style="color:#ff005a">A</span></div>`);
                assists.a.forEach(s => aEvents += `<div style="opacity:0.4; font-size:0.55rem;"><span style="color:#ff005a">A</span> ${state.playerMap[s.element]?.name}</div>`);
            }

            // Bonus with My Player Star
            const bps = game.stats.find(s => s.identifier === 'bps');
            let bonusHtml = '';
            if (bps) {
                const top = [...bps.h, ...bps.a].sort((a, b) => b.value - a.value).slice(0, 3);
                const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                top.forEach((p, i) => {
                    const isMyPlayer = state.myPlayerIds.includes(p.element);
                    bonusHtml += `
                        <div class="bonus-row ${isMyPlayer ? 'my-player-bonus' : ''}" style="display:flex; align-items:center; gap:6px; margin-bottom:4px; font-size:0.65rem; justify-content:center;">
                            <span style="background:${colors[i]}; color:#000; width:13px; height:13px; display:flex; align-items:center; justify-content:center; border-radius:2px; font-weight:900; font-size:0.5rem;">${3-i}</span>
                            <span style="font-weight:700;">${isMyPlayer ? '★ ' : ''}${state.playerMap[p.element]?.name} <span style="opacity:0.3;">${p.value}</span></span>
                        </div>`;
                });
            }

            html += `
                <div class="match-card" style="padding:15px; border-bottom:1px solid #eee; text-align:center;">
                    <div class="match-scoreline" style="display:flex; justify-content:center; align-items:center; gap:15px; margin-bottom:10px;">
                        <span style="font-weight:900; width:50px; text-align:right;">${homeAbbr}</span>
                        <span style="background:#37003c; color:white; padding:4px 10px; border-radius:4px; font-family:monospace; font-weight:900;">${game.team_h_score} - ${game.team_a_score}</span>
                        <span style="font-weight:900; width:50px; text-align:left;">${awayAbbr}</span>
                    </div>
                    <div style="display:flex; justify-content:center; gap:20px; font-size:0.6rem; font-weight:600; margin-bottom:10px;">
                        <div style="text-align:right;">${hEvents}</div>
                        <div style="text-align:left;">${aEvents}</div>
                    </div>
                    <div class="bonus-section" style="border-top:1px dashed #eee; padding-top:10px;">
                        <div style="font-size:0.55rem; font-weight:900; opacity:0.5; margin-bottom:5px;">🏆 LIVE BONUS</div>
                        ${bonusHtml || '<span style="opacity:0.2;">Calculating...</span>'}
                    </div>
                </div>`;
        });
        
        container.innerHTML = html || '<p style="text-align:center; padding:20px; opacity:0.5;">No live games.</p>';
    } catch (err) { console.error("Live Score Error", err); }
}

/**
 * 3. UPCOMING FIXTURES NAVIGATION (Schedule)
 */
async function initUpcomingFixtures() {
    try {
        const start = new Date();
        start.setDate(start.getDate() - 7);
        const end = new Date();
        end.setDate(end.getDate() + 90);
        
        const res = await fetch(`${EPL_DATA_PROXY}matches?dateFrom=${start.toISOString().split('T')[0]}&dateTo=${end.toISOString().split('T')[0]}`);
        const data = await res.json();
        state.allEplMatches = data.matches || [];
        renderUpcoming();
    } catch (err) { console.error("Schedule Error", err); }
}

function changeGW(direction) {
    const newGW = state.currentViewGW + direction;
    if (newGW >= 1 && newGW <= 38) {
        state.currentViewGW = newGW;
        renderUpcoming();
    }
}

function renderUpcoming() {
    const container = document.getElementById('upcoming-list-container');
    const badge = document.getElementById('next-gw-badge');
    if (!container) return;

    if (badge) badge.innerText = `GW ${state.currentViewGW}`;

    const gwMatches = state.allEplMatches.filter(m => m.matchday === state.currentViewGW);

    if (gwMatches.length === 0) {
        container.innerHTML = `<p style="text-align:center; padding:20px; font-size:0.8rem; opacity:0.5;">No fixtures found.</p>`;
        return;
    }

    container.innerHTML = gwMatches.map(m => {
        const date = new Date(m.utcDate);
        const timeStr = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const dayStr = date.toLocaleDateString([], { weekday: 'short', day: 'numeric' });
        
        return `
            <div class="fixture-mini-row" style="display:flex; justify-content:space-between; align-items:center; padding:10px 0; border-bottom:1px solid #eee;">
                <div style="width:35%; text-align:right; font-weight:800; font-size:0.75rem;">
                    ${TEAM_SHORT_CODES[m.homeTeam.name] || m.homeTeam.tla} <img src="${m.homeTeam.crest}" style="width:16px; margin-left:5px; vertical-align:middle;">
                </div>
                <div style="width:30%; text-align:center; display:flex; flex-direction:column;">
                    <span style="font-size:0.55rem; font-weight:900; background:#eee; padding:1px 4px; border-radius:3px; margin:0 auto;">VS</span>
                    <span style="font-size:0.5rem; opacity:0.6; margin-top:2px;">${dayStr} ${timeStr}</span>
                </div>
                <div style="width:35%; text-align:left; font-weight:800; font-size:0.75rem;">
                    <img src="${m.awayTeam.crest}" style="width:16px; margin-right:5px; vertical-align:middle;"> ${TEAM_SHORT_CODES[m.awayTeam.name] || m.awayTeam.tla}
                </div>
            </div>
        `;
    }).join('');
}