// --- 1. LOADER FUNCTIONALITY ---
document.addEventListener('DOMContentLoaded', () => {
    const loader = document.getElementById('loader');
    const mainContent = document.getElementById('main-content');

    // Simulate a data loading delay (e.g., 2.5 seconds)
    setTimeout(() => {
        // Fade out the loader
        loader.style.opacity = '0';
        
        // Wait for the fade out to finish (0.5s transition time)
        setTimeout(() => {
            loader.classList.add('hidden');
            mainContent.classList.remove('hidden');
        }, 500);

    }, 2500);
});

// --- 2. MINI-LEAGUE FUNCTIONALITY ---
/**
 * Loads a league based on the ID entered.
 * In a real application, this would fetch data from the FPL API.
 */
function loadLeague() {
    const leagueIdInput = document.getElementById('leagueId');
    const leagueResultsDiv = document.getElementById('leagueResults');
    const leagueId = leagueIdInput.value.trim();

    if (!leagueId) {
        leagueResultsDiv.innerHTML = '<p style="color: var(--pink);">Please enter a valid League ID.</p>';
        return;
    }

    // Clear previous results and show loading status
    leagueResultsDiv.innerHTML = `<p>Loading data for League ID: <strong>${leagueId}</strong>...</p>`;
    
    // --- SIMULATED FPL API CALL ---
    // This is where you would use fetch() to talk to the FPL API:
    // fetch(`https://fantasy.premierleague.com/api/leagues-classic/${leagueId}/standings/`)
    
    setTimeout(() => {
        // Simulate a successful API response and data rendering
        const simulatedData = [
            { rank: 1, name: 'Lombe (Team 1)', points: 1500 },
            { rank: 2, name: 'Fantasy Fan (Team 2)', points: 1480 },
            { rank: 3, name: 'The Analyst (Team 3)', points: 1450 }
        ];

        let html = '<h4>Top Standings:</h4>';
        html += '<ol style="padding-left: 20px;">';
        
        simulatedData.forEach(team => {
            html += `<li style="margin-bottom: 5px;"><strong>#${team.rank}</strong> - ${team.name} (${team.points} pts)</li>`;
        });
        
        html += '</ol>';
        
        leagueResultsDiv.innerHTML = html;
        leagueResultsDiv.style.borderTop = '1px solid #eee';
        leagueResultsDiv.style.paddingTop = '15px';

    }, 1500);
}
