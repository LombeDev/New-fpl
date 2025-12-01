// MINI-LEAGUE STANDINGS (FIXED FOR NEW CSS STRUCTURE)
async function loadStandings() {
  const container = document.getElementById("standings-list");
  if (!container) return; 
  
  try {
    const STANDINGS_ENDPOINT = `leagues-classic/${LEAGUE_ID}/standings/`;

    const data = await fetch(
      proxy + FPL_BASE_URL + STANDINGS_ENDPOINT
    ).then((r) => r.json());

    // Clear the loading content/placeholders from the HTML
    container.innerHTML = "";
    
    // Sort results by rank before processing (though the API usually returns them sorted)
    data.standings.results.sort((a, b) => a.rank - b.rank);

    data.standings.results.forEach((team, index) => {
      // Small delay for staggered fade-in effect
      setTimeout(() => {
        
        let rankChangeValue = team.rank_change;
        let rankChangeClass = 'rank-unchanged';
        
        // Determine the class for the arrow/color styling
        // FPL API: positive value means dropped rank (down arrow)
        if (rankChangeValue > 0) {
            rankChangeClass = 'rank-down'; 
        // FPL API: negative value means improved rank (up arrow)
        } else if (rankChangeValue < 0) {
            rankChangeClass = 'rank-up'; 
        }
        
        // --- FIX APPLIED HERE ---
        // Use Math.abs for the value to display (the CSS handles the arrow/symbol)
        const displayValue = Math.abs(rankChangeValue);

        // 1. Create the main list item (the single card row)
        const div = document.createElement("div");
        div.classList.add("manager-row");
        
        // 2. Build the inner content using the required CSS classes
        div.innerHTML = `
            <span class="rank-number">${team.rank}</span>
            <span class="manager-name">${team.player_name} (${team.entry_name})</span>
            <span class="rank-change ${rankChangeClass}">${displayValue}</span> 
            <span class="standings-points">${team.total.toLocaleString()}</span>
        `;
        
        // Append the new row to the container
        container.appendChild(div);
      }, index * 30);
    });
    
  } catch (err) {
    console.error("Error loading standings:", err);
    container.textContent = "Failed to load standings. Check league ID or proxy.";
  }
}
