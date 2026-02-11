const https = require('https');

const url = 'https://oppol-dug5.onrender.com/api/markets';

https.get(url, (res) => {
    let data = '';

    res.on('data', (chunk) => {
        data += chunk;
    });

    res.on('end', () => {
        try {
            const json = JSON.parse(data);
            if (json.success && json.markets) {
                console.log('\n=== PRODUCTION API DATA ===\n');
                json.markets.slice(0, 3).forEach(m => {
                    console.log(`Market ${m.market_id || m.id}: ${m.question}`);
                    console.log(`  Liquidity: ${m.liquidityParam || m.liquidity || 'N/A'}`);
                    console.log(`  Volume: ${m.totalVolume || m.volume || 'N/A'}`);
                    console.log(`  Prices: ${JSON.stringify(m.prices || 'N/A')}`);
                    console.log(`  Last Indexed: ${m.last_indexed_at || 'N/A'}\n`);
                });
            } else {
                console.log('API Response:', data.substring(0, 500));
            }
        } catch (e) {
            console.error('Parse error:', e.message);
            console.log('Raw response:', data.substring(0, 500));
        }
    });
}).on('error', (err) => {
    console.error('Request error:', err.message);
});
