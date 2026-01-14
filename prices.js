/**
 * KOPALA FPL - Fixed Deadline & Bootstrap Engine
 */

const API_BASE = "/api/fpl/"; 
let teamMap = {};

/**
 * TRIGGER: Called by your "Continue" button
 */
async function handleLogin() {
    const teamId = document.getElementById('team-id-input').value;
    if (!teamId) return alert("Please enter your Team ID");

    // Show Dashboard
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';

    // Start Data Sync
    init();
}

async function init() {
    const CACHE_KEY = "fpl_bootstrap_cache";
    const now = Date.now();

    try {
        // 1. Try Cache first
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) {
            const parsed = JSON.parse(cached);
            if (now - parsed.timestamp < 10 * 60 * 1000) { // 10 min cache
                processAndRender(parsed.content);
                return;
            }
        }

        // 2. Fetch fresh data
        const response = await fetch(`${API_BASE}bootstrap-static/`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        
        // 3. Save to Cache
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: now,
            content: data
        }));

        processAndRender(data);

    } catch (err) {
        console.error("FPL Sync Failed:", err);
        // Fallback to old cache if network fails
        const cached = localStorage.getItem(CACHE_KEY);
        if (cached) processAndRender(JSON.parse(cached).content);
    }
}

function processAndRender(data) {
    // Map team IDs to names (e.g., 1 -> "ARS")
    data.teams.forEach(t => teamMap[t.id] = t.short_name);

    // Run Deadline Feature
    renderDeadline(data.events);
}

/**
 * DEADLINE FEATURE
 * Matches ID: "deadline-timer"
 */
function renderDeadline(events) {
    // Find the next active Gameweek
    const nextGW = events.find(e => !e.finished && new Date(e.deadline_time) > new Date());
    if (!nextGW) return;

    const timerEl = document.getElementById("deadline-timer");
    const deadlineTime = new Date(nextGW.deadline_time).getTime();

    const updateTimer = () => {
        const now = new Date().getTime();
        const diff = deadlineTime - now;

        if (diff <= 0) {
            if (timerEl) timerEl.innerHTML = "Deadline Passed";
            return;
        }

        const d = Math.floor(diff / 86400000);
        const h = Math.floor((diff % 86400000) / 3600000);
        const m = Math.floor((diff % 3600000) / 60000);
        const s = Math.floor((diff % 60000) / 1000);

        if (timerEl) {
            // Simple, clean format for your green banner
            timerEl.innerHTML = `${nextGW.name}: ${d}d ${h}h ${m}m ${s}s`;
        }
    };

    updateTimer();
    setInterval(updateTimer, 1000);
}

/**
 * UTILS
 */
function toggleSettings() {
    const drawer = document.getElementById('settings-drawer');
    const overlay = document.getElementById('drawer-overlay');
    const isOpen = drawer.classList.contains('open');
    
    if (isOpen) {
        drawer.classList.remove('open');
        overlay.style.display = 'none';
    } else {
        drawer.classList.add('open');
        overlay.style.display = 'block';
    }
}

function resetApp() {
    localStorage.clear();
    location.reload();
}
