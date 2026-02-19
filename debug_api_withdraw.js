
// Node 18+ has native fetch
const { ethers } = require('ethers');

const API_URL = 'http://localhost:3000';

const TARGET_PRIVY_ID = 'did:privy:cm76226340003117s00t2f6w6'; // User from manual_transfer.js / debug logs?
// Wait, I need the actual Privy ID. 
// "User debug state: address '0xD5E...'"
// I can look up the user in DB first to get their Privy ID.

const { Client } = require('pg');
require('dotenv').config();

async function main() {
    console.log('Fetching User Privy ID...');
    const client = new Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    await client.connect();

    const TARGET_ADDR = '0xD5EeB48921F15Cdc0863fAA841fc08F998b9e55f'; // From user report
    const res = await client.query('SELECT user_id, public_address FROM wallets WHERE public_address = $1', [TARGET_ADDR]);

    if (res.rows.length === 0) { console.error('Wallet not found'); return; }
    const userId = res.rows[0].user_id;
    console.log(`Internal User ID: ${userId}`);

    const userRes = await client.query('SELECT privy_user_id FROM users WHERE id = $1', [userId]);
    const privyUserId = userRes.rows[0].privy_user_id;
    console.log(`Privy User ID: ${privyUserId}`);
    await client.end();

    const randomWallet = ethers.Wallet.createRandom();
    const dest = randomWallet.address;
    const amount = "0.01";

    console.log(`Calling API: ${API_URL}/api/wallet/custodial-withdraw`);
    console.log(`Payload: amount=${amount}, dest=${dest}`);

    try {
        const response = await fetch(`${API_URL}/api/wallet/custodial-withdraw`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                privyUserId: privyUserId,
                amount: amount,
                destinationAddress: dest
            })
        });

        const data = await response.json();
        console.log('Response Status:', response.status);
        console.log('Response Body:', data);
    } catch (e) {
        console.error('API Call Failed:', e.message);
        if (e.code === 'ECONNREFUSED') {
            console.log('Is the backend server running? Try checking port 3005 or 3001.');
        }
    }
}

main();
