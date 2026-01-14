/**
 * KOPALA FPL - PRO MATCH CENTER (FUNCTION PROXY VERSION)
 */

const FPL_PROXY = '/.netlify/functions/fpl-proxy/'; 
let refreshTimer;

if (typeof playerLookup === 'undefined') window.playerLookup = {};
if (typeof teamLookup === 'undefined') window.teamLookup = {};
if (typeof activeGameweek === 'undefined') window.activeGameweek = null;

async function initMatchCenter() {
    try {
        const response = await fetch(`${FPL_PROXY}bootstrap-static/`);
        if (!response.ok) throw new Error(`HTTP Error ${response.status}`);
        
        const data = await response.json();
        const currentEvent = data.events.find(e => e.is_current) || data.events.find(e => e.is_next);
        window.activeGameweek = currentEvent ? currentEvent.id : 1;

        data.teams.forEach(t => { teamLookup[t.id] = t.name; });
        data.elements.forEach(p => { playerLookup[p.id] = p.web_name; });

        updateLiveScores(); 
    } catch (err) {
        console.error("Init Error:", err);
        document.getElementById('fixtures-container').innerHTML = 
            `<div style="text-align:center; padding:20px; color:#ff4d4d;">⚠️ Connection blocked. Try redeploying.</div>`;
    }
}

async function updateLiveScores() {
    const container = document.getElementById('fixtures-container');
    if (!container) return;
    if (!activeGameweek) { initMatchCenter(); return; }

    clearTimeout(refreshTimer);

    try {
        const response = await fetch(`${FPL_PROXY}fixtures/?event=${activeGameweek}&t=${Date.now()}`);
        if (!response.ok) throw new Error("Fixtures Blocked");

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
            let hEv = '', aEv = '';
            
            if (goals) {
                goals.h.forEach(s => hEv += `<div>${playerLookup[s.element] || 'Player'} ⚽</div>`);
                goals.a.forEach(s => aEv += `<div>⚽ ${playerLookup[s.element] || 'Player'}</div>`);
            }
            if (assists) {
                assists.h.forEach(s => hEv += `<div style="opacity:0.7;">${playerLookup[s.element] || 'Player'} (A)</div>`);
                assists.a.forEach(s => aEv += `<div style="opacity:0.7;">(A) ${playerLookup[s.element] || 'Player'}</div>`);
            }

            const bpsStats = game.stats.find(s => s.identifier === 'bps');
            let bonusHtml = '';
            if (bpsStats) {
                const top = [...bpsStats.h, ...bpsStats.a].sort((a, b) => b.value - a.value).slice(0, 3);
                const medalColors = ['#FFD700', '#C0C0C0', '#CD7F32'];
                bonusHtml = top.map((p, i) => `
                    <div style="display:flex; align-items:center; gap:8px; margin-bottom:8px;">
                        <span style="background:${medalColors[i]}; border-radius:50%; width:18px; height:18px; display:inline-block; text-align:center; font-size:10px; line-height:18px; color:#000; font-weight:900;">${3-i}</span>
                        <div>
                            <div style="font-weight:800; font-size:0.8rem;">${playerLookup[p.element] || 'Player'}</div>
                            <div style="color:#e90052; font-weight:700; font-size:0.7rem;">${p.value}</div>
                        </div>
                    </div>`).join('');
            }

            html += `
                <div style="display:flex; background:#fff; margin-bottom:15px; border-radius:12px; border:1px solid #eee; overflow:hidden; box-shadow:0 4px 6px rgba(0,0,0,0.05);">
                    <div style="flex: 2; padding: 15px;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                            <span style="font-weight: 900; color:#37003c;">${teamLookup[game.team_h] || 'Home'}</span>
                            <div style="background:#37003c; color:#fff; padding:4px 12px; border-radius:6px; font-weight:900;">${game.team_h_score} - ${game.team_a_score}</div>
                            <span style="font-weight: 900; color:#37003c;">${teamLookup[game.team_a] || 'Away'}</span>
                        </div>
                        <div style="display: flex; gap: 10px; font-size:0.75rem;">
                            <div style="flex: 1; border-right: 1px solid #f5f5f5;">${hEv}</div>
                            <div style="flex: 1; text-align: right;">${aEv}</div>
                        </div>
                    </div>
                    <div style="flex: 1; padding: 12px; background: #fafafa; border-left: 1px solid #eee;">
                        <div style="font-size: 0.55rem; font-weight: 900; color: #37003c; margin-bottom: 8px; opacity: 0.6; text-transform:uppercase; letter-spacing:1px;">🏆 Bonus Points</div>
                        ${bonusHtml || '<span style="opacity:0.4; font-size:0.7rem;">Waiting...</span>'}
                    </div>
                </div>`;
        });
        
        container.innerHTML = html || '<div style="text-align:center; padding:40px; opacity:0.5;">No games live.</div>';
    } catch (err) {
        console.error("Match Center Sync Error:", err);
    }
}
