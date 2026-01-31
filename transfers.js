/**
 * transfers.js - Top Transfers In/Out Component
 */

async function initTransfersComponent() {
    const container = document.getElementById('transfers-container');
    if (!container) return;

    const PROXY = "/.netlify/functions/fpl-proxy?endpoint=bootstrap-static/";

    try {
        const res = await fetch(PROXY);
        const data = await res.json();
        
        const players = data.elements;
        const teams = {};
        data.teams.forEach(t => teams[t.id] = { name: t.short_name, code: t.code });

        // Sort Top 5 In and Top 5 Out
        const topIn = [...players].sort((a, b) => b.transfers_in_event - a.transfers_in_event).slice(0, 5);
        const topOut = [...players].sort((a, b) => b.transfers_out_event - a.transfers_out_event).slice(0, 5);

        container.innerHTML = `
            ${renderTransferCard("Top Transfers in this Gameweek", topIn, teams, true)}
            ${renderTransferCard("Top Transfers out this Gameweek", topOut, teams, false)}
        `;

    } catch (err) {
        console.error("Transfers Load Error:", err);
    }
}

function renderTransferCard(title, list, teams, isIn) {
    const iconClass = isIn ? 'fa-arrow-right' : 'fa-arrow-left';
    const arrowColor = isIn ? '#10b981' : '#e90052';

    return `
        <div class="transfer-card-wrapper">
            <div class="transfer-card-header">
                <h3>${title}</h3>
                
            </div>
            <div class="transfer-table-head">
                <span>Player</span>
                <span style="text-align:right">Transferred</span>
            </div>
            <div class="transfer-list">
                ${list.map(p => {
                    const team = teams[p.team];
                    const pos = ["", "GKP", "DEF", "MID", "FWD"][p.element_type];
                    const count = isIn ? p.transfers_in_event : p.transfers_out_event;
                    
                    return `
                        <div class="transfer-item-row">
                            <div class="player-info-side">
                                <i class="fa-solid fa-info-circle info-icon"></i>
                                <i class="fa-solid ${iconClass} small-arrow" style="color:${arrowColor}"></i>
                                <img src="https://draft.premierleague.com/img/shirts/standard/shirt_${team.code}${p.element_type === 1 ? '_1' : ''}-66.png" class="mini-shirt">
                                <div class="player-text">
                                    <span class="p-name">${p.web_name}</span>
                                    <span class="p-team">${team.name} | ${pos}</span>
                                </div>
                            </div>
                            <div class="transfer-count">${count.toLocaleString()}</div>
                        </div>
                    `;
                }).join('')}
            </div>
        </div>
    `;
}

document.addEventListener('DOMContentLoaded', initTransfersComponent);
