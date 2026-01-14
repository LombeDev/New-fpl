/**
 * KOPALA FPL - PRO MATCH CENTER
 */

// 1. Global Variables & Fallbacks
const FPL_PROXY = 'https://corsproxy.io/?https://fantasy.premierleague.com/api/'; 
let refreshTimer;

// Global objects if they aren't already defined in script.js
if (typeof playerLookup === 'undefined') window.playerLookup = {};
if (typeof teamLookup === 'undefined') window.teamLookup = {};
if (typeof activeGameweek === 'undefined') window.activeGameweek = null;

// 2. Auto-Initialize (Fetches current Gameweek and Team Names)
async function initMatchCenter() {
    try {
        const res = await fetch(`${FPL_PROXY}bootstrap-static/`);
        const data = await res.json();
        
        // Find current Gameweek
        const currentEvent = data.events.find(e => e.is_current) || data.events.find(e => e.is_next);
        window.activeGameweek = currentEvent ? currentEvent.id : 1;

        // Map Team Names (e.g., 1 -> "Arsenal")
        data.teams.forEach(t => {
            teamLookup[t.id] = t.name;
        });

        // Map Player Names (e.g., 302 -> "Salah")
        data.elements.forEach(p => {
            playerLookup[p.id] = p.web_name;
        });

        console.log("Match Center Initialized: GW", activeGameweek);
        updateLiveScores(); // Start loading scores once data is ready
    } catch (err) {
        console.error("Initialization Error:", err);
    }
}

// 3. The Main Update Function
async function updateLiveScores() {
    const container = document.getElementById('fixtures-container');
    if (!container) return;

    // IF activeGameweek is still null, run init instead
    if (!activeGameweek) {
        initMatchCenter();
        return;
    }

    clearTimeout(refreshTimer);

    try {
        const response = await fetch(`${FPL_PROXY}fixtures/?event=${activeGameweek}&t=${Date.now()}`);
        const fixtures = await response.json();
        const startedGames = fixtures.filter(f => f.started);
        
        if (startedGames.some(f => !f.finished)) {
            refreshTimer = setTimeout(updateLiveScores, 60000);
        }

        let html = '';
        const sortedGames = [...startedGames].sort((a, b) => new Date(b.kickoff_time) - new Date(a.kickoff_time));

        sortedGames.forEach(game => {
            const goals = game.stats.find(s => s.identifier === 'goals_scored');
            const assists = game.stats.find(s => s.identifier === 'assists');
            let homeEvents = '', awayEvents = '';
            
            if (goals) {
                goals.h.forEach(s => homeEvents += `<div style="margin-bottom:3px; font-weight:700;">${playerLookup[s.element] || 'Player'} ⚽</div>`);
                goals.a.forEach(s => awayEvents += `<div style="margin-bottom:3px; font-weight:700;">⚽ ${playerLookup[s.element] || 'Player'}</div>`);
            }
            if (assists) {
                assists.h.forEach(s => homeEvents += `<div style="font-size:0.7rem; opacity:0.8;">${playerLookup[s.element] || 'Player'} <span class="assist-badge">A</span></div>`);
                assists.a.forEach(s => awayEvents += `<div style="font-size:0.7rem; opacity:0.8;"><span class="assist-badge">A</span> ${playerLookup[s.element] || 'Player'}</div>`);
            }

            const bpsStats = game.stats.find(s => s.identifier === 'bps');
            let bonusHtml = '';
            if (bpsStats) {
                const top = [...bpsStats.h, ...bpsStats.a].sort((a, b) => b.value - a.value).slice(0, 3);
                const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                
                bonusHtml = top.map((p, i) => `
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:10px;">
                        <span class="medal-icon" style="background:${medalColors[i]}">${3-i}</span>
                        <div style="display:flex; flex-direction:column;">
                            <span style="font-weight:800; font-size:0.85rem; line-height:1;">${playerLookup[p.element] || 'Player'}</span>
                            <span style="color:#e90052; font-weight:700; font-size:0.75rem;">${p.value}</span>
                        </div>
                    </div>`).join('');
            }

            html += `
                <div class="match-card-main">
                    <div style="flex: 2.2; padding: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
                            <span style="font-weight: 900; font-size: 1rem; color:#37003c;">${teamLookup[game.team_h] || 'Home'}</span>
                            <div class="score-box-center">${game.team_h_score} | ${game.team_a_score}</div>
                            <span style="font-weight: 900; font-size: 1rem; color:#37003c; text-align: right;">${teamLookup[game.team_a] || 'Away'}</span>
                        </div>
                        <div style="display: flex; gap: 10px;">
                            <div style="flex: 1; text-align: left; border-right: 1px solid #f0f0f0;">${homeEvents}</div>
                            <div style="flex: 1; text-align: right;">${awayEvents}</div>
                        </div>
                    </div>
                    <div class="bonus-column">
                        <div style="font-size: 0.65rem; font-weight: 900; color: #37003c; margin-bottom: 12px; display: flex; align-items: center; gap: 5px; opacity: 0.6;">
                             🏆 BONUS <span style="width: 5px; height: 5px; background: ${game.finished ? '#ccc' : '#ff005a'}; border-radius: 50%;"></span>
                        </div>
                        <div>${bonusHtml || '<span style="opacity:0.3; font-size:0.6rem;">Calculating...</span>'}</div>
                    </div>
                </div>`;
        });
        
        container.innerHTML = html || '<div style="text-align:center; padding:40px; opacity:0.5;">No matches live at the moment.</div>';
    } catch (err) {
        console.error("Sync Error:", err);
    }
}
