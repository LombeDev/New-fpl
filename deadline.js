async function loadDeadlines() {
    try {
        const res = await fetch(`${state.PROXY}bootstrap-static/`);
        const data = await res.json();
        
        // Find the next deadline (first event where is_next is true or deadline hasn't passed)
        const upcomingEvents = data.events.filter(e => new Date(e.deadline_time) > new Date());
        const nextEvent = upcomingEvents[0];

        // 1. Set Labels
        document.getElementById('next-gw-label').innerText = nextEvent.name;

        // 2. Start Countdown
        startDeadlineCountdown(nextEvent.deadline_time);

        // 3. Render Upcoming List (Next 4)
        const listHtml = upcomingEvents.slice(1, 5).map(e => {
            const date = new Date(e.deadline_time);
            const dateStr = date.toLocaleDateString('en-GB', { 
                weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' 
            });
            return `
                <div class="deadline-row">
                    <b>${e.name}</b>
                    <span>${dateStr}</span>
                </div>
            `;
        }).join('');
        document.getElementById('upcoming-list').innerHTML = listHtml;

    } catch (err) {
        console.error("Deadline Load Error:", err);
    }
}

function startDeadlineCountdown(deadlineStr) {
    const target = new Date(deadlineStr).getTime();

    const timer = setInterval(() => {
        const now = new Date().getTime();
        const diff = target - now;

        if (diff < 0) {
            clearInterval(timer);
            return;
        }

        const d = Math.floor(diff / (1000 * 60 * 60 * 24));
        const h = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const m = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const s = Math.floor((diff % (1000 * 60)) / 1000);

        document.getElementById('days').innerText = d.toString().padStart(2, '0');
        document.getElementById('hours').innerText = h.toString().padStart(2, '0');
        document.getElementById('minutes').innerText = m.toString().padStart(2, '0');
        document.getElementById('seconds').innerText = s.toString().padStart(2, '0');
    }, 1000);
}

// Call this inside your existing init()
loadDeadlines();
