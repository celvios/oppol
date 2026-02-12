
const https = require('https');

function fetchUrl(url) {
    return new Promise((resolve, reject) => {
        console.log(`Fetching ${url}...`);
        https.get(url, (res) => {
            let data = '';
            res.on('data', (chunk) => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    resolve(json);
                } catch (e) {
                    console.error('Failed to parse JSON:', data.substring(0, 100));
                    resolve(null);
                }
            });
        }).on('error', (err) => {
            console.error(`Error fetching ${url}:`, err.message);
            resolve(null);
        });
    });
}

async function test() {
    // Try production URL from previous context or guessing
    const urls = [
        'https://www.opoll.org/api/markets',
        'https://oppol.onrender.com/api/markets' // Common pattern
    ];

    for (const url of urls) {
        const data = await fetchUrl(url);
        if (data && data.success && data.markets) {
            console.log(`\n✅ Success from ${url}`);
            const market5 = data.markets.find(m => m.market_id === 5 || m.market_id === '5');
            if (market5) {
                console.log('--- MARKET 5 RAW JSON ---');
                console.log(JSON.stringify(market5, null, 2));
            } else {
                console.log('Market 5 not found in response.');
            }
            return; // Stop if successful
        }
    }
    console.log('\n❌ Could not fetch data from any URL.');
}

test();
