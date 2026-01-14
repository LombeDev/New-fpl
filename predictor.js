/**
 * KOPALA FPL - Price Predictor Engine (Full Version)
 * Version: 2.0 (Sortable, Searchable, Optimized)
 */

const PROXY = "https://corsproxy.io/?url=";
const API_URL = "https://fantasy.premierleague.com/api/bootstrap-static/";
const LOCK_KEY = 'fpl_api_blocked_until';
const CACHE_KEY = "fpl_bootstrap_cache";
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes cache freshness

// Global State
let allPlayers = [];
let currentSortColumn = 'progress';
let isAscending = false;

/**
 * Initialize the predictor on load
 */
async function initPredictor() {
    const loader = document.getElementById('loader');
    const blockedUntil = localStorage.getItem(LOCK_KEY);
    const cachedData = localStorage.getItem(CACHE_KEY);
    const now = Date.now();

    // 1. Check for Active Rate-Limit Lock
    if (blockedUntil && now < parseInt(blockedUntil)) {
        const remainingMin = Math.ceil((parseInt(blockedUntil) - now) / 60000);
        return loadFromCacheOnly(`⚠️ API Limit: Refresh in ${remainingMin}m`);
    }

    // 2. Check if Cache is fresh (under 10 mins)
    if (cachedData) {
        const { timestamp, content } = JSON.parse(cachedData);
        if (now - timestamp < CACHE_DURATION) {
            console.log("Using fresh cache...");
            processAndRender(content);
            if (loader) loader.style.display = 'none';
            setupEventListeners();
            return;
        }
    }

    try {
        // 3. Fetch from API
        const response = await fetch(PROXY + encodeURIComponent(API_URL));

        if (response.status === 429) {
            const coolDownTime = Date.now() + (30 * 60 * 1000); // 30 min lock
            localStorage.setItem(LOCK_KEY, coolDownTime.toString());
            throw new Error("API Limit reached");
        }

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);

        const data = await response.json();

        // 4. Save to Cache
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            timestamp: now,
            content: data
        }));

        processAndRender(data);
        if (loader) loader.style.display = 'none';
        setupEventListeners();

    } catch (e) {
        console.error("Fetch failed:", e.message);
        loadFromCacheOnly("⚠️ Offline Mode: Using Cached Data");
        setupEventListeners();
    }
}

/**
 * Shared processing logic
 */
function processAndRender(data) {
    const teamMap = new Map(data.teams.map(t => [t.id, t.short_name]));
    
    // Populate Team Filter Dropdown
    const teamFilter = document.getElementById('teamFilter');
    if (teamFilter && teamFilter.options.length <= 1) {
        data.teams.sort((a,b) => a.short_name.localeCompare(b.short_name))
                  .forEach(t => {
                      const opt = new Option(t.short_name, t.short_name);
                      teamFilter.add(opt);
                  });
    }

    // Map raw data to our usable objects
    allPlayers = data.elements
        .filter(p => p.transfers_in_event > 1000 || p.transfers_out_event > 1000)
        .map(p => {
            const netTransfers = p.transfers_in_event - p.transfers_out_event;
            const progress = (netTransfers / 40000) * 100; 
            
            return {
                name: p.web_name,
                team: teamMap.get(p.team) || "N/A",
                price: (p.now_cost / 10).toFixed(1),
                progress: parseFloat(progress.toFixed(1)),
                prediction: parseFloat((progress * 1.02).toFixed(1)),
                rate: (parseFloat(p.selected_by_percent) / 10).toFixed(2),
                pos: ["", "GKP", "DEF", "MID", "FWD"][p.element_type]
            };
        });

    sortAndRender();
    setupTableHeaders();
}

/**
 * Filter and Sort logic
 */
function sortAndRender() {
    const searchTerm = document.getElementById('playerSearch').value.toLowerCase();
    const teamTerm = document.getElementById('teamFilter').value;

    let filtered = allPlayers.filter(p => {
        const matchesName = p.name.toLowerCase().includes(searchTerm);
        const matchesTeam = teamTerm === "All" || p.team === teamTerm;
        return matchesName && matchesTeam;
    });

    // Apply Sorting
    filtered.sort((a, b) => {
        let valA = a[currentSortColumn];
        let valB = b[currentSortColumn];

        if (typeof valA === 'string') {
            return isAscending ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }
        return isAscending ? valA - valB : valB - valA;
    });

    renderTable(filtered);
    updateHeaderIcons();
}

/**
 * Visual Render
 */
