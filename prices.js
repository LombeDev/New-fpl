/**
 * KOPALA FPL - Deadline Engine Only
 */

const API_URL = "/api/fpl/bootstrap-static/"; 

/**
 * Fetches data and updates the deadline banner
 */
async function refreshDashboard() {
    console.log("Attempting to fetch deadline data...");
    
    try {
        const response = await fetch(API_URL);
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status}`);
        }

        const data = await response.json();
        console.log("Data received successfully:", data);

        updateDeadline(data);

    } catch (e) {
        console.error("Fetch failed:", e.message);
        document.getElementById('deadline-timer').innerText = "Error loading deadline";
    }
}

/**
 * Finds the next Gameweek and displays the deadline
 */
function updateDeadline(data) {
    // Find the event where 'is_next' is true
    const nextGw = data.events.find(event => event.is_next);
    const timerEl = document.getElementById('deadline-timer');

    if (nextGw && timerEl) {
        const deadlineDate = new Date(nextGw.deadline_time);
        
        // Format: "Fri 14 Jan, 20:30"
        const options = { 
            weekday: 'short', 
            day: 'numeric', 
            month: 'short', 
            hour: '2-digit', 
            minute: '2-digit' 
        };
        
        const formattedDate = deadlineDate.toLocaleDateString('en-GB', options);
        
        timerEl.innerText = `${nextGw.name}: ${formattedDate}`;
        console.log("Deadline updated to:", formattedDate);
    } else {
        console.warn("Could not find the next Gameweek in the data.");
    }
}

/**
 * LOGIN TRIGGER
 * This is what connects your button to the code
 */
function handleLogin() {
    const teamId = document.getElementById('team-id-input').value;
    if (!teamId) return alert("Please enter a Team ID");

    // Hide login, show dashboard
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';

    // Run the deadline fetch
    refreshDashboard();
}
