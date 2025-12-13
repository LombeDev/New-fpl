document.addEventListener('DOMContentLoaded', () => {
    fetchMatchesForLeagues();
});

// TheSportsDB League IDs for the requested competitions:
const LEAGUE_IDS = {
    'English Premier League': { id: '4328', gridId: 'epl-grid' },
    'Spanish LaLiga': { id: '4335', gridId: 'laliga-grid' },
    'German Bundesliga': { id: '4331', gridId: 'bundesliga-grid' },
    'Italian Serie A': { id: '4337', gridId: 'seriea-grid' },
    'French Ligue 1': { id: '4334', gridId: 'ligue1-grid' },
    // AFCON ID is variable. Using a generic ID to fetch a different sport as a placeholder 
    // or you can search for a different free football API for AFCON.
    'African Cup of Nations': { id: '4426', gridId: 'afcon-grid' } 
};

// Base URL for TheSportsDB (using their free access key)
// Note: Live scores/logos are limited on the free tier.
// In scores.js or script.js:
// Use the simplified '1' access key, which is stable for public endpoints.
const API_BASE_URL = 'https://www.thesportsdb.com/api/v1/json/1/'; 

/**
 * Maps a team name to a placeholder color (since team logos aren't guaranteed on free API).
 * You can enhance this with a custom map or a paid API for real logos.
 */
function getTeamColor(teamName) {
    const hash = teamName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = ['#1a73e8', '#ea4335', '#fbbc05', '#34a853', '#7e24a7', '#004F98']; // Google colors and some others
    return colors[hash % colors.length];
}


/**
 * Creates the HTML for a single match card.
 * @param {object} match - The match data object from the API.
 */
function createMatchCard(match) {
    // Determine status and style
    const timeStatus = match.strTime || match.strStatus || 'TBC'; 
    const isFinished = match.strStatus && match.strStatus.includes('FT');
    // Live scores are often shown in a format like '75:00 1-0' on the API
    const isLive = match.intHomeScore && !isFinished; 

    let scoreDisplay = timeStatus;
    let statusClass = '';

    if (isFinished) {
        scoreDisplay = match.intHomeScore !== null ? `${match.intHomeScore}-${match.intAwayScore}` : timeStatus;
        statusClass = 'finished';
    } else if (isLive) {
        scoreDisplay = `${match.intHomeScore}-${match.intAwayScore}`;
        statusClass = 'live';
    } else {
        // Upcoming match
        scoreDisplay = timeStatus.substring(0, 5); // Just show the time if available
    }

    const homeColor = getTeamColor(match.strHomeTeam);
    const awayColor = getTeamColor(match.strAwayTeam);

    return `
        <div class="match-card ${statusClass}">
            <div class="teams-container">
                <div class="team-row">
                    <div class="team-logo" style="background-color: ${homeColor};"></div>
                    <span>${match.strHomeTeam}</span>
                </div>
                <div class="team-row">
                    <div class="team-logo" style="background-color: ${awayColor};"></div>
                    <span>${match.strAwayTeam}</span>
                </div>
            </div>
            <div class="match-status">${scoreDisplay}</div>
        </div>
    `;
}

/**
 * Fetches match data for all defined leagues.
 */
async function fetchMatchesForLeagues() {
    const loadingIndicator = document.getElementById('loading-indicator');
    const dateHeader = document.querySelector('.date-header');
    
    // Set today's date
    const today = new Date();
    dateHeader.textContent = today.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

    try {
        const promises = Object.keys(LEAGUE_IDS).map(leagueName => 
            fetchLeagueEvents(LEAGUE_IDS[leagueName].id, LEAGUE_IDS[leagueName].gridId)
        );
        
        await Promise.all(promises);

    } catch (error) {
        console.error("Error fetching match data:", error);
        loadingIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error loading match data from the API.';
    } finally {
        // Hide the main loading indicator
        loadingIndicator.style.display = 'none';
    }
}

/**
 * Fetches events for a single league ID (Prioritizes Next events).
 */
async function fetchLeagueEvents(leagueId, gridId) {
    const gridContainer = document.getElementById(gridId);
    if (!gridContainer) return; 

    // Endpoint: eventsnextleague.php fetches upcoming matches
    let url = `${API_BASE_URL}eventsnextleague.php?id=${leagueId}`;
    
    try {
        const response = await fetch(url);
        const data = await response.json();
        
        let events = data.events || [];
        
        // If no upcoming events, try to fetch the 5 most recent past events to show scores.
        if (events.length === 0) {
            const latestUrl = `${API_BASE_URL}eventspastleague.php?id=${leagueId}`;
            const latestResponse = await fetch(latestUrl);
            const latestData = await latestResponse.json();
            events = latestData.events ? latestData.events.slice(0, 5) : []; // Limit to 5
        }
        
        if (events.length > 0) {
            gridContainer.innerHTML = events.map(createMatchCard).join('');
        } else {
            gridContainer.innerHTML = '<p class="no-matches" style="color: var(--subtext); padding: 10px;">No upcoming or recent matches found for this league.</p>';
        }
    } catch (error) {
        console.error(`Failed to fetch data for league ID ${leagueId}:`, error);
        gridContainer.innerHTML = '<p class="no-matches" style="color: var(--live-status); padding: 10px;">Error loading data for this league. Check console for details.</p>';
    }
}
