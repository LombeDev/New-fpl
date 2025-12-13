document.addEventListener('DOMContentLoaded', () => {
    fetchMatchesForLeagues();
});

// --- API CONFIGURATION (Livescore-API from RapidAPI) ---
// 🛑 IMPORTANT: Replace these with your actual keys and host from RapidAPI
const API_KEY = 'ed42f42e74msha29711a82aa97b6p13013djsn8e324daa3a1c'; 
const API_HOST = 'flashlive-sports.p.rapidapi.com'; 

// Livescore-API does not use League IDs; it returns ALL matches for the day.
// We will filter based on the league name (or country name)
const LEAGUE_NAMES = {
    'Premier League': { name: 'England', gridId: 'epl-grid' }, 
    'LaLiga': { name: 'Spain', gridId: 'laliga-grid' },
    'Bundesliga': { name: 'Germany', gridId: 'bundesliga-grid' },
    'Serie A': { name: 'Italy', gridId: 'seriea-grid' },
    'Ligue 1': { name: 'France', gridId: 'ligue1-grid' },
    'AFCON': { name: 'Africa Cup of Nations', gridId: 'afcon-grid' } 
};

// Base URL for Today's Fixtures
const API_URL = 'https://livescore-api.com/api-client/fixtures/matches.json'; 


/**
 * Helper function to create the match card HTML.
 */
function createMatchCard(match) {
    const status = match.status;
    const homeName = match.home_name;
    const awayName = match.away_name;
    const homeScore = match.score.split('-')[0] || 0;
    const awayScore = match.score.split('-')[1] || 0;

    let scoreDisplay = match.time || 'TBC';
    let statusClass = '';

    if (status === 'FINISHED') {
        scoreDisplay = `${homeScore}-${awayScore}`;
        statusClass = 'finished';
    } else if (status === 'LIVE') {
        scoreDisplay = `${homeScore}-${awayScore} (${match.minute}')`;
        statusClass = 'live';
    }
    
    // Placeholder colors since logos are not guaranteed on free tier
    const homeColor = getTeamColor(homeName);
    const awayColor = getTeamColor(awayName);

    return `
        <div class="match-card ${statusClass}">
            <div class="teams-container">
                <div class="team-row">
                    <div class="team-logo" style="background-color: ${homeColor};"></div>
                    <span>${homeName}</span>
                </div>
                <div class="team-row">
                    <div class="team-logo" style="background-color: ${awayColor};"></div>
                    <span>${awayName}</span>
                </div>
            </div>
            <div class="match-status">${scoreDisplay}</div>
        </div>
    `;
}

/**
 * Fetches all matches for today and filters them into league grids.
 */
async function fetchMatchesForLeagues() {
    const loadingIndicator = document.getElementById('loading-indicator');
    const dateHeader = document.querySelector('.date-header');
    
    // Set today's date
    const today = new Date();
    dateHeader.textContent = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                // REQUIRED: Authentication Headers for RapidAPI
                'x-rapidapi-host': API_HOST,
                'x-rapidapi-key': API_KEY 
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.success !== true || !data.data || !data.data.match) {
             throw new Error("API response was successful but data is empty or malformed.");
        }
        
        const allMatches = data.data.match || [];

        // --- Filter and Render Matches ---
        Object.keys(LEAGUE_NAMES).forEach(leagueKey => {
            const leagueInfo = LEAGUE_NAMES[leagueKey];
            const gridContainer = document.getElementById(leagueInfo.gridId);
            
            if (!gridContainer) return;

            // Filter matches by the country name (or league name)
            const filteredEvents = allMatches.filter(match => 
                match.country.name.includes(leagueInfo.name)
            );

            if (filteredEvents.length > 0) {
                gridContainer.innerHTML = filteredEvents.map(createMatchCard).join('');
            } else {
                gridContainer.innerHTML = `<p class="no-matches" style="color: var(--subtext); padding: 10px;">No matches found for ${leagueKey}.</p>`;
            }
        });

    } catch (error) {
        console.error("Error fetching match data:", error);
        loadingIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error loading match data. Check your API Key and Network.';
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

// Remaining helper functions (getTeamColor)
function getTeamColor(teamName) {
    const hash = teamName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = ['#1a73e8', '#ea4335', '#fbbc05', '#34a853', '#7e24a7', '#004F98'];
    return colors[hash % colors.length];
}
