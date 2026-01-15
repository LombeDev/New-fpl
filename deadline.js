/**
 * KOPALA FPL - Fixed Deadline Script
 * Specifically for Netlify Rewrites
 */

async function updateFPLDeadline() {
    const bannerEl = document.getElementById('deadline-timer');
    const CACHE_KEY = "fpl_deadline_cache";
    const API_URL = "/fpl-api/bootstrap-static/";

    // 1. Try to show cached data immediately to prevent "Loading..." flicker
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
        const data = JSON.parse(cached);
        const dDate = new Date(data.deadline_time);
        // Only show if it's still in the future
        if (new Date() < dDate) {
            renderDeadlineDisplay(data.name, dDate);
        }
    }

    try {
        // 2. Fetch fresh data from your Netlify Proxy
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
        
        const data = await response.json();

        // 3. Find the NEXT gameweek
        // Strategy: Look for 'is_next', fallback to first event with future date
        let nextGW = data.events.find(e => e.is_next === true);
        
        if (!nextGW) {
            nextGW = data.events.find(e => !e.finished && new Date(e.deadline_time) > new Date());
        }

        if (nextGW) {
            const deadlineInfo = {
                name: nextGW.name,
                deadline_time: nextGW.deadline_time
            };

            // Save to LocalStorage cache
            localStorage.setItem(CACHE_KEY, JSON.stringify(deadlineInfo));

            // Render to HTML
            renderDeadlineDisplay(deadlineInfo.name, new Date(deadlineInfo.deadline_time));
        }
    } catch (error) {
        console.error("FPL Fetch Error:", error);
        if (!cached && bannerEl) {
            bannerEl.innerText = "Check Connection";
        }
    }
}

function renderDeadlineDisplay(name, dateObj) {
    const bannerEl = document.getElementById('deadline-timer');
    if (!bannerEl) return;

    // Local Format: Sat 18 Jan, 11:00 AM
    const formatted = dateObj.toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
    });

    // We use innerHTML to allow for a slight style pop on the date
    bannerEl.innerHTML = `${name}: <span style="color: #ffffff;">${formatted}</span>`;
}

// Ensure the script runs after the DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateFPLDeadline);
} else {
    updateFPLDeadline();
}
