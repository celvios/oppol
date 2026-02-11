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
                const market4 = json.markets.find(m => m.market_id === 4);
                if (market4) {
                    console.log('\n=== MARKET 4 FROM PRODUCTION API ===');
                    console.log(`Liquidity: $${market4.liquidityParam}`);
                    console.log(`Volume: $${market4.volume}`);
                    console.log(`Prices: ${JSON.stringify(market4.prices)}`);
                    console.log(`Last Indexed: ${market4.last_indexed_at}`);
                } else {
                    console.log('Market 4 not found in API response');
                }
            }
        } catch (e) {
            console.error('Parse error:', e.message);
        }
    });
}).on('error', (err) => {
    console.error('Request error:', err.message);
});
