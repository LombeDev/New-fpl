/**
 * KOPALA FPL - Live Countdown Script
 */
let countdownInterval; // Global to allow clearing if needed

async function updateFPLDeadline() {
    const CACHE_KEY = "fpl_deadline_cache";
    const isLocal = window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1";
    const API_URL = isLocal 
        ? "https://api.allorigins.win/get?url=" + encodeURIComponent("https://fantasy.premierleague.com/api/bootstrap-static/")
        : "/fpl-api/bootstrap-static/";

    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error("Fetch failed");
        
        let data = await response.json();
        if (isLocal) data = JSON.parse(data.contents);

        const nextGW = data.events.find(e => e.is_next === true) || 
                       data.events.find(e => !e.finished && new Date(e.deadline_time) > new Date());

        if (nextGW) {
            const deadlineTime = new Date(nextGW.deadline_time).getTime();
            
            // Update the GW label once
            const gwLabel = document.getElementById('gw-label');
            if (gwLabel) gwLabel.innerText = nextGW.name.replace("Gameweek ", "GW ");

            // Start the live ticker
            startLiveCountdown(deadlineTime);
        }
    } catch (error) {
        console.error("Deadline Sync Error:", error);
    }
}

function startLiveCountdown(targetTime) {
    if (countdownInterval) clearInterval(countdownInterval);

    const timeDisplay = document.getElementById('deadline-date-time');

    function updateTick() {
        const now = new Date().getTime();
        const t = targetTime - now;

        if (t <= 0) {
            clearInterval(countdownInterval);
            timeDisplay.innerText = "Deadline Passed!";
            return;
        }

        const days = Math.floor(t / (1000 * 60 * 60 * 24));
        const hours = Math.floor((t % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((t % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((t % (1000 * 60)) / 1000);

        // Display format: 1d 04h 20m 15s
        timeDisplay.innerHTML = `
            ${days > 0 ? days + 'd ' : ''}
            ${String(hours).padStart(2, '0')}h 
            ${String(minutes).padStart(2, '0')}m 
            <span style="font-size: 0.8em; opacity: 0.8;">${String(seconds).padStart(2, '0')}s</span>
        `;
    }

    updateTick(); // Run once immediately
    countdownInterval = setInterval(updateTick, 1000);
}

// Start everything
document.addEventListener('DOMContentLoaded', updateFPLDeadline);
