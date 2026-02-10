// Check if contract exists on BSC Mainnet
const CONTRACT_ADDRESS = '0xe3Eb84D7e271A5C44B27578547f69C80c497355B';

async function checkContract() {
    try {
        // Check via BSCScan API (no key needed for basic checks)
        const url = `https://api.bscscan.com/api?module=contract&action=getabi&address=${CONTRACT_ADDRESS}`;
        
        console.log('🔍 Checking contract on BSC Mainnet:', CONTRACT_ADDRESS);
        console.log('📡 BSCScan API:', url);
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.status === '1') {
            console.log('✅ Contract EXISTS and is verified on BSCScan');
            console.log('📄 Contract has ABI available');
        } else {
            console.log('❌ Contract NOT FOUND or not verified');
            console.log('Response:', data.message);
        }

        // Also check if it has code
        const codeUrl = `https://api.bscscan.com/api?module=proxy&action=eth_getCode&address=${CONTRACT_ADDRESS}&tag=latest`;
        const codeResponse = await fetch(codeUrl);
        const codeData = await codeResponse.json();
        
        if (codeData.result && codeData.result !== '0x') {
            console.log('✅ Contract has bytecode deployed');
        } else {
            console.log('❌ No bytecode at this address - contract not deployed!');
        }

        console.log('\n📊 View on BSCScan:');
        console.log(`https://bscscan.com/address/${CONTRACT_ADDRESS}`);
        
    } catch (error) {
        console.error('❌ Error:', error.message);
    }
}

checkContract();
