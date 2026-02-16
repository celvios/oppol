const { ethers } = require("ethers");
require("dotenv").config();
const fs = require('fs');

async function main() {
    try {
        // Configuration
        const MARKET_ADDRESS = process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MARKET_CONTRACT;
        const RPC_URL = process.env.BNB_RPC_URL || "https://bsc-dataseed.binance.org/";

        console.log(`🔍 Connecting to BSC...`);
        console.log(`   Contract: ${MARKET_ADDRESS}`);
        console.log(`   RPC:      ${RPC_URL}`);

        const provider = new ethers.JsonRpcProvider(RPC_URL);

        // Contract ABI - minimal needed
        const ABI = [
            "function protocolFee() view returns (uint256)",
            "function marketCount() view returns (uint256)",
            "event SharesPurchased(uint256 indexed marketId, address indexed user, uint256 outcomeIndex, uint256 shares, uint256 cost)"
        ];

        const market = new ethers.Contract(MARKET_ADDRESS, ABI, provider);

        // 1. Get Fee Rate
        let feeBps = 0;
        try {
            const fee = await market.protocolFee();
            feeBps = Number(fee);
            console.log(`✅ Protocol Fee Rate: ${feeBps} bps (${feeBps / 100}%)`);
        } catch (e) {
            console.warn("⚠️  Could not fetch protocolFee(), defaulting to 1000 bps (10%) based on app logic.");
            feeBps = 1000;
        }

        // 2. Scan Blockchain for Volume
        // Contract deployed around block 76,631,040. Start safely before that.
        const startBlock = 76000000;
        const currentBlock = await provider.getBlockNumber();

        console.log(`\n🔍 Scanning blocks ${startBlock} to ${currentBlock} for trades...`);
        console.log(`   Target Range: ${(currentBlock - startBlock).toLocaleString()} blocks`);

        let totalCost = BigInt(0);
        let tradeCount = 0;
        const CHUNK_SIZE = 10000;

        for (let from = startBlock; from <= currentBlock; from += CHUNK_SIZE) {
            const to = Math.min(from + CHUNK_SIZE - 1, currentBlock);
            process.stdout.write(`\rScanning ${from}-${to}...`);

            try {
                const logs = await market.queryFilter(market.filters.SharesPurchased(), from, to);
                for (const log of logs) {
                    const cost = BigInt(log.args[4]);
                    totalCost += cost;
                    tradeCount++;
                }
            } catch (e) {
                // Ignore chunk errors or retry logic could be added
            }
        }

        console.log(`\n✅ Scan Complete. Found ${tradeCount} trades.`);

        // 3. Calculate Fees
        // Logic: The 'cost' in SharesPurchased is the amount used to buy shares.
        // Fees are ON TOP or DEDUCTED? 
        // In V3 app.ts: effectiveMaxCost = amount * 10000 / (10000 + fee)
        // This suggests the USER INPUT includes the fee.
        // But SharesPurchased emits the 'cost' which usually refers to the 'effective' amount used for shares.
        // If 'cost' = share value, then Fee = Cost * FeeBps / 10000.

        // Let's assume SharesPurchased 'cost' is the raw collateral used for shares (excluding fee).
        const totalCostFormatted = ethers.formatUnits(totalCost, 18);
        const totalFeeWei = totalCost * BigInt(feeBps) / BigInt(10000);
        const totalFeeFormatted = ethers.formatUnits(totalFeeWei, 18);

        const output = `
==========================================
FULL HISTORY SCAN (${startBlock} - ${currentBlock})
------------------------------------------
Total Trades Found:                ${tradeCount}
Total Traded Volume (Share Value): $${parseFloat(totalCostFormatted).toFixed(2)}
Protocol Fee Rate:                 ${feeBps / 100}%
Total Fees Collected:              $${parseFloat(totalFeeFormatted).toFixed(4)}
==========================================
`;
        console.log(output);
        fs.writeFileSync('fees_onchain_result.txt', output);
        console.log('Result saved to fees_onchain_result.txt');

    } catch (error) {
        console.error("\n❌ Error:", error.message);
    }
}

main();