function renderTable(players) {
    const body = document.getElementById('predictor-body');
    if (!body) return;
    
    body.innerHTML = players.map(p => {
        const isRising = p.prediction >= 100;
        const isFalling = p.prediction <= -100;
        const trendClass = p.progress >= 0 ? 'trend-up' : 'trend-down';
        const barColor = p.progress >= 0 ? 'var(--fpl-primary)' : '#ff005a';
        const visualWidth = Math.min(Math.abs(p.progress), 100);

        return `
            <tr>
                <td>
                    <strong>${p.name}</strong><br>
                    <small>${p.pos} £${p.price}</small>
                </td>
                <td>${p.team}</td>
                <td>
                    <span class="${trendClass}">${p.progress}%</span>
                    <div style="width: 80px; background: var(--fpl-border); height: 6px; border-radius: 10px; margin-top: 4px;">
                        <div style="width: ${visualWidth}%; background: ${barColor}; height: 100%; border-radius: 10px;"></div>
                    </div>
                </td>
                <td class="${isRising ? 'rise-cell' : (isFalling ? 'fall-cell' : '')}">
                    <strong>${p.prediction}%</strong>
                    ${(isRising || isFalling) ? '<br><span class="live-badge">TONIGHT</span>' : ''}
                </td>
                <td>
                    <span class="${trendClass}">${p.progress >= 0 ? '+' : ''}${p.rate}%</span>
                </td>
            </tr>
        `;
    }).join('');
}

/**
 * Table Header Logic
 */
function setupTableHeaders() {
    const headers = document.querySelectorAll('#predictor-table th');
    const keyMap = ['name', 'team', 'progress', 'prediction', 'rate'];

    headers.forEach((header, index) => {
        header.style.cursor = 'pointer';
        header.onclick = () => {
            const sortKey = keyMap[index];
            if (currentSortColumn === sortKey) {
                isAscending = !isAscending;
            } else {
                currentSortColumn = sortKey;
                isAscending = false; // Default to Descending for new columns
            }
            sortAndRender();
        };
    });
}

function updateHeaderIcons() {
    const headers = document.querySelectorAll('#predictor-table th');
    const keyMap = ['name', 'team', 'progress', 'prediction', 'rate'];
    headers.forEach((header, index) => {
        header.innerHTML = header.innerHTML.replace(/ [▲▼]/g, '');
        if (keyMap[index] === currentSortColumn) {
            header.innerHTML += isAscending ? ' ▲' : ' ▼';
        }
    });
}

/**
 * Fallback / Cache Mode
 */
function loadFromCacheOnly(statusMsg) {
    const loader = document.getElementById('loader');
    const cached = localStorage.getItem(CACHE_KEY);
    
    if (cached) {
        const parsed = JSON.parse(cached);
        processAndRender(parsed.content);
        if (loader) {
            loader.style.background = "rgba(255, 165, 0, 0.1)";
            loader.innerHTML = `<span style="color: var(--fpl-on-container); font-weight:bold;">${statusMsg}</span>`;
            setTimeout(() => loader.style.display = 'none', 5000);
        }
    }
}

/**
 * Event Listeners and Timer
 */
function setupEventListeners() {
    document.getElementById('playerSearch').addEventListener('input', sortAndRender);
    document.getElementById('teamFilter').addEventListener('change', sortAndRender);
}

function updateTimer() {
    const now = new Date();
    const target = new Date();
    target.setUTCHours(2, 30, 0, 0); 
    if (now > target) target.setDate(target.getDate() + 1);

    const diff = target - now;
    const h = Math.floor(diff / 3600000);
    const m = Math.floor((diff % 3600000) / 60000);
    const s = Math.floor((diff % 60000) / 1000);

    const timerEl = document.getElementById('timer');
    if (timerEl) {
        timerEl.textContent = `${h}h ${m}m ${s}s`;
    }
}

// Start
setInterval(updateTimer, 1000);
initPredictor();



/**
 * Back to Top Logic for Scrollable Container
 */
const scrollContainer = document.querySelector('.table-container');
const backToTopBtn = document.getElementById('backToTop');

if (scrollContainer && backToTopBtn) {
    // Show button when scrolling down 300px inside the container
    scrollContainer.addEventListener('scroll', () => {
        if (scrollContainer.scrollTop > 300) {
            backToTopBtn.style.display = 'flex';
        } else {
            backToTopBtn.style.display = 'none';
        }
    });

    // Scroll back to top smoothly when clicked
    backToTopBtn.addEventListener('click', () => {
        scrollContainer.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}
