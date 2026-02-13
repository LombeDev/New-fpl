const https = require('https');

exports.handler = async (event) => {
    const endpoint = event.queryStringParameters.endpoint;
    const url = `https://fantasy.premierleague.com/api/${endpoint}`;

    return new Promise((resolve, reject) => {
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                resolve({
                    statusCode: 200,
                    headers: {
                        "Access-Control-Allow-Origin": "*",
                        "Content-Type": "application/json"
                    },
                    body: data
                });
            });
        }).on('error', (e) => {
            resolve({
                statusCode: 500,
                body: JSON.stringify({ error: e.message })
            });
        });
    });
};



const fetch = require('node-fetch');
const { getStore } = require('@netlify/blobs');

exports.handler = async function(event, context) {
    try {
        const response = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
        
        // Check if FPL API actually returned JSON
        if (!response.ok) throw new Error('FPL API unreachable');
        const data = await response.json();

        // Netlify Blobs Logic for 2-day history
        const store = getStore("fpl_history");
        const todayStr = new Date().toISOString().split('T')[0];
        
        // Save today's data
        await store.setJSON(todayStr, { 
            date: todayStr, 
            changes: data.elements.filter(p => p.cost_change_event !== 0),
            teams: data.teams 
        });

        // Get yesterday's data
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().split('T')[0];
        const yesterdayData = await store.getJSON(yesterdayStr) || { changes: [], date: yesterdayStr };

        return {
            statusCode: 200,
            headers: {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            body: JSON.stringify({
                today: { 
                    date: todayStr, 
                    changes: data.elements.filter(p => p.cost_change_event !== 0),
                    teams: data.teams 
                },
                yesterday: yesterdayData
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ error: error.message, message: "Ensure your Netlify Function is correctly configured." })
        };
    }
}


