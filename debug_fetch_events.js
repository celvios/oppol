
const { ethers } = require('ethers');
const axios = require('axios');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

const MARKET_ABI = [
    "event SharesPurchased(uint256 indexed marketId, address indexed user, uint256 outcomeIndex, uint256 shares, uint256 totalCost)"
];

const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc.publicnode.com';
const MARKET_ADDR = process.env.NEXT_PUBLIC_MARKET_ADDRESS || '0xe3Eb84D7e271A5C44B27578547f69C80c497355B';

// Target block: 46506371
const FROM_BLOCK = 46506000;
const TO_BLOCK = 46507000;

async function main() {
    console.log(`Using RPC: ${RPC_URL}`);
    console.log(`Contract: ${MARKET_ADDR}`);
    console.log(`Scanning ${FROM_BLOCK} - ${TO_BLOCK}...`);

    const iface = new ethers.Interface(MARKET_ABI);
    const topic0 = iface.getEvent('SharesPurchased').topicHash;
    const topic1 = ethers.zeroPadValue(ethers.toBeHex(4), 32);

    try {
        console.log('Sending request...');
        const response = await axios.post(RPC_URL, {
            jsonrpc: '2.0',
            method: 'eth_getLogs',
            params: [{
                fromBlock: '0x' + BigInt(FROM_BLOCK).toString(16),
                toBlock: '0x' + BigInt(TO_BLOCK).toString(16),
                address: MARKET_ADDR,
                topics: [topic0, topic1]
            }],
            id: 1
        });

        console.log('Response received status:', response.status);

        if (response.data.error) {
            console.error('RPC Error:', JSON.stringify(response.data.error));
            return;
        }

        const logs = response.data.result;
        if (!logs) {
            console.error('No result in response:', JSON.stringify(response.data));
            return;
        }

        console.log(`Found ${logs.length} logs.`);

        if (logs.length > 0) {
            for (const log of logs) {
                console.log(`Log found at block ${parseInt(log.blockNumber, 16)}`);
                try {
                    const parsed = iface.parseLog({ topics: log.topics, data: log.data });
                    console.log('Parsed:', parsed.args);
                } catch (e) {
                    console.error('Parse Error:', e.message);
                    console.log('Topics:', log.topics);
                    console.log('Data:', log.data);
                }
            }
        }

    } catch (e) {
        console.error('Request Error:', e.message);
    }
}

main();
