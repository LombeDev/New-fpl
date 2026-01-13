/**
 * KOPALA FPL - Netlify Integrated Edition
 */

const state = {
    fplId: localStorage.getItem('kopala_fpl_id') || null,
    playerMap: {}, 
    currentGW: 1, 
};

// 1. THE PROXY CONFIG (Crucial for Netlify)
const PROXY_ENDPOINT = "/.netlify/functions/fpl-proxy?endpoint=";

document.addEventListener('DOMContentLoaded', async () => {
    initNavigation();
    initPWAInstall();
    initScrollUtilities();
    
    // Load Player Database & detect current GW
    await loadPlayerDatabase();

    initDashboardLogic();

    // Auto-load if ID exists
    if (state.fplId) {
        renderView('dashboard');
    }
});

/**
 * DATA ENGINE - Now using Netlify Functions
 */
async function loadPlayerDatabase() {
    try {
        const response = await fetch(`${PROXY_ENDPOINT}bootstrap-static/`);
        const data = await response.json();
        
        data.elements.forEach(p => {
            state.playerMap[p.id] = p.web_name;
        });

        const activeGW = data.events.find(e => e.is_current) || data.events.find(e => e.is_next);
        if (activeGW) state.currentGW = activeGW.id;
        
    } catch (err) {
        console.error("FPL Database Sync Failed", err);
    }
}

async function fetchLiveFPLData() {
    if (!state.fplId) return;
    
    const dispName = document.getElementById('disp-name');
    if (dispName) dispName.textContent = "Syncing Live Stats...";

    const managerUrl = `entry/${state.fplId}/`;
    const picksUrl = `entry/${state.fplId}/event/${state.currentGW}/picks/`;

    try {
        const mResp = await fetch(`${PROXY_ENDPOINT}${managerUrl}`);
        const mData = await mResp.json();

        const pResp = await fetch(`${PROXY_ENDPOINT}${picksUrl}`);
        const pData = await pResp.json();

        // UI Updates
        updateDashboardUI(mData, pData);

        // Fetch Bonus Points
        fetchLiveBPS();

    } catch (err) {
        if (dispName) dispName.textContent = "Team ID Not Found";
        console.error("Dashboard Sync Error:", err);
    }
}

function updateDashboardUI(mData, pData) {
    const nameEl = document.getElementById('disp-name');
    if (nameEl) nameEl.textContent = `${mData.player_first_name} ${mData.player_last_name}`;
    
    document.getElementById('disp-gw').textContent = mData.summary_event_points || 0;
    document.getElementById('disp-total').textContent = mData.summary_overall_points.toLocaleString();
    
    // Live Rank Scaling logic from your Kopala script
    const rankEl = document.getElementById('disp-rank');
    const rankText = mData.summary_overall_rank ? mData.summary_overall_rank.toLocaleString() : "N/A";
    rankEl.textContent = rankText;
    
    if (rankText.length > 8) {
        rankEl.style.fontSize = "0.85rem";
    } else if (rankText.length > 6) {
        rankEl.style.fontSize = "1rem";
    }

    // Transfers & Hits
    const tx = pData.entry_history.event_transfers || 0;
    const cost = pData.entry_history.event_transfers_cost || 0;
    document.getElementById('disp-transfers').textContent = cost > 0 ? `${tx} (-${cost})` : `${tx}`;
}

async function fetchLiveBPS() {
    try {
        const response = await fetch(`${PROXY_ENDPOINT}event/${state.currentGW}/live/`);
        const data = await response.json();

        const topPerformers = data.elements
            .sort((a, b) => b.stats.bps - a.stats.bps)
            .slice(0, 3);

        const bpsList = document.getElementById('bps-list');
        if (bpsList) {
            bpsList.innerHTML = `<p class="bps-header">Top Bonus (GW${state.currentGW})</p>` + 
            topPerformers.map(p => `
                <div class="bps-item">
                    <span>${state.playerMap[p.id] || 'Unknown'}</span>
                    <span class="bps-val">+${p.stats.bps} BPS</span>
                </div>
            `).join('');
        }
    } catch (err) {
        console.error("Live BPS Sync Error", err);
    }
}

// ... Keep your initDashboardLogic, renderView, and Navigation functions from your snippet below this line
