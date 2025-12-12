// --- API and Utility Constants ---
// FIX FOR NETLIFY HOSTING: Using local path for Netlify Proxy Redirect
const FPL_API_URL = '/api/bootstrap-static/'; 
  
const statsGrid = document.getElementById('statsGrid');
const chipBreakdown = document.getElementById('chipBreakdown');
const gameweekBadge = document.getElementById('gameweekBadge');

// Re-useable SVG Icons
const icons = {
    star: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
    trending: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>',
    trophy: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
    zap: '<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>'
};

// Helper to format large numbers 
const formatNumber = (num) => {
    if (num >= 1000000) {
        return (num / 1000000).toFixed(1) + 'M';
    }
    if (num >= 1000) {
        return (num / 1000).toFixed(1) + 'K';
    }
    return num.toString();
};

// --- Rendering Functions ---
const renderStatsSkeleton = () => {
    statsGrid.innerHTML = Array(4).fill().map(() => `
        <div class="card">
            <div class="card-header">
                <div class="icon-wrapper skeleton" style="width: 3rem; height: 3rem; border-radius: 0.5rem;"></div>
                <span class="highlight skeleton" style="width: 30%; height: 1.25rem;"></span>
            </div>
            <div class="skeleton-line skeleton" style="width: 50%;"></div>
            <div class="skeleton-value skeleton"></div>
            <div class="skeleton-line skeleton" style="width: 60%;"></div>
        </div>
    `).join('');
};

const renderStats = (stats) => {
    statsGrid.innerHTML = ''; 
    stats.forEach(stat => {
        statsGrid.innerHTML += `
            <div class="card">
                <div class="card-header">
                    <div class="icon-wrapper">${icons[stat.icon] || icons.zap}</div>
                    <span class="highlight">${stat.highlight}</span>
                </div>
                <p class="stat-label">${stat.title}</p>
                <p class="stat-value">${stat.value}</p>
                <p class="stat-subtitle">${stat.subtitle}</p>
            </div>
        `;
    });
};

const renderChips = (chips) => {
    chipBreakdown.innerHTML = ''; 
    if (chips.length === 0) {
        chipBreakdown.innerHTML = '<p class="stat-subtitle">Chip data unavailable or failed to load.</p>';
        return;
    }
    chips.forEach(chip => {
        chipBreakdown.innerHTML += `
            <div class="chip-item">
                <div class="chip-row">
                    <span class="chip-name">${chip.name}</span>
                    <span class="chip-count">${chip.count}</span>
                </div>
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${chip.percentage}%"></div>
                </div>
            </div>
        `;
    });
};

// --- Data Processing Function ---
const findCurrentGameweek = (events) => {
    const currentEvent = events.find(e => e.is_current || e.is_next);
    if (currentEvent) {
        gameweekBadge.textContent = `Gameweek ${currentEvent.id}`;
    } else {
        gameweekBadge.textContent = `Gameweek N/A`;
    }
}

const processFplData = (data) => {
    const players = data.elements;
    const teams = data.teams;
    
    const getTeamShortName = (teamId) => {
        const team = teams.find(t => t.id === teamId);
        return team ? team.short_name : 'N/A';
    };

    const mostBought = players.reduce((max, p) => p.transfers_in_event > max.transfers_in_event ? p : max);
    const topScorer = players.reduce((max, p) => p.event_points > max.event_points ? p : max);
    const mostSelected = players.reduce((max, p) => parseFloat(p.selected_by_percent) > parseFloat(max.selected_by_percent) ? p : max);
    const mostSold = players.reduce((max, p) => p.transfers_out_event > max.transfers_out_event ? p : max);

    return [
        { 
          title: "Most Selected Player", 
          value: `${mostSelected.first_name} ${mostSelected.second_name}`, 
          subtitle: `${mostSelected.selected_by_percent}% selected overall`, 
          icon: "star", 
          highlight: getTeamShortName(mostSelected.team) 
        },
        { 
          title: "Most Bought (This GW)", 
          value: `${mostBought.first_name} ${mostBought.second_name}`, 
          subtitle: `${formatNumber(mostBought.transfers_in_event)} transfers in`, 
          icon: "trending", 
          highlight: getTeamShortName(mostBought.team) 
        },
        { 
          title: "Gameweek Top Scorer", 
          value: `${topScorer.first_name} ${topScorer.second_name}`, 
          subtitle: `${topScorer.event_points} Points this GW`, 
          icon: "trophy", 
          highlight: getTeamShortName(topScorer.team) 
        },
        { 
          title: "Most Sold (This GW)", 
          value: `${mostSold.first_name} ${mostSold.second_name}`, 
          subtitle: `${formatNumber(mostSold.transfers_out_event)} transfers out`, 
          icon: "zap", 
          highlight: getTeamShortName(mostSold.team)
        }
    ];
};

// --- Main Fetch Function ---
async function getFplData() {
    renderStatsSkeleton();
    renderChips([]);
    gameweekBadge.textContent = 'Loading...';

    try {
        const response = await fetch(FPL_API_URL);
        if (!response.ok) {
            statsGrid.innerHTML = ''; 
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        
        // 1. Update Gameweek Badge
        findCurrentGameweek(data.events);

        // 2. Process and Render Main Stats
        const processedStats = processFplData(data);
        renderStats(processedStats);

        // 3. Render Mock Chip Data
        const mockChips = [
            { name: "Triple Captain", count: "2.1M", percentage: 45 },
            { name: "Bench Boost", count: "1.4M", percentage: 30 },
            { name: "Free Hit", count: "890K", percentage: 19 },
            { name: "Wildcard", count: "280K", percentage: 6 }
        ];
        renderChips(mockChips);

    } catch (error) {
        console.error("Could not fetch FPL data:", error);
        gameweekBadge.textContent = 'Data Error';
        statsGrid.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #f87171;">
            <p>🚨 Failed to load FPL data. Please check the console for details.</p>
            <p class="stat-subtitle" style="margin-top: 0.5rem;">Remember to check your **_redirects** file configuration on Netlify!</p>
        </div>`;
        renderChips([]); 
    }
}

// Initialize the application when the page loads
window.onload = getFplData;
