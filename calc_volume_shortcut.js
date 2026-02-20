
const { ethers } = require('ethers');

// Market 4 Data from check_market_4_status.txt
const SHARES = [3.857799999999999999, 2.007761887409516462];
const LIQUIDITY_PARAM = 0.0000000002; // This looks suspiciously low/wrong in the previous output, but using what was logged.
// Wait, if liquidity is that low, the cost function will be sensitive.
// Let's re-verify logic. 
// V2 Code: market.liquidityParam = _outcomes.length * 100 * 1e6; (100 USDC per outcome)
// So for 2 outcomes, it should be 200 * 1e6 = 200,000,000.
// If the log said 0.0000000002, maybe it was formatted with 18 decimals but it's actually 6 decimals (USDC)?
// Log: `Initial Liquidity: ${ethers.formatUnits(info[5], 18)}`
// If info[5] is 200,000,000 (6 decimals), and we format with 18, we get 0.0000000002.
// CORRECT.

const LIQUIDITY_USDC = 200; // 200 USDC
const B = LIQUIDITY_USDC;

// LMSR Cost Function: C = b * ln( sum( exp( q_i / b ) ) )

function calculateCost(q, b) {
    let sumExp = 0;
    for (let x of q) {
        sumExp += Math.exp(x / b);
    }
    return b * Math.log(sumExp);
}

const initialShares = [0, 0];
const currentShares = SHARES;

const costStart = calculateCost(initialShares, B);
const costEnd = calculateCost(currentShares, B);

const netVolume = costEnd - costStart;

console.log("Initial Cost:", costStart);
console.log("Current Cost:", costEnd);
console.log("Net Volume (USDC):", netVolume);

// Also outputs explicit SQL to update
console.log(`\nSQL Update:\nUPDATE markets SET volume = ${netVolume.toFixed(6)} WHERE id = 4;`);
