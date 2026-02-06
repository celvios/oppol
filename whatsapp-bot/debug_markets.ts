const axios = require('axios');

const API_BASE = 'https://oppol-dug5.onrender.com/api';

async function debugMarkets() {
    try {
        console.log('Fetching all markets...');
        const { data } = await axios.get(`${API_BASE}/markets`);
        const markets = data.markets || [];
        console.log(`Found ${markets.length} markets.`);

        markets.forEach((m: any, i: number) => {
            console.log(`[${i + 1}] ID: ${m.market_id} | Ref: ${m.marketRefId} | Q: ${m.question.substring(0, 30)}...`);
        });

        // Try to fetch market ID 9 specificially (if it exists in the list)
        const market9 = markets.find((m: any) => m.market_id === 9 || m.id === 9);

        if (market9) {
            console.log(`\nTesting fetch for Market ID 9...`);
            try {
                const detail = await axios.get(`${API_BASE}/markets/9`);
                console.log('✅ Fetch Success for ID 9:', detail.data ? 'Data received' : 'No data');
            } catch (e: any) {
                console.log('❌ Fetch Failed for ID 9:', e.message);
                if (e.response) {
                    console.log('   Status:', e.response.status);
                    console.log('   Data:', e.response.data);
                }
            }
        } else {
            console.log('\nWarning: Market with ID 9 not found in the list!');
        }

    } catch (error: any) {
        console.error('Error:', error.message);
    }
}

debugMarkets();
