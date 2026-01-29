/**
 * deadline.js - FPL Deadline Countdown Component
 */

async function initDeadlineComponent() {
    const container = document.getElementById('deadline-container');
    if (!container) return;

    // Use the same proxy as your other scripts
    const PROXY = "/.netlify/functions/fpl-proxy?endpoint=bootstrap-static/";

    try {
        const res = await fetch(PROXY);
        const data = await res.json();
        
        // Find the next upcoming event
        const now = new Date();
        const upcomingEvents = data.events.filter(e => new Date(e.deadline_time) > now);
        const nextEvent = upcomingEvents[0];

        if (!nextEvent) return;

        // Inject the HTML Structure
        container.innerHTML = `
            <div class="deadline-section">
                <div class="deadline-card">
                    <h2 class="deadline-title">Next Deadline</h2>
                    <div class="gw-subtitle">${nextEvent.name}</div>
                    
                    <div class="countdown-container">
                        <div class="time-unit"><span id="dl-days">00</span><label>Days</label></div>
                        <div class="time-separator">:</div>
                        <div class="time-unit"><span id="dl-hours">00</span><label>Hours</label></div>
                        <div class="time-separator">:</div>
                        <div class="time-unit"><span id="dl-minutes">00</span><label>Minutes</label></div>
                        <div class="time-separator">:</div>
                        <div class="time-unit"><span id="dl-seconds">00</span><label>Seconds</label></div>
                    </div>
                </div>

                <div class="upcoming-deadlines">
                    <h3 class="upcoming-title">Upcoming Deadlines</h3>
                    <div class="deadline-table-header">
                        <span>Gameweek</span>
                        <span>Deadline</span>
                    </div>
                    <div id="upcoming-list">
                        ${upcomingEvents.slice(1, 5).map(e => {
                            const date = new Date(e.deadline_time);
                            const formattedDate = date.toLocaleDateString('en-GB', { 
                                weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
                            });
                            return `
                                <div class="deadline-row">
                                    <b>${e.name}</b>
                                    <span>${formattedDate.replace(',', '')}</span>
                                </div>
                            `;
                        }).join('')}
                    </div>
                </div>
            </div>
        `;

        startCountdown(nextEvent.deadline_time);

    } catch (err) {
        console.error("Failed to load deadline data:", err);
        container.innerHTML = '<p style="font-size:0.7rem; color:red;">Deadline data unavailable.</p>';
    }
}

function startCountdown(deadlineStr) {
    const target = new Date(deadlineStr).getTime();

    const updateTimer = () => {
        const now = new Date().getTime();
        const diff = target - now;

        if (diff <= 0) {
            location.reload(); // Refresh when deadline passes
            return;
        }

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        const daysEl = document.getElementById('dl-days');
        const hoursEl = document.getElementById('dl-hours');
        const minsEl = document.getElementById('dl-minutes');
        const secsEl = document.getElementById('dl-seconds');

        if(daysEl) daysEl.innerText = d.toString().padStart(2, '0');
        if(hoursEl) hoursEl.innerText = h.toString().padStart(2, '0');
        if(minsEl) minsEl.innerText = m.toString().padStart(2, '0');
        if(secsEl) secsEl.innerText = s.toString().padStart(2, '0');
    };

    updateTimer();
    setInterval(updateTimer, 1000);
}

// Initialize when the script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initDeadlineComponent);
} else {
    initDeadlineComponent();
}
