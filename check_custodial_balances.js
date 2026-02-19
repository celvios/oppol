const { ethers } = require('ethers');
const fs = require('fs');
require('dotenv').config();

// BSC Mainnet
const RPC_URL = process.env.BNB_RPC_URL || 'https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/';
const USDC_ADDR = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';

async function main() {
    console.log('--- Checking Custodial Wallet Balances ---');

    // Read wallets file
    let wallets = [];
    try {
        const data = fs.readFileSync('wallets_utf8.json', 'utf8');
        // Find JSON array start using regex (looks for [ followed by whitespace and {)
        const match = data.match(/\[\s*\{/);
        if (!match) throw new Error("No JSON array found");

        const start = match.index;
        const end = data.lastIndexOf(']');
        if (start === -1 || end === -1) throw new Error("No JSON array found");

        const jsonStr = data.substring(start, end + 1);
        wallets = JSON.parse(jsonStr);
    } catch (e) {
        console.error("Failed to read wallets_utf8.json:", e.message);
        return;
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const usdc = new ethers.Contract(USDC_ADDR, ['function balanceOf(address) view returns (uint256)'], provider);

    console.log(`Checking ${wallets.length} wallets on BSC Mainnet...\n`);

    const results = [];

    for (const w of wallets) {
        try {
            const bnbBal = await provider.getBalance(w.public_address);
            const usdcBal = await usdc.balanceOf(w.public_address);

            results.push({
                Name: w.display_name,
                Address: w.public_address,
                BNB: parseFloat(ethers.formatEther(bnbBal)).toFixed(4),
                USDC: parseFloat(ethers.formatUnits(usdcBal, 18)).toFixed(2)
            });

            // Check process.stdout to prevent buffering issues
            process.stdout.write('.');
        } catch (e) {
            results.push({
                Name: w.display_name,
                Address: w.public_address,
                BNB: 'ERROR',
                USDC: 'ERROR'
            });
            console.error(`\nError checking ${w.public_address}:`, e.message);
        }
    }

    console.log('\n\n--- RESULTS ---');
    console.table(results);
}

main();
