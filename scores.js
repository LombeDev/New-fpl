document.addEventListener('DOMContentLoaded', () => {
    fetchMatchesForLeagues();
});

// TheSportsDB League Names and IDs for the requested competitions:
const LEAGUE_DATA = {
    'Premier League': { id: '4328', gridId: 'epl-grid', name: 'English Premier League' },
    'LaLiga': { id: '4335', gridId: 'laliga-grid', name: 'Spanish La Liga' },
    'Bundesliga': { id: '4331', gridId: 'bundesliga-grid', name: 'German Bundesliga' },
    'Serie A': { id: '4337', gridId: 'seriea-grid', name: 'Italian Serie A' },
    'Ligue 1': { id: '4334', gridId: 'ligue1-grid', name: 'French Ligue 1' },
    // Using a different ID for AFCON for better search success
    'AFCON': { id: '4426', gridId: 'afcon-grid', name: 'African Cup of Nations' } 
};

// Base URL for TheSportsDB (using their stable free access key '1')
const API_BASE_URL = 'https://www.thesportsdb.com/api/v1/json/1/'; 

/**
 * Maps a team name to a placeholder color (for team logo background).
 */
function getTeamColor(teamName) {
    const hash = teamName.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
    const colors = ['#1a73e8', '#ea4335', '#fbbc05', '#34a853', '#7e24a7', '#004F98'];
    return colors[hash % colors.length];
}

/**
 * Creates the HTML for a single match card.
 */
function createMatchCard(match) {
    // API provides score if match is over (FT) or live
    const timeStatus = match.strTime || match.strStatus || 'TBC'; 
    const isFinished = match.strStatus && match.strStatus.includes('FT');
    const isLive = match.strStatus && !isFinished && match.intHomeScore !== null; 

    let scoreDisplay = timeStatus;
    let statusClass = '';

    if (isFinished) {
        scoreDisplay = match.intHomeScore !== null ? `${match.intHomeScore}-${match.intAwayScore}` : timeStatus;
        statusClass = 'finished';
    } else if (isLive) {
        scoreDisplay = `${match.intHomeScore}-${match.intAwayScore}`;
        statusClass = 'live';
    } else {
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
        const promises = Object.keys(LEAGUE_DATA).map(leagueKey => 
            fetchLeagueEvents(LEAGUE_DATA[leagueKey])
        );
        
        await Promise.all(promises);

    } catch (error) {
        console.error("Error fetching match data:", error);
        loadingIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error loading match data from the API.';
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

/**
 * Fetches events using the searchevents.php endpoint (Simpler and more reliable).
 */
async function fetchLeagueEvents(leagueInfo) {
    const { id, gridId, name } = leagueInfo;
    const gridContainer = document.getElementById(gridId);
    if (!gridContainer) return; 

    // Format: YYYY-MM-DD
    const todayDate = new Date().toISOString().slice(0, 10); 
    
    // Use the search endpoint to find events by league name and date
    // This is generally more reliable than static event files that get moved.
    let url = `${API_BASE_URL}searchevents.php?l=${encodeURIComponent(name)}&d=${todayDate}`;
    
    try {
        const response = await fetch(url);
        
        // Check for non-JSON response (like 404 HTML error page)
        const contentType = response.headers.get("content-type");
        if (!contentType || !contentType.includes("application/json")) {
             // If we get an error page, the server URL is still bad.
             throw new Error(`404 or Non-JSON response received from search endpoint.`);
        }
        
        const data = await response.json();
        
        let events = data.event || [];
        
        if (events.length > 0) {
            gridContainer.innerHTML = events.map(createMatchCard).join('');
        } else {
            // If no events for today, try fetching the 5 most recent past events
            const latestUrl = `${API_BASE_URL}eventspastleague.php?id=${id}`;
            const latestResponse = await fetch(latestUrl);
            const latestData = await latestResponse.json();
            
            const latestEvents = latestData.events ? latestData.events.slice(0, 5) : [];
            
            if (latestEvents.length > 0) {
                 gridContainer.innerHTML = latestEvents.map(createMatchCard).join('');
            } else {
                 gridContainer.innerHTML = `<p class="no-matches" style="color: var(--subtext); padding: 10px;">No matches found for ${name}.</p>`;
            }
        }
    } catch (error) {
        console.error(`Failed to fetch data for ${name}:`, error);
        gridContainer.innerHTML = `<p class="no-matches" style="color: var(--live-status); padding: 10px;">Error loading data for ${name}.</p>`;
    }
}
