// Advanced Recovery Script
// Using the Privy App Secret, we can query all wallets linked to the user
// and use the Privy Server Wallet API to sign a transfer back to the user.
require('dotenv').config({ path: '../../.env' });
const https = require('https');
const { ethers } = require('ethers');

const PRIVY_APP_ID = 'cml3gzeq5002jl70c6l9079hz';
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;
const SMART_ACCOUNT = '0xd0A115Ea64B59F951B70276fCb65b4946465e3a9';
const TARGET_WALLET = '0x42501490f7c291b4B28110900c9Bd81f3B35B849';
const USDT_ADDR = '0x55d398326f99059fF775485246999027B3197955'; // BSC USDT

const authHeader = `Basic ${Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString('base64')}`;

async function privyRequest(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'auth.privy.io',
            path: path,
            method: method,
            headers: {
                'Authorization': authHeader,
                'privy-app-id': PRIVY_APP_ID,
                'Content-Type': 'application/json',
            }
        };

        const req = https.request(options, res => {
            let data = '';
            res.on('data', d => data += d);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, data: data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

async function main() {
    if (!PRIVY_APP_SECRET) {
        console.error('❌ Missing PRIVY_APP_SECRET down in contracts/scripts/.env');
        return;
    }

    const provider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
    const usdt = new ethers.Contract(USDT_ADDR, [
        'function balanceOf(address) view returns (uint256)',
        'function transfer(address,uint256) returns (bool)'
    ], provider);

    const bal = await usdt.balanceOf(SMART_ACCOUNT);
    console.log(`USDT Balance at ${SMART_ACCOUNT}: ${ethers.formatUnits(bal, 18)}`);

    if (bal === 0n) {
        console.log('❌ No USDT to recover');
        return;
    }

    // 1. Find the user ID in Privy
    console.log('\n--- 1. Locating User in Privy ---');
    let res = await privyRequest('GET', `/api/v1/users?wallet_address=${TARGET_WALLET}`);
    if (res.status !== 200 || !res.data.data || res.data.data.length === 0) {
        console.log('Could not find user by target wallet. Trying smart account...');
        res = await privyRequest('GET', `/api/v1/users?wallet_address=${SMART_ACCOUNT}`);
        if (res.status !== 200 || !res.data.data || res.data.data.length === 0) {
            console.log('❌ User not found in Privy. Cannot sign via Server Wallet.');
            return;
        }
    }
    const userId = res.data.data[0].id;
    console.log(`Found User ID: ${userId}`);

    // 2. Identify the specific embedded wallet ID inside Privy
    console.log('\n--- 2. Identifying Embedded Wallet ---');
    const userObj = res.data.data[0];
    const wallets = userObj.linked_accounts.filter(a => a.type === 'wallet');
    let targetWalletId = null;

    for (const w of wallets) {
        console.log(`  Linked: ${w.address} (Type: ${w.wallet_client_type})`);
        if (w.address.toLowerCase() === SMART_ACCOUNT.toLowerCase() && w.wallet_client_type === 'privy') {
            targetWalletId = w.id; // Usually needed for server signing, but let's try direct send first
        }
    }

    // 3. Request Privy Server to sign & send the transaction
    console.log('\n--- 3. Submitting Transfer via Privy Server Wallet ---');
    console.log(`Preparing to send ${ethers.formatUnits(bal, 18)} USDT to ${TARGET_WALLET}`);

    const iface = new ethers.Interface(['function transfer(address,uint256) returns(bool)']);
    const txData = iface.encodeFunctionData('transfer', [TARGET_WALLET, bal]);

    // Privy Server Wallet API docs: POST /api/v1/wallets/:address/rpc
    const body = {
        method: "eth_sendTransaction",
        params: [{
            to: USDT_ADDR,
            data: txData,
            value: "0x0"
        }]
    };

    console.log(`Sending to Privy API: POST /api/v1/wallets/${SMART_ACCOUNT}/rpc`);
    const rpcRes = await privyRequest('POST', `/api/v1/wallets/${SMART_ACCOUNT}/rpc`, body);

    if (rpcRes.status >= 200 && rpcRes.status < 300) {
        console.log('\n✅ SUCCESS: Privy Server signed and broadcasted the transaction!');
        console.log(rpcRes.data);
    } else {
        console.log(`\n❌ Privy API Error (Status: ${rpcRes.status})`);
        console.log(JSON.stringify(rpcRes.data, null, 2));

        console.log('\nReason: The address 0xd0A... might be a Smart Account deployed by Biconomy on behalf of Privy,');
        console.log('not a base Privy embedded wallet. If it is a Biconomy Smart Account, it requires an SDK call.');
    }
}

main().catch(console.error);
