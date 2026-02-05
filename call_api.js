const { default: fetch } = require('node-fetch');

const API_URL = 'https://oppol-dug5.onrender.com/api/admin/update-balance';

const payload = {
    walletAddress: "0x93Edd0429c6Ac4B3644A174Ade5E9d4412E43680",
    custodialWallet: "0xe3Eb84D7e271A5C44B27578547f69C80c497355B",
    balance: "1.992216439902026248"
};

async function updateBalance() {
    try {
        console.log('🔄 Calling API to update user balance...');
        console.log('URL:', API_URL);
        console.log('Payload:', JSON.stringify(payload, null, 2));
        
        const response = await fetch(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        
        const result = await response.json();
        
        if (response.ok) {
            console.log('✅ SUCCESS!');
            console.log('Response:', JSON.stringify(result, null, 2));
            console.log(`✅ User credited with ${payload.balance} USDC`);
        } else {
            console.log('❌ ERROR!');
            console.log('Status:', response.status);
            console.log('Response:', JSON.stringify(result, null, 2));
        }
        
    } catch (error) {
        console.error('❌ Request failed:', error.message);
    }
}

updateBalance();