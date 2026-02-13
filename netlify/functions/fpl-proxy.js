const fetch = require('node-fetch');
const { getStore } = require('@netlify/blobs');

exports.handler = async function(event, context) {
    try {
        // 1. Fetch live data from FPL
        const response = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
        if (!response.ok) throw new Error(`FPL API responded with status: ${response.status}`);
        
        const data = await response.json();
        const todayStr = new Date().toISOString().split('T')[0];
        const todayChanges = data.elements.filter(p => p.cost_change_event !== 0);

        // 2. Access Blob Store
        // Note: Blobs require a site to be linked to Netlify. 
        // If this part fails, we still want the 'Today' data to work.
        let yesterdayData = { changes: [], date: "" };
        
        try {
            const store = getStore("fpl_history");
            
            // Save today's data for future "yesterday" lookups
            await store.setJSON(todayStr, { 
                date: todayStr, 
                changes: todayChanges,
                teams: data.teams 
            });

            // Try to get yesterday's date
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().split('T')[0];
            
            const savedYesterday = await store.getJSON(yesterdayStr);
            if (savedYesterday) yesterdayData = savedYesterday;

        } catch (blobError) {
            console.error("Blob Store Error (Expected on first run):", blobError);
            // We don't throw here; we want the function to continue even if Blobs fail
        }

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                today: { 
                    date: todayStr, 
                    changes: todayChanges,
                    teams: data.teams 
                },
                yesterday: yesterdayData
            })
        };

    } catch (error) {
        console.error("Function Crash:", error);
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: "Internal Server Error", details: error.message })
        };
    }
}
