/**
 * KOPALA FPL - Auto-Updating Deadline Banner
 * Logic: Use Cache until current time > cached deadline.
 */
async function updateFPLDeadline() {
    const bannerEl = document.getElementById('deadline-timer');
    const CACHE_KEY = "fpl_deadline_data";
    const API_URL = "https://fantasy.premierleague.com/api/bootstrap-static/";
    const PROXY = "https://api.allorigins.win/get?url="; // Essential for browser-side FPL API calls

    // 1. Check Cache
    const cached = localStorage.getItem(CACHE_KEY);
    const now = new Date();

    if (cached) {
        const data = JSON.parse(cached);
        const deadlineDate = new Date(data.deadline_time);

        // If stored deadline is still in the future, just render it
        if (now < deadlineDate) {
            renderBanner(data.name, deadlineDate);
            return; 
        }
    }

    // 2. Fetch New Data (Only runs if no cache OR deadline passed)
    try {
        console.log("Fetching new FPL deadline data...");
        const response = await fetch(PROXY + encodeURIComponent(API_URL));
        const wrapper = await response.json();
        const fullData = JSON.parse(wrapper.contents);

        // Find the next upcoming gameweek
        const nextGW = fullData.events.find(e => e.is_next === true) || 
                       fullData.events.find(e => !e.finished && new Date(e.deadline_time) > now);

        if (nextGW) {
            const newData = {
                name: nextGW.name,
                deadline_time: nextGW.deadline_time
            };

            // Save to LocalStorage
            localStorage.setItem(CACHE_KEY, JSON.stringify(newData));
            renderBanner(newData.name, new Date(newData.deadline_time));
        }
    } catch (error) {
        console.error("FPL Deadline Fetch Failed:", error);
        if (bannerEl) bannerEl.innerText = "Syncing...";
    }
}

/**
 * Renders the data to your specific HTML structure
 */
function renderBanner(name, dateObj) {
    const bannerEl = document.getElementById('deadline-timer');
    if (!bannerEl) return;

    // Formatting: Sat 18 Jan, 11:00 AM (Local Time)
    const formatted = dateObj.toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    bannerEl.innerText = `${name}: ${formatted}`;
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', updateFPLDeadline);

// Check every hour in case the user leaves the tab open across a deadline
setInterval(updateFPLDeadline, 60 * 60 * 1000);
