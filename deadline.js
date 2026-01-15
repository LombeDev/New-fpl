/**
 * script.js
 */
async function updateFPLDeadline() {
    const bannerEl = document.getElementById('deadline-timer');
    const CACHE_KEY = "fpl_deadline_data";
    
    // Call YOUR domain path, Netlify handles the rest!
    const API_URL = "/fpl-api/bootstrap-static/"; 

    // 1. Check Cache
    const cached = localStorage.getItem(CACHE_KEY);
    const now = new Date();

    if (cached) {
        const data = JSON.parse(cached);
        const deadlineDate = new Date(data.deadline_time);
        if (now < deadlineDate) {
            renderBanner(data.name, deadlineDate);
            return; 
        }
    }

    // 2. Fetch via Netlify Rewrite
    try {
        const response = await fetch(API_URL); // No CORS error now!
        if (!response.ok) throw new Error("HTTP Error " + response.status);
        
        const data = await response.json();
        const nextGW = data.events.find(e => e.is_next === true);

        if (nextGW) {
            const newData = { name: nextGW.name, deadline_time: nextGW.deadline_time };
            localStorage.setItem(CACHE_KEY, JSON.stringify(newData));
            renderBanner(newData.name, new Date(newData.deadline_time));
        }
    } catch (error) {
        console.error("FPL Fetch Error:", error);
    }
}

function renderBanner(name, dateObj) {
    const bannerEl = document.getElementById('deadline-timer');
    const formatted = dateObj.toLocaleString('en-GB', {
        weekday: 'short', day: 'numeric', month: 'short', 
        hour: '2-digit', minute: '2-digit', hour12: true
    });
    bannerEl.innerText = `${name}: ${formatted}`;
}

document.addEventListener('DOMContentLoaded', updateFPLDeadline);
