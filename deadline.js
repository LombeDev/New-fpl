/**
 * KOPALA FPL - Fixed Deadline Script
 * Handles Netlify Proxy + Local Fallback + Smart Caching
 */

async function updateFPLDeadline() {
    const bannerEl = document.getElementById('deadline-timer');
    const CACHE_KEY = "fpl_deadline_cache";
    
    // 1. TRY CACHE FIRST
    const cached = localStorage.getItem(CACHE_KEY);
    const now = new Date();

    if (cached) {
        const data = JSON.parse(cached);
        const deadlineDate = new Date(data.deadline_time);
        
        // If stored deadline is still valid, show it and stop
        if (now < deadlineDate) {
            renderDeadlineDisplay(data.name, deadlineDate);
            return; 
        }
    }

    // 2. FETCH NEW DATA (If no cache or deadline passed)
    // We try the Netlify path. If on localhost, it will catch the error and try a proxy.
    let API_URL = "/fpl-api/bootstrap-static/"; 
    
    try {
        let response = await fetch(API_URL);
        
        // Fallback for Local Development (if Netlify rewrite is missing)
        if (!response.ok || window.location.hostname === "localhost") {
            const proxy = "https://api.allorigins.win/get?url=";
            const target = "https://fantasy.premierleague.com/api/bootstrap-static/";
            response = await fetch(proxy + encodeURIComponent(target));
            const json = await response.json();
            processFPLData(JSON.parse(json.contents));
        } else {
            const data = await response.json();
            processFPLData(data);
        }
    } catch (error) {
        console.error("Deadline Fetch Failed:", error);
        if (bannerEl) bannerEl.innerText = "Error Loading";
    }
}

function processFPLData(data) {
    const CACHE_KEY = "fpl_deadline_cache";
    // Find the 'is_next' gameweek
    const nextGW = data.events.find(e => e.is_next === true);

    if (nextGW) {
        const deadlineInfo = {
            name: nextGW.name,
            deadline_time: nextGW.deadline_time
        };
        // Save to cache
        localStorage.setItem(CACHE_KEY, JSON.stringify(deadlineInfo));
        renderDeadlineDisplay(deadlineInfo.name, new Date(deadlineInfo.deadline_time));
    }
}

function renderDeadlineDisplay(name, dateObj) {
    const bannerEl = document.getElementById('deadline-timer');
    if (!bannerEl) return;

    // Formatting to: Sat 18 Jan, 11:00 AM
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

// Start
document.addEventListener('DOMContentLoaded', updateFPLDeadline);
