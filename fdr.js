// --- 1. CONSTANTS AND UTILITIES ---

// Use the local proxy paths defined in the _redirects file
const BASE_URL = ""; 
const FIXTURES_ENDPOINT = "/api/fpl/fixtures/"; 
const BOOTSTRAP_ENDPOINT = "/api/fpl/bootstrap/"; 

/**
 * Fetches JSON data from a given FPL API endpoint via the Netlify proxy.
 * @param {string} endpoint The specific API path (e.g., /api/fpl/fixtures/).
 * @returns {Promise<object | null>} The JSON data or null on error.
 */
async function getFplData(endpoint) {
    try {
        // Fetch the data using the local proxy endpoint
        const response = await fetch(endpoint); 
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
    } catch (e) {
        console.error(`Error fetching data from ${endpoint}:`, e);
        return null;
    }
}

/**
 * Creates a map from team IDs to team names.
 * @param {object} bootstrapData The data from the bootstrap-static endpoint.
 * @returns {Map<number, string>} A map of Team ID -> Team Name.
 */
function createTeamMap(bootstrapData) {
    const teamMap = new Map();
    if (bootstrapData && bootstrapData.teams) {
        bootstrapData.teams.forEach(team => {
            teamMap.set(team.id, team.name); 
        });
    }
    return teamMap;
}

/**
 * Transforms the linear fixture list into a structure grouped by team and Gameweek.
 * @param {Array<object>} fixturesData List of fixtures.
 * @param {Map<number, string>} teamMap Map of team IDs to team names.
 * @returns {Map<string, Array<object>>} Map of Team Name -> List of Fixture Objects.
 */
function groupFixturesByTeam(fixturesData, teamMap) {
    const teamFixtures = new Map();
    const UPCOMING_FIXTURES = fixturesData
        .filter(fixture => !fixture.started && fixture.finished === false)
        .sort((a, b) => a.event - b.event); 

    for (const fixture of UPCOMING_FIXTURES) {
        const homeTeamName = teamMap.get(fixture.team_h);
        const awayTeamName = teamMap.get(fixture.team_a);

        // Function to safely get the opponent's abbreviation (3 letters)
        const getOpponentAbbr = (id) => teamMap.get(id) ? teamMap.get(id).substring(0, 3).toUpperCase() : 'N/A';

        // 1. Add fixture to the home team's list
        if (!teamFixtures.has(homeTeamName)) {
            teamFixtures.set(homeTeamName, []);
        }
        teamFixtures.get(homeTeamName).push({
            gw: fixture.event,
            opponent: getOpponentAbbr(fixture.team_a),
            venue: 'H',
            fdr: fixture.team_h_difficulty,
        });

        // 2. Add fixture to the away team's list
        if (!teamFixtures.has(awayTeamName)) {
            teamFixtures.set(awayTeamName, []);
        }
        teamFixtures.get(awayTeamName).push({
            gw: fixture.event,
            opponent: getOpponentAbbr(fixture.team_h),
            venue: 'A',
            fdr: fixture.team_a_difficulty,
        });
    }
    return teamFixtures;
}

// --- 2. MAIN RENDER FUNCTION ---

/**
 * Main function to fetch data and render the fixture ticker table.
 */
async function renderFixtures() {
    const container = document.getElementById('fixtures-container');
    container.innerHTML = '<h2>Fetching data...</h2>'; 

    const [bootstrapData, fixturesData] = await Promise.all([
        getFplData(BOOTSTRAP_ENDPOINT),
        getFplData(FIXTURES_ENDPOINT)
    ]);

    if (!bootstrapData || !fixturesData) {
        container.innerHTML = '<h2>Error loading FPL data. Please try again.</h2>';
        return; 
    }
    
    const teamMap = createTeamMap(bootstrapData);
    const groupedFixtures = groupFixturesByTeam(fixturesData, teamMap);
    
    // Determine the next 5 upcoming Gameweeks
    const allGameweeks = Array.from(new Set(fixturesData
        .filter(f => !f.started && f.finished === false)
        .map(f => f.event)))
        .sort((a, b) => a - b);
        
    const visibleGameweeks = allGameweeks.slice(0, 5); 
    
    // Build the HTML Table header
    let html = `
        <table class="fixture-ticker">
            <thead>
                <tr>
                    <th class="team-header">Team</th>
                    ${visibleGameweeks.map(gw => `<th>GW ${gw}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
    `;

    // Iterate over teams and their fixtures to build rows
    for (const [teamName, fixtures] of groupedFixtures.entries()) {
        html += `
            <tr data-team-name="${teamName}">
                <td class="team-name-cell">${teamName} <span class="remove-btn">x</span></td>
        `;

        // Populate fixture cells for the visible GWs
        for (const gw of visibleGameweeks) {
            const fixture = fixtures.find(f => f.gw === gw);
            
            if (fixture) {
                // Generate the cell with the FDR block
                html += `
                    <td>
                        <div class="fdr-block fdr-${fixture.fdr}">
                            ${fixture.opponent} (${fixture.venue})
                        </div>
                    </td>
                `;
            } else {
                // Placeholder for blank or unavailable Gameweeks
                html += `<td></td>`; 
            }
        }
        
        html += `</tr>`;
    }

    html += `
            </tbody>
        </table>
    `;

    // Wrap the table in a responsive div for mobile scrolling
    container.innerHTML = `
        <div class="table-responsive-wrapper">
            ${html}
        </div>
    `;
}

// --- 3. INTERACTIVITY FUNCTIONS ---

/**
 * Attaches event listeners to the 'x' buttons to remove the corresponding team row.
 */
function setupRemoveTeamListeners() {
    const removeButtons = document.querySelectorAll('.remove-btn');

    removeButtons.forEach(button => {
        button.addEventListener('click', (event) => {
            const rowToRemove = event.target.closest('tr');
            
            if (rowToRemove) {
                const teamName = rowToRemove.dataset.teamName;
                console.log(`Removing team: ${teamName}`);
                rowToRemove.remove();
            }
        });
    });
}

/**
 * Attaches an event listener to the search box to filter the table rows.
 */
function setupTeamFilter() {
    const searchInput = document.getElementById('team-search');
    
    if (!searchInput) {
        console.warn("Search input with ID 'team-search' not found.");
        return;
    }

    searchInput.addEventListener('input', (event) => {
        const searchText = event.target.value.toLowerCase().trim();
        const tableRows = document.querySelectorAll('.fixture-ticker tbody tr');

        tableRows.forEach(row => {
            const teamName = row.dataset.teamName.toLowerCase(); 

            if (teamName.includes(searchText)) {
                row.style.display = ''; 
            } else {
                row.style.display = 'none'; 
            }
        });
    });
}


// --- 4. EXECUTION BLOCK (MUST BE AT THE END) ---

// Execute the main function, then set up interactive listeners
renderFixtures().then(() => {
    setupRemoveTeamListeners();
    setupTeamFilter(); 
});
