/**
 * KOPALA FPL - Unified Dashboard Engine
 * Features: Deadline, Market Changes, and Price Predictor
 */

// Configuration
const API_URL = "/api/fpl/bootstrap-static/"; 
const LOCK_KEY = 'fpl_api_blocked_until';
const CACHE_KEY = "fpl_bootstrap_cache";
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes

// Predictor Global State
let allPlayers = [];
let currentSortColumn = 'progress';
let isAscending = false;

/**
 * MAIN DASHBOARD INITIALIZER
 * Call this when the user logs in or page loads
 */
async function refreshDashboard() {
    const blockedUntil = localStorage.getItem(LOCK_KEY);
    const cachedData = localStorage.getItem(CACHE_KEY);
    const now = Date.now();

    // 1. Check Rate-Limit Lock
    if (blockedUntil && now < parseInt(blockedUntil)) {
        const remainingMin = Math.ceil((parseInt(blockedUntil) - now) / 60000);
        return loadFromCacheOnly(`⚠️ API Limit: Wait ${remainingMin}m`);
    }

    // 2. Check fresh cache
    if (cachedData) {
        const { timestamp, content } = JSON.parse(cachedData);
        if (now - timestamp < CACHE_DURATION) {
            console.log("Using fresh cache...");
            updateDeadline(content);
            updateMarketToday(content);
            processAndRenderPredictor(content);
            setupEventListeners();
            return;
        }
    }

    try {
        const response = await fetch(API_URL);

        if (response.status === 429) {
            localStorage.setItem(LOCK_KEY, (Date.now() + 30 * 60 * 1000).toString());
            throw new Error("Rate limit");
        }

        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();

        // Save to cache
        localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: now, content: data }));

        // Update all UI components
        updateDeadline(data);
        updateMarketToday(data);
        processAndRenderPredictor(data);
        setupEventListeners();

        if (document.getElementById('loader')) document.getElementById('loader').style.display = 'none';

    } catch (e) {
        console.error("Dashboard Sync Failed:", e);
        loadFromCacheOnly("⚠️ Offline Mode: Data may be old");
    }
}

/**
 * 1. DEADLINE LOGIC
 */
function updateDeadline(data) {
    const nextGw = data.events.find(event => event.is_next);
    const timerEl = document.getElementById('deadline-timer');
    if (nextGw && timerEl) {
        const deadlineDate = new Date(nextGw.deadline_time);
        const options = { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
        timerEl.innerText = `${nextGw.name}: ${deadlineDate.toLocaleDateString('en-GB', options)}`;
    }
}

/**
 * 2. MARKET TODAY (ACTUAL RISERS/FALLERS)
 */
function updateMarketToday(data) {
    const players = data.elements;
    const risers = players.filter(p => p.cost_change_event > 0).sort((a,b) => b.cost_change_event - a.cost_change_event).slice(0, 5);
    const fallers = players.filter(p => p.cost_change_event < 0).sort((a,b) => a.cost_change_event - b.cost_change_event).slice(0, 5);

    const formatLi = (p, color) => `<li style="display:flex; justify-content:space-between; margin-bottom:6px;">
        <span>${p.web_name}</span> <b style="color:${color};">${p.cost_change_event > 0 ? '+' : ''}£${p.cost_change_event/10}</b>
    </li>`;

    document.getElementById('risers-list').innerHTML = risers.length ? risers.map(p => formatLi(p, '#00d46a')).join('') : '<li>No risers today</li>';
    document.getElementById('fallers-list').innerHTML = fallers.length ? fallers.map(p => formatLi(p, '#e90052')).join('') : '<li>No fallers today</li>';
}

/**
 * 3. PREDICTOR ENGINE LOGIC
 */
function processAndRenderPredictor(data) {
    const teamMap = new Map(data.teams.map(t => [t.id, t.short_name]));
    
    // Fill Team Dropdown
    const teamFilter = document.getElementById('teamFilter');
    if (teamFilter && teamFilter.options.length <= 1) {
        data.teams.sort((a,b) => a.short_name.localeCompare(b.short_name))
            .forEach(t => teamFilter.add(new Option(t.short_name, t.short_name)));
    }

    allPlayers = data.elements
        .filter(p => Math.abs(p.transfers_in_event - p.transfers_out_event) > 500) // Performance filter
        .map(p => {
            const netTransfers = p.transfers_in_event - p.transfers_out_event;
            // Baseline algorithm: 40k net transfers as threshold
            const progress = (netTransfers / 40000) * 100; 
            return {
                name: p.web_name,
                team: teamMap.get(p.team) || "N/A",
                price: (p.now_cost / 10).toFixed(1),
                progress: parseFloat(progress.toFixed(1)),
                prediction: parseFloat((progress * 1.02).toFixed(1)), // Slight bias for prediction
                rate: (parseFloat(p.selected_by_percent)).toFixed(1),
                pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type]
            };
        });

    sortAndRender();
    setupTableHeaders();
}

