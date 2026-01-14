/**
 * KOPALA FPL - PRO MATCH CENTER (NETLIFY VERSION)
 */

// 1. Point to your new Netlify Rewrite path
const FPL_PROXY = '/fpl-api/'; 
let refreshTimer;

// Global fallbacks to prevent "Undefined" errors
if (typeof playerLookup === 'undefined') window.playerLookup = {};
if (typeof teamLookup === 'undefined') window.teamLookup = {};
if (typeof activeGameweek === 'undefined') window.activeGameweek = null;

// 2. Initializer: Fetches GW and Player Names if not already present
async function initMatchCenter() {
    try {
        const response = await fetch(`${FPL_PROXY}bootstrap-static/`);
        if (!response.ok) throw new Error("API Blocked");
        
        const data = await response.json();
        
        // Find active gameweek
        const currentEvent = data.events.find(e => e.is_current) || data.events.find(e => e.is_next);
        window.activeGameweek = currentEvent ? currentEvent.id : 1;

        // Map data for names
        data.teams.forEach(t => { teamLookup[t.id] = t.short_name; });
        data.elements.forEach(p => { playerLookup[p.id] = p.web_name; });

        updateLiveScores(); 
    } catch (err) {
        console.error("Init Error:", err);
        document.getElementById('fixtures-container').innerHTML = 
            `<div style="text-align:center; padding:20px; opacity:0.6;">⚠️ Error connecting to FPL.</div>`;
    }
}

// 3. The Live Engine
async function updateLiveScores() {
    const container = document.getElementById('fixtures-container');
    if (!container) return;

    if (!activeGameweek) {
        initMatchCenter();
        return;
    }

    clearTimeout(refreshTimer);

    try {
        const response = await fetch(`${FPL_PROXY}fixtures/?event=${activeGameweek}&t=${Date.now()}`);
        const fixtures = await response.json();
        const startedGames = fixtures.filter(f => f.started);
        
        // Auto-refresh every 60s if games are live
        if (startedGames.some(f => !f.finished)) {
            refreshTimer = setTimeout(updateLiveScores, 60000);
        }

        let html = '';
        const sortedGames = [...startedGames].sort((a, b) => new Date(b.kickoff_time) - new Date(a.kickoff_time));

        sortedGames.forEach(game => {
            // Stats Mapping
            const goals = game.stats.find(s => s.identifier === 'goals_scored');
            const assists = game.stats.find(s => s.identifier === 'assists');
            let homeEvents = '', awayEvents = '';
            
            if (goals) {
                goals.h.forEach(s => homeEvents += `<div style="font-weight:700;">${playerLookup[s.element]} ⚽</div>`);
                goals.a.forEach(s => awayEvents += `<div style="font-weight:700;">⚽ ${playerLookup[s.element]}</div>`);
            }
            if (assists) {
                assists.h.forEach(s => homeEvents += `<div style="font-size:0.7rem; opacity:0.7;">${playerLookup[s.element]} (A)</div>`);
                assists.a.forEach(s => awayEvents += `<div style="font-size:0.7rem; opacity:0.7;">(A) ${playerLookup[s.element]}</div>`);
            }

            // BPS Calculation
            const bpsStats = game.stats.find(s => s.identifier === 'bps');
            let bonusHtml = '';
            if (bpsStats) {
                const top = [...bpsStats.h, ...bpsStats.a].sort((a, b) => b.value - a.value).slice(0, 3);
                const colors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                bonusHtml = top.map((p, i) => `
                    <div style="display:flex; align-items:center; gap:5px; margin-bottom:5px;">
                        <span style="background:${colors[i]}; border-radius:50%; width:15px; height:15px; font-size:10px; text-align:center; color:#000;">${3-i}</span>
                        <span style="font-weight:600; font-size:0.8rem;">${playerLookup[p.element]} (${p.value})</span>
                    </div>`).join('');
            }

            html += `
                <div class="match-card-main" style="display:flex; border-bottom:1px solid #eee; background:#fff; margin-bottom:10px; border-radius:8px; overflow:hidden; box-shadow: 0 2px 4px rgba(0,0,0,0.05);">
                    <div style="flex:2; padding:15px; border-right:1px solid #f9f9f9;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                            <span style="font-weight:800;">${teamLookup[game.team_h]}</span>
                            <span style="background:#37003c; color:#fff; padding:2px 8px; border-radius:4px; font-weight:900;">${game.team_h_score} - ${game.team_a_score}</span>
                            <span style="font-weight:800;">${teamLookup[game.team_a]}</span>
                        </div>
                        <div style="display:flex; font-size:0.8rem;">
                            <div style="flex:1;">${homeEvents}</div>
                            <div style="flex:1; text-align:right;">${awayEvents}</div>
                        </div>
                    </div>
                    <div style="flex:1; padding:10px; background:#fcfcfc;">
                        <div style="font-size:0.6rem; font-weight:900; margin-bottom:5px; color:#e90052;">LIVE BONUS</div>
                        ${bonusHtml || '<span style="font-size:0.7rem; opacity:0.5;">Calculating...</span>'}
                    </div>
                </div>`;
        });

        container.innerHTML = html || '<div style="text-align:center; padding:40px; opacity:0.5;">Waiting for matches to start...</div>';
    } catch (err) {
        console.error("Match Center Sync Error:", err);
    }
}
