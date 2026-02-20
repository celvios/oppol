
const axios = require('axios');

async function testRpc() {
    const url = 'https://bsc.publicnode.com';
    console.log(`Testing ${url}...`);
    try {
        const response = await axios.post(url, {
            jsonrpc: '2.0',
            method: 'eth_blockNumber',
            params: [],
            id: 1
        });
        console.log('Result:', response.data);
    } catch (e) {
        console.error('Error:', e.message);
        if (e.response) {
            console.error('Response:', e.response.status, e.response.data);
        }
    }
}

testRpc();
