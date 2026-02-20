/**
 * resolve_market.js
 * ---------------------
 * Checks market details and optionally resolves a market on-chain.
 * Usage: node scripts/resolve_market.js <marketId> <outcomeIndex>
 *   marketId     - The market ID to resolve
 *   outcomeIndex - (optional) 0 = first outcome, 1 = second, etc. If omitted, only shows market info.
 */
require('dotenv').config();
const { ethers } = require('ethers');

const MARKET_ADDR = process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MARKET_CONTRACT;
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-rpc.publicnode.com';

const ABI = [
    'function getMarketBasicInfo(uint256) view returns (string question, string image, string description, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome)',
    'function getMarketOutcomes(uint256) view returns (string[])',
    'function resolveMarket(uint256 marketId, uint256 outcomeIndex)',
];

async function main() {
    const marketId = parseInt(process.argv[2]);
    const outcomeIndex = process.argv[3] !== undefined ? parseInt(process.argv[3]) : null;

    if (isNaN(marketId)) {
        console.error('Usage: node resolve_market.js <marketId> [outcomeIndex]');
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
    const contract = new ethers.Contract(MARKET_ADDR, ABI, wallet);

    // Fetch market info
    console.log(`\nFetching market ${marketId}...`);
    const info = await contract.getMarketBasicInfo(marketId);
    const outcomes = await contract.getMarketOutcomes(marketId);

    const endTime = new Date(Number(info.endTime) * 1000);
    const now = new Date();
    const hasEnded = now >= endTime;

    console.log('\n========== Market Info ==========');
    console.log(`Question    : ${info.question}`);
    console.log(`Resolved    : ${info.resolved}`);
    if (info.resolved) {
        console.log(`Winner      : [${info.winningOutcome}] ${outcomes[Number(info.winningOutcome)]}`);
    }
    console.log(`End Time    : ${endTime.toISOString()} ${hasEnded ? '✅ ENDED' : '⏳ NOT ENDED YET'}`);
    console.log(`Outcomes    :`);
    outcomes.forEach((name, i) => console.log(`  [${i}] ${name}`));
    console.log('=================================\n');

    if (info.resolved) {
        console.log('✅ Market is already resolved. Nothing to do.');
        return;
    }

    if (!hasEnded) {
        const remaining = Math.round((endTime - now) / 1000 / 60);
        console.log(`⏳ Market has not ended yet (${remaining} minutes remaining). Cannot resolve.`);
        return;
    }

    if (outcomeIndex === null) {
        console.log('💡 To resolve, run: node scripts/resolve_market.js', marketId, '<outcomeIndex>');
        console.log('   Example (pick outcome 0):', `node scripts/resolve_market.js ${marketId} 0`);
        return;
    }

    if (outcomeIndex < 0 || outcomeIndex >= outcomes.length) {
        console.error(`❌ Invalid outcomeIndex ${outcomeIndex}. Valid range: 0-${outcomes.length - 1}`);
        process.exit(1);
    }

    console.log(`🔧 Resolving market ${marketId} with winning outcome [${outcomeIndex}] "${outcomes[outcomeIndex]}"...`);
    const tx = await contract.resolveMarket(marketId, outcomeIndex);
    console.log(`📤 TX sent: ${tx.hash}`);
    await tx.wait();
    console.log(`✅ Market ${marketId} resolved! Winner: "${outcomes[outcomeIndex]}" (index ${outcomeIndex})`);
}

main().catch(e => {
    console.error('❌ Error:', e.message || e);
    process.exit(1);
});
