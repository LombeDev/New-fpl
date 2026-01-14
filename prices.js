/**
 * KOPALA FPL - Ultimate Home Dashboard (v4.0)
 */

// IMPORTANT: Match this to your Netlify proxy path
const API_BASE = "/api/fpl/"; 
let teamMap = {};

/**
 * LOGIN TRIGGER
 * Connects your HTML "Continue" button to the dashboard logic
 */
async function handleLogin() {
    const teamId = document.getElementById('team-id-input').value;
    if (!teamId) return alert("Please enter your Team ID");

    // Transition UI
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';

    // Start the FPL Engine
    init();
}

async function init() {
    const CACHE_KEY = "fpl_bootstrap_cache";
    const LOCK_KEY = 'fpl_api_blocked_until';

    // 1. Rate Limit Guard
    const blockedUntil = localStorage.getItem(LOCK_KEY);
    if (blockedUntil && Date.now() < parseInt(blockedUntil)) {
        loadFromCacheOnly(); 
        return;
    }

    try {
        // 2. Cache Logic (10-minute window)
        const cached = localStorage.getItem(CACHE_KEY);
        let data;

        if (cached) {
            const parsed = JSON.parse(cached);
            if (Date.now() - parsed.timestamp < 10 * 60 * 1000) {
                data = parsed.content;
            }
        }

        // 3. Fetch Data
        if (!data) {
            // Using bootstrap-static endpoint
            const response = await fetch(`${API_BASE}bootstrap-static/`);

            if (response.status === 429) {
                const coolDownTime = Date.now() + (30 * 60 * 1000); 
                localStorage.setItem(LOCK_KEY, coolDownTime.toString());
                throw new Error("429");
            }

            if (!response.ok) throw new Error(`HTTP ${response.status}`);

            data = await response.json();
            
            localStorage.setItem(CACHE_KEY, JSON.stringify({
                timestamp: Date.now(),
                content: data
            }));
        }

        processAndRender(data);

    } catch (err) {
        console.error("Init failed:", err.message);
        loadFromCacheOnly(); 
    }
}

function processAndRender(data) {
    // Build Team Map (ID -> Short Name)
    data.teams.forEach(t => teamMap[t.id] = t.short_name);

    renderDeadline(data.events);
    // You can add back the other render functions (Prices, King, etc.) here
}

function loadFromCacheOnly() {
    const cached = localStorage.getItem("fpl_bootstrap_cache");
    if (cached) {
        const parsed = JSON.parse(cached);
        processAndRender(parsed.content);
    }
}

/**
 * 1. COUNTDOWN TIMER
 */
function renderDeadline(events) {
    // Find next GW that hasn't finished
    const nextGW = events.find(e => !e.finished);
    if (!nextGW) return;

    // TARGET: Match the ID in your HTML
    const el = document.getElementById("deadline-timer");
    
    const deadline = new Date(nextGW.deadline_time).getTime();

    const update = () => {
        const now = new Date().getTime();
        const diff = deadline - now;

        if (diff <= 0) {
            if (el) el.innerHTML = "Deadline Passed";
            return;
        }

        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        if (el) {
            el.innerHTML = `${nextGW.name}: ${d}d ${h}h ${m}m ${s}s`;
        }
    };

    update();
    setInterval(update, 1000);
}
