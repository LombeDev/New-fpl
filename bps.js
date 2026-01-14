/**
 * KOPALA FPL - PRO MATCH CENTER & DASHBOARD
 */

const FPL_PROXY = "/fpl-api/";
const FOOTBALL_PROXY = "/api/competitions/PL/";

let playerLookup = {};
let teamLookup = {};
let activeGameweek = null;
let refreshTimer = null;
let allMatches = [];
let currentViewGW = 21;

// 1. Initialize Everything
async function mainInit() {
    console.log("Initializing Dashboard...");
    await initMatchCenter(); // Load FPL Data first
    await initDashboard();    // Load Standings/Fixtures second
}

// 2. FPL Match Center Logic (The code you provided)
async function initMatchCenter() {
    try {
        const response = await fetch(`${FPL_PROXY}bootstrap-static/`);
        const data = await response.json();
        
        data.elements.forEach(p => playerLookup[p.id] = p.web_name);
        data.teams.forEach(t => teamLookup[t.id] = t.name);
        
        const current = data.events.find(e => e.is_current) || data.events.find(e => !e.finished);
        activeGameweek = current ? current.id : 1;
        updateLiveScores();
    } catch (error) {
        console.error("FPL Sync Error:", error);
    }
}

// 3. Dashboard Logic (Standings/Navigation)
async function initDashboard() {
    try {
        const response = await fetch(`${FOOTBALL_PROXY}matches`);
        const data = await response.json();
        allMatches = data.matches || [];
        renderFixtures(allMatches);
    } catch (err) {
        console.error("Dashboard Sync Error:", err);
    }
}

// ... Keep all your renderFixtures, updateLiveScores, and helper functions below ...

document.addEventListener('DOMContentLoaded', mainInit);
