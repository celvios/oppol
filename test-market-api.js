// Quick test script to check market API response
const API_URL = 'https://oppol-dug5.onrender.com';

async function testMarketAPI() {
    try {
        console.log('Testing market API at:', API_URL);
        const response = await fetch(`${API_URL}/api/markets`);
        const data = await response.json();
        
        if (data.success && data.markets && data.markets.length > 0) {
            const market = data.markets[0];
            console.log('\n✅ Market Data Retrieved:');
            console.log('Market ID:', market.market_id);
            console.log('Question:', market.question);
            console.log('Prices (raw):', market.prices);
            console.log('Prices (formatted):', market.prices?.map(p => `${p}%`));
            console.log('Total Volume:', market.totalVolume);
            console.log('Liquidity:', market.liquidityParam);
            console.log('Outcomes:', market.outcomes);
            
            console.log('\n🔍 Diagnosis:');
            if (!market.totalVolume || market.totalVolume === '0' || market.totalVolume === 0) {
                console.log('❌ Volume is 0 or undefined');
            }
            
            if (market.prices && market.prices.every(p => p < 0.01)) {
                console.log('❌ Prices are near 0 (contract returning wrong values)');
                console.log('   Expected: 0-100 range');
                console.log('   Got:', market.prices);
            }
        } else {
            console.log('❌ No markets found or API error');
        }
    } catch (error) {
        console.error('❌ Error testing API:', error.message);
    }
}

testMarketAPI();