function sortAndRender() {
    const searchTerm = document.getElementById('playerSearch')?.value.toLowerCase() || "";
    const teamTerm = document.getElementById('teamFilter')?.value || "All";

    let filtered = allPlayers.filter(p => {
        return p.name.toLowerCase().includes(searchTerm) && (teamTerm === "All" || p.team === teamTerm);
    });

    filtered.sort((a, b) => {
        let valA = a[currentSortColumn];
        let valB = b[currentSortColumn];
        if (typeof valA === 'string') return isAscending ? valA.localeCompare(valB) : valB.localeCompare(valA);
        return isAscending ? valA - valB : valB - valA;
    });

    renderTable(filtered);
}

function renderTable(players) {
    const body = document.getElementById('predictor-body');
    if (!body) return;
    
    body.innerHTML = players.map(p => {
        const isRising = p.prediction >= 100;
        const isFalling = p.prediction <= -100;
        const trendClass = p.progress >= 0 ? 'trend-up' : 'trend-down';
        const barColor = p.progress >= 0 ? 'var(--fpl-green)' : 'var(--fpl-pink)';
        const visualWidth = Math.min(Math.abs(p.progress), 100);

        return `
            <tr>
                <td><strong>${p.name}</strong><br><small>${p.pos} £${p.price}</small></td>
                <td>${p.team}</td>
                <td>
                    <span class="${trendClass}">${p.progress}%</span>
                    <div style="width: 60px; background: #eee; height: 4px; border-radius: 4px; margin-top: 4px;">
                        <div style="width: ${visualWidth}%; background: ${barColor}; height: 100%;"></div>
                    </div>
                </td>
                <td class="${isRising ? 'rise-cell' : (isFalling ? 'fall-cell' : '')}">
                    <strong>${p.prediction}%</strong>
                    ${(isRising || isFalling) ? '<br><span class="live-badge">TONIGHT</span>' : ''}
                </td>
                <td>${p.rate}%</td>
            </tr>
        `;
    }).join('');
}

/**
 * 4. UTILITIES (TIMER & EVENTS)
 */
function updateTimer() {
    const now = new Date();
    const target = new Date();
    target.setUTCHours(2, 30, 0, 0); // FPL Price change usually 2:30 AM UK
    if (now > target) target.setDate(target.getDate() + 1);

    const diff = target - now;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    const timerEl = document.getElementById('timer');
    if (timerEl) timerEl.textContent = `${h}h ${m}m ${s}s`;
}

function setupEventListeners() {
    document.getElementById('playerSearch')?.addEventListener('input', sortAndRender);
    document.getElementById('teamFilter')?.addEventListener('change', sortAndRender);
}

function setupTableHeaders() {
    const headers = document.querySelectorAll('#predictor-table th');
    const keyMap = ['name', 'team', 'progress', 'prediction', 'rate'];
    headers.forEach((header, i) => {
        header.onclick = () => {
            currentSortColumn = keyMap[i];
            isAscending = !isAscending;
            sortAndRender();
        };
    });
}

function loadFromCacheOnly(msg) {
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
        const data = JSON.parse(cached).content;
        updateDeadline(data);
        updateMarketToday(data);
        processAndRenderPredictor(data);
    }
}

// Start Timers
setInterval(updateTimer, 1000);

// Call refreshDashboard() inside your existing handleLogin() function!
