/**
 * KOPALA FPL - Bulletproof Deadline Script
 * Version 3.0
 */

async function updateFPLDeadline() {
    const bannerEl = document.getElementById('deadline-timer');
    const CACHE_KEY = "fpl_deadline_cache";
    const API_URL = "/fpl-api/bootstrap-static/";

    // 1. Instant Cache Display
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
        const data = JSON.parse(cached);
        const dDate = new Date(data.deadline_time);
        if (new Date() < dDate) {
            renderDeadlineDisplay(data.name, dDate);
            // We still fetch in background to verify, but user sees date instantly
        }
    }

    try {
        // 2. Fetch Data (Supports Netlify Proxy)
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error("Proxy Error");
        const data = await response.json();

        // 3. Find the NEXT deadline (First event that hasn't finished and is in the future)
        const nextGW = data.events.find(e => {
            const d = new Date(e.deadline_time);
            return d > new Date() && !e.finished;
        });

        if (nextGW) {
            const deadlineDate = new Date(nextGW.deadline_time);
            
            // Save to Cache
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                name: nextGW.name,
                deadline_time: nextGW.deadline_time
            }));

            renderDeadlineDisplay(nextGW.name, deadlineDate);
        }
    } catch (err) {
        console.warn("API Fetch failed, using cache fallback.");
    }
}

function renderDeadlineDisplay(name, dateObj) {
    const bannerEl = document.getElementById('deadline-timer');
    if (!bannerEl) return;

    // Formatting: Sat 17 Jan, 13:30
    const formatted = dateObj.toLocaleString('en-GB', {
        weekday: 'short',
        day: 'numeric',
        month: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false // Clean 24h format
    });

    bannerEl.innerHTML = `${name}: <span style="color: white; margin-left: 5px;">${formatted}</span>`;
}

// RUN ON LOAD
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', updateFPLDeadline);
} else {
    updateFPLDeadline();
}
