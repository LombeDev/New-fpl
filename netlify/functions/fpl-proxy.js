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




// netlify/functions/fpl-proxy.js
const axios = require('axios');

exports.handler = async (event) => {
    const path = event.path.replace('/.netlify/functions/fpl-proxy', '');
    const url = `https://fantasy.premierleague.com/api${path}${event.rawQuery ? '?' + event.rawQuery : ''}`;

    try {
        const response = await axios.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://fantasy.premierleague.com/'
            }
        });
        return {
            statusCode: 200,
            headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
            body: JSON.stringify(response.data)
        };
    } catch (error) {
        return { statusCode: error.response ? error.response.status : 500, body: error.message };
    }
};
