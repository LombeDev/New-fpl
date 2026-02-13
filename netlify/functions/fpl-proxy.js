const fetch = require('node-fetch');

exports.handler = async function() {
    try {
        const response = await fetch('https://fantasy.premierleague.com/api/bootstrap-static/');
        const data = await response.json();

        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                changes: data.elements.filter(p => p.cost_change_event !== 0),
                teams: data.teams
            })
        };
    } catch (error) {
        return { statusCode: 500, body: error.toString() };
    }
}
