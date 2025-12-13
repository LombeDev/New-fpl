document.addEventListener('DOMContentLoaded', () => {
    fetchMatchesForLeagues();
});

// --- API CONFIGURATION (Flashlive Sports API via RapidAPI) ---
// 🛑 WARNING: Do not share this key publicly! It is sensitive.
const API_KEY = 'ed42f42e74msha29711a82aa97b6p13013djsn8e324daa3a1c'; 
const API_HOST = 'flashlive-sports.p.rapidapi.com'; 

// Soccer ID is typically 1 in Flashlive.
const SPORT_ID = 1; 

// League names for filtering (using common English names).
const LEAGUE_NAMES = {
    'Premier League': { name: 'Premier League', gridId: 'epl-grid' },
    'LaLiga': { name: 'LaLiga', gridId: 'laliga-grid' },
    'Bundesliga': { name: 'Bundesliga', gridId: 'bundesliga-grid' },
    'Serie A': { name: 'Serie A', gridId: 'seriea-grid' },
    'Ligue 1': { name: 'Ligue 1', gridId: 'ligue1-grid' },
    'AFCON': { name: 'Africa Cup of Nations', gridId: 'afcon-grid' } 
};

const API_BASE_URL = 'https://flashlive-sports.p.rapidapi.com/v1/'; 


/**
 * Helper function to create the match card HTML.
 * @param {object} match - The match data object from the API.
 */
function createMatchCard(match) {
    const homeTeam = match.homeTeam.name;
    const awayTeam = match.awayTeam.name;
    const homeScore = match.homeScore.current || 0;
    const awayScore = match.awayScore.current || 0;
    const status = match.status.type; // e.g., 'finished', 'inprogress', 'notstarted'
    const minute = match.time.currentPeriodStartTimestamp ? (new Date().getTime() - match.time.currentPeriodStartTimestamp * 1000) / 60000 : null;


    let scoreDisplay = match.time.startDate.substring(11, 16); // Default to start time
    let statusClass = '';

    if (status === 'finished') {
        scoreDisplay = `${match.homeScore.normaltime}-${match.awayScore.normaltime}`;
        statusClass = 'finished';
    } else if (status === 'inprogress' || status === 'halfTime') {
        scoreDisplay = `${homeScore}-${awayScore} (${Math.floor(minute)} min)`;
        statusClass = 'live';
    } else if (status === 'cancelled') {
        scoreDisplay = 'Canceled';
        statusClass = 'finished';
    }

    // Placeholder colors since logos are complex with this API's free tier
    const homeColor = getTeamColor(homeTeam);
    const awayColor = getTeamColor(awayTeam);

    return `
        <div class="match-card ${statusClass}">
            <div class="teams-container">
                <div class="team-row">
                    <div class="team-logo" style="background-color: ${homeColor};"></div>
                    <span>${homeTeam}</span>
                </div>
                <div class="team-row">
                    <div class="team-logo" style="background-color: ${awayColor};"></div>
                    <span>${awayTeam}</span>
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

    // The API uses timestamps, but for simplicity, we'll fetch today's events.
    // Flashlive often provides comprehensive lists by default.
    const url = `${API_BASE_URL}events/list?sportId=${SPORT_ID}`;

    try {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'x-rapidapi-host': API_HOST,
                'x-rapidapi-key': API_KEY 
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}. Check API usage/key.`);
        }
        
        const data = await response.json();
        const allMatches = data.data.events || [];

        // --- Filter and Render Matches ---
        Object.keys(LEAGUE_NAMES).forEach(leagueKey => {
            const leagueInfo = LEAGUE_NAMES[leagueKey];
            const gridContainer = document.getElementById(leagueInfo.gridId);
            
            if (!gridContainer) return;

            // Filter matches by the tournament name using a case-insensitive check
            const filteredEvents = allMatches.filter(match => 
                match.tournament.name.toLowerCase().includes(leagueInfo.name.toLowerCase())
            );

            if (filteredEvents.length > 0) {
                gridContainer.innerHTML = filteredEvents.map(createMatchCard).join('');
            } else {
                gridContainer.innerHTML = `<p class="no-matches" style="color: var(--subtext); padding: 10px;">No matches found for ${leagueKey}.</p>`;
            }
        });

    } catch (error) {
        console.error("Error fetching match data:", error);
        loadingIndicator.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error loading match data. Check API Key or Network.';
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
