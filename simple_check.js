const { ethers } = require('ethers');

const RPC_URL = process.env.BNB_RPC_URL || 'https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/';
const TARGET_WALLET = '0x3B6a79d61523631473CF80d3845E9e6A0B11e5a4';
const USDC_ADDR = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';

async function main() {
    console.log(`Checking ${TARGET_WALLET} on BSC Mainnet...`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    try {
        // ... existing checks ...

        // Check Markets Balance
        const MARKET_ADDR = '0xe3Eb84D7e271A5C44B27578547f69C80c497355B';
        const marketAbi = ['function userBalances(address) view returns (uint256)'];
        const market = new ethers.Contract(MARKET_ADDR, marketAbi, provider);
        const marketBal = await market.userBalances(TARGET_WALLET);
        console.log(`Market Contract Balance: ${ethers.formatUnits(marketBal, 18)} USDC`); // Market uses 18 decimals for internal balance? Verify.
        // Usually market tracks in same decimals as token, or 18. Code says 18.

        // Check recent USDC transfers TO this wallet
        const usdc = new ethers.Contract(USDC_ADDR, ['event Transfer(address indexed from, address indexed to, uint256 value)'], provider);
        const filterTo = usdc.filters.Transfer(null, TARGET_WALLET);
        const logsTo = await usdc.queryFilter(filterTo, -5000); // Last 5000 blocks (~15 mins)
        console.log(`Recent USDC IN: ${logsTo.length} events`);
        logsTo.forEach(l => console.log(` - ${ethers.formatUnits(l.args[2], 18)} from ${l.args[0]}`));

        // Check recent USDC transfers FROM this wallet (Sweep?)
        const filterFrom = usdc.filters.Transfer(TARGET_WALLET, null);
        const logsFrom = await usdc.queryFilter(filterFrom, -5000);
        console.log(`Recent USDC OUT: ${logsFrom.length} events`);
        logsFrom.forEach(l => console.log(` - ${ethers.formatUnits(l.args[2], 18)} to ${l.args[1]}`));

    } catch (e) {

        console.error("Error:", e);
    }
}

main();
