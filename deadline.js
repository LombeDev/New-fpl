/**
 * KOPALA FPL - Universal Deadline Script
 * Specifically for your multi-span HTML structure
 */
async function updateFPLDeadline() {
    const gwLabel = document.getElementById('gw-label');
    const timeDisplay = document.getElementById('deadline-date-time');
    const CACHE_KEY = "fpl_deadline_cache";
    
    // 1. Check for cached data to show instantly
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
        const data = JSON.parse(cached);
        if (new Date() < new Date(data.deadline_time)) {
            renderToSpans(data.name, new Date(data.deadline_time));
        }
    }

    // 2. Select API Path (detects if you are local or on Netlify)
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const API_URL = isLocal 
        ? "https://api.allorigins.win/get?url=" + encodeURIComponent("https://fantasy.premierleague.com/api/bootstrap-static/")
        : "/fpl-api/bootstrap-static/";

    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error("Fetch failed");
        
        let data = await response.json();
        if (isLocal) data = JSON.parse(data.contents);

        // 3. Find the next valid deadline
        const nextGW = data.events.find(e => e.is_next === true) || 
                       data.events.find(e => !e.finished && new Date(e.deadline_time) > new Date());

        if (nextGW) {
            const cacheObj = { name: nextGW.name, deadline_time: nextGW.deadline_time };
            localStorage.setItem(CACHE_KEY, JSON.stringify(cacheObj));
            renderToSpans(cacheObj.name, new Date(cacheObj.deadline_time));
        }
    } catch (error) {
        console.error("Deadline Sync Error:", error);
        if (timeDisplay && !cached) timeDisplay.innerText = "Syncing...";
    }
}

/**
 * Updates your specific HTML structure
 */
function renderToSpans(name, dateObj) {
    const gwLabel = document.getElementById('gw-label');
    const timeDisplay = document.getElementById('deadline-date-time');

    if (gwLabel) {
        // Formats "Gameweek 22" to "GW 22"
        gwLabel.innerText = name.replace("Gameweek ", "GW ");
    }

    if (timeDisplay) {
        // Formats to: Sat 18 Jan, 11:00 AM
        timeDisplay.innerText = dateObj.toLocaleString('en-GB', {
            weekday: 'short',
            day: 'numeric',
            month: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    }
}

// Ensure it runs after the page loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateFPLDeadline);
} else {
    updateFPLDeadline();
}
