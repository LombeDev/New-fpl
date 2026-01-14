/**
 * KOPALA FPL - EPL RESULTS & FIXTURES (Football-Data.org Version)
 */

const FOOTBALL_API = "/api/competitions/PL/matches";

async function initEPLDashboard() {
    const container = document.getElementById('fixtures-container');
    if (!container) return;

    container.innerHTML = '<div style="text-align:center; padding:20px;">Fetching EPL Schedule...</div>';

    try {
        const response = await fetch(FOOTBALL_API);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        
        const data = await response.json();
        const matches = data.matches;

        // 1. Get the last 5 results (Finished games)
        const results = matches
            .filter(m => m.status === 'FINISHED')
            .slice(-5)
            .reverse();

        // 2. Get the next 5 fixtures (Scheduled games)
        const upcoming = matches
            .filter(m => m.status === 'SCHEDULED' || m.status === 'TIMED')
            .slice(0, 5);

        renderDashboard(results, upcoming);
    } catch (error) {
        console.error("Dashboard Error:", error);
        container.innerHTML = `<div style="color:red; text-align:center; padding:20px;">Failed to load data. Check API Key.</div>`;
    }
}

function renderDashboard(results, upcoming) {
    const container = document.getElementById('fixtures-container');
    let html = '';

    // Render Recent Results
    html += `<h3 style="color:#37003c; border-left:4px solid #37003c; padding-left:10px; margin-bottom:15px;">Recent Results</h3>`;
    results.forEach(match => {
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#fff; padding:12px; margin-bottom:8px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                <span style="flex:1; font-weight:800; font-size:0.85rem;">${match.homeTeam.shortName}</span>
                <span style="background:#37003c; color:#fff; padding:4px 10px; border-radius:4px; font-weight:900; font-family:monospace; margin:0 10px;">
                    ${match.score.fullTime.home} - ${match.score.fullTime.away}
                </span>
                <span style="flex:1; text-align:right; font-weight:800; font-size:0.85rem;">${match.awayTeam.shortName}</span>
            </div>`;
    });

    // Render Upcoming Fixtures
    html += `<h3 style="color:#37003c; border-left:4px solid #ff005a; padding-left:10px; margin: 25px 0 15px 0;">Upcoming Fixtures</h3>`;
    upcoming.forEach(match => {
        const date = new Date(match.utcDate).toLocaleString([], { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
        html += `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#f8f9fa; padding:12px; margin-bottom:8px; border-radius:8px; border:1px solid #eee;">
                <span style="flex:1; font-weight:700; font-size:0.8rem;">${match.homeTeam.shortName}</span>
                <div style="text-align:center; flex:1.2;">
                    <div style="font-size:0.65rem; font-weight:900; color:#ff005a; text-transform:uppercase;">${date}</div>
                </div>
                <span style="flex:1; text-align:right; font-weight:700; font-size:0.8rem;">${match.awayTeam.shortName}</span>
            </div>`;
    });

    container.innerHTML = html;
}

document.addEventListener('DOMContentLoaded', initEPLDashboard);
