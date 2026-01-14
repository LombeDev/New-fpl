/**
 * KOPALA FPL - PRO MATCH CENTER (NETLIFY VERSION)
 */

// 1. Point to your local Netlify path
const FPL_PROXY = '/fpl-api/'; 
let refreshTimer;

// Global fallbacks (shared with script.js)
if (typeof playerLookup === 'undefined') window.playerLookup = {};
if (typeof teamLookup === 'undefined') window.teamLookup = {};
if (typeof activeGameweek === 'undefined') window.activeGameweek = null;

/**
 * INITIALIZER
 * Fetches names and gameweek data if script.js hasn't loaded them yet.
 */
async function initMatchCenter() {
    try {
        const response = await fetch(`${FPL_PROXY}bootstrap-static/`);
        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
        
        const data = await response.json();
        
        // Find current Gameweek
        const currentEvent = data.events.find(e => e.is_current) || data.events.find(e => e.is_next);
        window.activeGameweek = currentEvent ? currentEvent.id : 1;

        // Map Team & Player Names
        data.teams.forEach(t => { teamLookup[t.id] = t.name; });
        data.elements.forEach(p => { playerLookup[p.id] = p.web_name; });

        console.log("Match Center Initialized: GW", activeGameweek);
        updateLiveScores(); 
    } catch (err) {
        console.error("Initialization Error:", err);
        const container = document.getElementById('fixtures-container');
        if (container) {
            container.innerHTML = `<div style="text-align:center; padding:20px; color:#ff4d4d; font-size:0.8rem;">
                ⚠️ FPL Connection Error. Check if netlify.toml is deployed.
            </div>`;
        }
    }
}

/**
 * LIVE ENGINE
 * Fetches real-time scores and BPS.
 */
async function updateLiveScores() {
    const container = document.getElementById('fixtures-container');
    if (!container) return;

    // Safety: If no GW is loaded, initialize first
    if (!activeGameweek) {
        initMatchCenter();
        return;
    }

    clearTimeout(refreshTimer);

    try {
        const response = await fetch(`${FPL_PROXY}fixtures/?event=${activeGameweek}&t=${Date.now()}`);
        if (!response.ok) throw new Error("Fixtures Blocked");

        const fixtures = await response.json();
        const startedGames = fixtures.filter(f => f.started);
        
        // Auto-refresh every 60s if any game is not finished
        if (startedGames.some(f => !f.finished)) {
            refreshTimer = setTimeout(updateLiveScores, 60000);
        }

        let html = '';
        const sortedGames = [...startedGames].sort((a, b) => new Date(b.kickoff_time) - new Date(a.kickoff_time));

        sortedGames.forEach(game => {
            // Mapping Goals & Assists
            const goals = game.stats.find(s => s.identifier === 'goals_scored');
            const assists = game.stats.find(s => s.identifier === 'assists');
            let hEv = '', aEv = '';
            
            if (goals) {
                goals.h.forEach(s => hEv += `<div style="font-weight:700;">${playerLookup[s.element] || 'Player'} ⚽</div>`);
                goals.a.forEach(s => aEv += `<div style="font-weight:700;">⚽ ${playerLookup[s.element] || 'Player'}</div>`);
            }
            if (assists) {
                assists.h.forEach(s => hEv += `<div style="font-size:0.7rem; opacity:0.7;">${playerLookup[s.element] || 'Player'} <span class="assist-badge">A</span></div>`);
                assists.a.forEach(s => aEv += `<div style="font-size:0.7rem; opacity:0.7;"><span class="assist-badge">A</span> ${playerLookup[s.element] || 'Player'}</div>`);
            }

            // BPS Calculation with Medals
            const bpsStats = game.stats.find(s => s.identifier === 'bps');
            let bonusHtml = '';
            if (bpsStats) {
                const top = [...bpsStats.h, ...bpsStats.a].sort((a, b) => b.value - a.value).slice(0, 3);
                const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                
                bonusHtml = top.map((p, i) => `
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                        <span class="medal-icon" style="background:${medalColors[i]}">${3-i}</span>
                        <div style="display:flex; flex-direction:column;">
                            <span style="font-weight:800; font-size:0.85rem; line-height:1.1;">${playerLookup[p.element] || 'Player'}</span>
                            <span style="color:#e90052; font-weight:700; font-size:0.75rem;">${p.value}</span>
                        </div>
                    </div>`).join('');
            }

            // Construct Card
            html += `
                <div class="match-card-main" style="display:flex; background:#fff; margin-bottom:12px; border-radius:10px; border:1px solid #eee; overflow:hidden; box-shadow:0 2px 5px rgba(0,0,0,0.05);">
                    <div style="flex: 2.2; padding: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <span style="font-weight: 900; font-size: 0.95rem; color:#37003c;">${teamLookup[game.team_h] || 'Home'}</span>
                            <div class="score-box-center" style="background:#37003c; color:#fff; padding:3px 10px; border-radius:4px; font-weight:900;">${game.team_h_score} - ${game.team_a_score}</div>
                            <span style="font-weight: 900; font-size: 0.95rem; color:#37003c; text-align:right;">${teamLookup[game.team_a] || 'Away'}</span>
                        </div>
                        <div style="display: flex; gap: 8px; font-size:0.75rem;">
                            <div style="flex: 1; text-align: left; border-right: 1px solid #f0f0f0; padding-right:5px;">${hEv}</div>
                            <div style="flex: 1; text-align: right; padding-left:5px;">${aEv}</div>
                        </div>
                    </div>
                    <div class="bonus-column" style="flex: 1; padding: 12px; background: #fafafa; border-left: 1px solid #eee;">
                        <div style="font-size: 0.6rem; font-weight: 900; color: #37003c; margin-bottom: 8px; opacity: 0.6;">🏆 LIVE BONUS</div>
                        ${bonusHtml || '<span style="opacity:0.3; font-size:0.65rem;">Calculating...</span>'}
                    </div>
                </div>`;
        });
        
        container.innerHTML = html || '<div style="text-align:center; padding:40px; opacity:0.5;">No games started yet today.</div>';
    } catch (err) {
        console.error("Match Center Sync Error:", err);
    }
}
