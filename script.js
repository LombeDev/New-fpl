// MINI-LEAGUE STANDINGS (FIXED NaN ISSUE AND FORMAT)
async function loadStandings() {
  const container = document.getElementById("standings-list");
  if (!container) return; 
  
  // Define constants if they are not global (they should be, but defining locally as a fallback)
  const LEAGUE_ID = "101712"; // Ensure this ID is correct
  const FPL_BASE_URL = 'https://fantasy.premierleague.com/api/';
  const STANDINGS_ENDPOINT = `leagues-classic/${LEAGUE_ID}/standings/`;
  
  try {
    const data = await fetch(
      proxy + FPL_BASE_URL + STANDINGS_ENDPOINT
    ).then((r) => r.json());

    container.innerHTML = "";
    
    data.standings.results.forEach((team, index) => {
      setTimeout(() => {
        let rankChangeIndicator = '';
        let rankChangeClass = '';
        const rankChange = team.rank_change;

        if (rankChange > 0) {
            rankChangeIndicator = `▲${rankChange}`;
            rankChangeClass = 'rank-up';
        } else if (rankChange < 0) {
            rankChangeIndicator = `▼${Math.abs(rankChange)}`;
            rankChangeClass = 'rank-down';
        } else {
            rankChangeIndicator = '—';
            rankChangeClass = 'rank-unchanged';
        }
        
        // === CRITICAL FIX: Ensure team.total is an integer before formatting ===
        const totalPoints = parseInt(team.total);
        
        const div = document.createElement("div");
        div.classList.add("manager-row"); // Use the class for proper styling
        
        // Use the new structure for CSS formatting
        div.innerHTML = `
            <span class="rank-number">${team.rank}</span>
            <span class="manager-name">${team.player_name} (${team.entry_name})</span>
            <span class="rank-change ${rankChangeClass}">${rankChangeIndicator}</span>
            <span class="standings-points">${totalPoints.toLocaleString()}</span>
        `;
        
        // Apply color classes to the whole row
        if (team.rank === 1) div.classList.add("top-rank");
        else if (team.rank === 2) div.classList.add("second-rank");
        else if (team.rank === 3) div.classList.add("third-rank");

        container.appendChild(div);
      }, index * 30);
    });
  } catch (err) {
    console.error("Error loading standings:", err);
    container.textContent = "Failed to load standings. Check league ID or proxy.";
  }
}
