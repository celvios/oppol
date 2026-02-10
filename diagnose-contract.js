// Comprehensive contract diagnostic
const CONTRACT_ADDRESS = '0xe3Eb84D7e271A5C44B27578547f69C80c497355B';
const RPC_URL = 'https://bsc-dataseed.binance.org';

async function diagnose() {
    console.log('🔬 COMPREHENSIVE CONTRACT DIAGNOSTIC');
    console.log('=' .repeat(60));
    console.log('Contract:', CONTRACT_ADDRESS);
    console.log('Network: BSC Mainnet');
    console.log('RPC:', RPC_URL);
    console.log('=' .repeat(60));

    try {
        // Method 1: Check via JSON-RPC directly
        console.log('\n📡 Method 1: Direct RPC Call to getAllPrices(0)');
        
        // getAllPrices(uint256) selector = 0x6d8c3c6c
        const data = '0x6d8c3c6c' + '0'.padStart(64, '0'); // marketId = 0
        
        const rpcPayload = {
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [{
                to: CONTRACT_ADDRESS,
                data: data
            }, 'latest'],
            id: 1
        };

        const response = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(rpcPayload)
        });

        const result = await response.json();
        console.log('Raw RPC Response:', result);

        if (result.result) {
            console.log('✅ Contract responded');
            console.log('Raw hex data:', result.result);
            
            // Try to decode (simplified)
            if (result.result.length > 2) {
                console.log('Data length:', result.result.length);
            }
        } else if (result.error) {
            console.log('❌ RPC Error:', result.error.message);
        }

        // Method 2: Check marketCount
        console.log('\n📊 Method 2: Check marketCount()');
        const marketCountData = '0x2f2c9ecd'; // marketCount() selector
        
        const countPayload = {
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [{
                to: CONTRACT_ADDRESS,
                data: marketCountData
            }, 'latest'],
            id: 2
        };

        const countResponse = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(countPayload)
        });

        const countResult = await countResponse.json();
        if (countResult.result) {
            const count = parseInt(countResult.result, 16);
            console.log('Market Count:', count);
            
            if (count === 0) {
                console.log('⚠️  No markets created yet!');
            }
        }

        // Method 3: Check getMarketBasicInfo(0)
        console.log('\n📋 Method 3: Check getMarketBasicInfo(0)');
        const basicInfoData = '0x8b5a6d1f' + '0'.padStart(64, '0'); // getMarketBasicInfo(0)
        
        const basicPayload = {
            jsonrpc: '2.0',
            method: 'eth_call',
            params: [{
                to: CONTRACT_ADDRESS,
                data: basicInfoData
            }, 'latest'],
            id: 3
        };

        const basicResponse = await fetch(RPC_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(basicPayload)
        });

        const basicResult = await basicResponse.json();
        if (basicResult.result && basicResult.result !== '0x') {
            console.log('✅ Market 0 exists');
            console.log('Raw data length:', basicResult.result.length);
        } else {
            console.log('❌ Market 0 does not exist or call failed');
        }

        console.log('\n🔗 View on BSCScan:');
        console.log(`https://bscscan.com/address/${CONTRACT_ADDRESS}#readContract`);
        
    } catch (error) {
        console.error('❌ Fatal error:', error.message);
    }
}

diagnose();
