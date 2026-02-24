// Check if the destination address is a Privy-managed server wallet
// and query the Privy API for any embedded wallets linked to the user's account
require('dotenv').config({ path: '../../.env' });
const https = require('https');

const PRIVY_APP_ID = 'cml3gzeq5002jl70c6l9079hz';
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;
const DEST_ADDR = '0xd0A115Ea64B59F951B70276fCb65b4946465e3a9';
const USER_WALLET = '0x42501490f7c291b4B28110900c9Bd81f3B35B849';

async function privyGet(path) {
    return new Promise((resolve, reject) => {
        const creds = Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString('base64');
        const req = https.get(
            `https://auth.privy.io${path}`,
            {
                headers: {
                    'Authorization': `Basic ${creds}`,
                    'privy-app-id': PRIVY_APP_ID,
                    'Content-Type': 'application/json',
                }
            },
            res => {
                let data = '';
                res.on('data', d => data += d);
                res.on('end', () => {
                    try { resolve(JSON.parse(data)); }
                    catch { resolve({ raw: data }); }
                });
            }
        );
        req.on('error', reject);
    });
}

async function main() {
    if (!PRIVY_APP_SECRET) {
        console.log('❌ Missing PRIVY_APP_SECRET in .env');
        return;
    }

    // 1. Find user by wallet address
    console.log(`\nSearching Privy for user with wallet ${USER_WALLET}...`);
    const users = await privyGet(`/api/v1/users?wallet_address=${USER_WALLET}`);
    console.log(JSON.stringify(users, null, 2).slice(0, 1000));

    // 2. List all embedded wallets for the user
    if (users.data && users.data.length > 0) {
        const user = users.data[0];
        console.log(`\nFound Privy user: ${user.id}`);
        const detail = await privyGet(`/api/v1/users/${user.id}`);
        const wallets = (detail.linked_accounts || []).filter(a => a.type === 'wallet');
        require('fs').writeFileSync('privy_out.json', JSON.stringify({ detail, wallets }, null, 2));
        console.log('\nLogged to privy_out.json');
    } else {
        console.log('No Privy user found for that wallet address.');
    }
}

main().catch(console.error);
