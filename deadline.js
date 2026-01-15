/**
 * KOPALA FPL - Smart Deadline Banner
 * Only fetches when the current deadline has expired.
 */
async function updateFPLDeadline() {
    const bannerEl = document.getElementById('deadline-timer');
    const CACHE_KEY = "fpl_deadline_cache";
    const API_URL = "/fpl-api/bootstrap-static/";

    // 1. Check Local Cache
    const cachedData = localStorage.getItem(CACHE_KEY);
    const now = new Date();

    if (cachedData) {
        const parsed = JSON.parse(cachedData);
        const deadlineDate = new Date(parsed.deadline_time);

        // If the cached deadline is still in the future, just render it and EXIT
        if (now < deadlineDate) {
            console.log("Using cached deadline: " + parsed.name);
            renderDeadlineDisplay(parsed.name, deadlineDate);
            return;
        }
    }

    // 2. Fetch New Data (Only runs if no cache OR deadline passed)
    try {
        console.log("Deadline passed or no cache. Fetching new GW data...");
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error("Fetch failed");
        
        const data = await response.json();
        
        // Find the next upcoming gameweek (not finished and in the future)
        const nextGW = data.events.find(e => !e.finished && new Date(e.deadline_time) > now);

        if (nextGW) {
            const newCache = {
                name: nextGW.name,
                deadline_time: nextGW.deadline_time
            };

            // Update Cache
            localStorage.setItem(CACHE_KEY, JSON.stringify(newCache));
            renderDeadlineDisplay(newCache.name, new Date(newCache.deadline_time));
        } else {
            if (bannerEl) bannerEl.innerText = "Season Finished";
        }
    } catch (error) {
        console.error("Deadline sync error:", error);
        if (bannerEl) bannerEl.innerText = "Syncing...";
    }
}

/**
 * Formats the date to a readable string
 */
function renderDeadlineDisplay(name, dateObj) {
    const bannerEl = document.getElementById('deadline-timer');
    if (!bannerEl) return;

    // Format: Sat 18 Jan, 11:00 AM
    const formattedDate = dateObj.toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    bannerEl.innerText = `${name}: ${formattedDate}`;
}

// Run immediately on load
document.addEventListener('DOMContentLoaded', updateFPLDeadline);

// Optional: Auto-check every 30 minutes in case the tab is left open
setInterval(updateFPLDeadline, 30 * 60 * 1000);
