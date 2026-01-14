/**
 * KOPALA FPL - Deadline Engine
 * Focus: Correct GW Detection & Countdown
 */

const API_URL = "/api/fpl/bootstrap-static/"; 
let deadlineInterval; // To clear the timer if needed

/**
 * 1. MAIN INITIALIZER
 */
async function refreshDashboard() {
    try {
        const response = await fetch(API_URL);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        
        const data = await response.json();
        
        // Find the next Gameweek
        const nextGw = data.events.find(event => event.is_next);
        
        if (nextGw) {
            startDeadlineCountdown(nextGw);
        } else {
            document.getElementById('deadline-timer').innerText = "Season Finished or Updating";
        }

    } catch (e) {
        console.error("Deadline Fetch Failed:", e);
        document.getElementById('deadline-timer').innerText = "⚠️ Offline";
    }
}

/**
 * 2. COUNTDOWN LOGIC
 * Updates the UI every second with time remaining
 */
function startDeadlineCountdown(gwData) {
    const deadlineTime = new Date(gwData.deadline_time).getTime();
    const timerEl = document.getElementById('deadline-timer');

    // Clear any existing interval
    if (deadlineInterval) clearInterval(deadlineInterval);

    deadlineInterval = setInterval(() => {
        const now = new Date().getTime();
        const distance = deadlineTime - now;

        if (distance < 0) {
            clearInterval(deadlineInterval);
            timerEl.innerText = `${gwData.name} Passed`;
            return;
        }

        // Calculations for days, hours, minutes
        const days = Math.floor(distance / (1000 * 60 * 60 * 24));
        const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));

        // Format string: "GW18: 2d 04h 20m"
        timerEl.innerText = `${gwData.name}: ${days}d ${hours}h ${minutes}m`;
    }, 1000);
}

/**
 * 3. UI HANDLERS
 */
function handleLogin() {
    const teamId = document.getElementById('team-id-input').value;
    if (!teamId) return alert("Please enter your Team ID");

    // Transition UI
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';

    // Run the feature
    refreshDashboard();
}

// Global reset function (for your Logout button)
function resetApp() {
    location.reload();
}

// Helper for the settings drawer toggle
function toggleSettings() {
    const drawer = document.getElementById('settings-drawer');
    const overlay = document.getElementById('drawer-overlay');
    drawer.classList.toggle('open');
    overlay.style.display = drawer.classList.contains('open') ? 'block' : 'none';
}
