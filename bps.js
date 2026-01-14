/**
 * KOPALA FPL - PRO MATCH CENTER (HIGH-FIDELITY VERSION)
 */

// 1. Global Configurations
const FPL_PROXY = 'https://corsproxy.io/?https://fantasy.premierleague.com/api/'; 
let refreshTimer;

// 2. The Main Function
async function updateLiveScores() {
    const container = document.getElementById('fixtures-container');
    if (!container) return;
    
    // Clear any existing timer to prevent memory leaks or double-loading
    clearTimeout(refreshTimer);

    try {
        const response = await fetch(`${FPL_PROXY}fixtures/?event=${activeGameweek}&t=${Date.now()}`);
        const fixtures = await response.json();
        const startedGames = fixtures.filter(f => f.started);
        
        // Auto-refresh every 60 seconds if games are still in progress
        if (startedGames.some(f => !f.finished)) {
            refreshTimer = setTimeout(updateLiveScores, 60000);
        }

        let html = '';
        const sortedGames = [...startedGames].sort((a, b) => new Date(b.kickoff_time) - new Date(a.kickoff_time));

        sortedGames.forEach(game => {
            // Goals & Assists Mapping
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

            // Bonus Point (BPS) Calculation with Medals
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

            // Build the card HTML
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
                        <div>
                            ${bonusHtml || '<span style="opacity:0.3; font-size:0.6rem;">Calculating...</span>'}
                        </div>
                    </div>
                </div>`;
        }); // End of sortedGames.forEach
        
        container.innerHTML = html || '<div style="text-align:center; padding:40px; opacity:0.5;">No matches live at the moment.</div>';
        
    } catch (err) {
        console.error("Match Center Sync Error:", err);
        container.innerHTML = '<div style="text-align:center; padding:20px; color:red;">Error loading live scores.</div>';
    }
}
