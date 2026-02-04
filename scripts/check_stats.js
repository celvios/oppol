
const { ethers } = require("ethers");
require("dotenv").config();
const fs = require('fs');

async function main() {
    // 1. Setup
    const MARKET_ADDRESS = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B"; // User Provided Address
    const USDC_ADDRESS = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"; // BSC Mainnet USDC

    const RPCS = [
        "https://bsc-dataseed.binance.org/",
        "https://bsc-dataseed1.defibit.io/",
        "https://bsc-dataseed1.ninicoin.io/",
        "https://bsc-rpc.publicnode.com"
    ];

    console.log("🔍 Connecting to BSC Mainnet...");

    // Find working RPC
    let provider;
    for (const rpc of RPCS) {
        try {
            console.log(`Trying RPC: ${rpc}`);
            const tempProvider = new ethers.JsonRpcProvider(rpc);
            await tempProvider.getNetwork();
            provider = tempProvider;
            console.log(`✅ Connected to: ${rpc}`);
            break;
        } catch (e) {
            console.log(`❌ Failed: ${e.message}`);
        }
    }

    if (!provider) {
        console.error("Critical: Could not connect to any RPC.");
        return;
    }

    // 2. ABIs
    const MARKET_ABI = [
        "function accumulatedFees() view returns (uint256)",
        "function protocolFee() view returns (uint256)",
        "function marketCount() view returns (uint256)",
        "function owner() view returns (address)"
    ];

    const ERC20_ABI = [
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)"
    ];

    // 3. Contracts
    const market = new ethers.Contract(MARKET_ADDRESS, MARKET_ABI, provider);
    const usdc = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);

    console.log(`\n📊 Checking Contract: ${MARKET_ADDRESS}`);

    try {
        // 4. Query Data
        console.log("Reading Market Count...");
        let count = "Unknown";
        try {
            count = await market.marketCount();
        } catch (e) {
            console.log("⚠️ Could not read marketCount");
        }

        console.log("Reading USDC Balance...");
        const balanceRaw = await usdc.balanceOf(MARKET_ADDRESS);
        const decimals = await usdc.decimals();
        const symbol = await usdc.symbol();
        const balance = ethers.formatUnits(balanceRaw, decimals);

        console.log("Reading Fees (V2 Only)...");
        let fees = "0.0";
        let rate = "Unknown";
        try {
            const feesRaw = await market.accumulatedFees();
            fees = ethers.formatUnits(feesRaw, decimals);

            const feeRate = await market.protocolFee();
            rate = Number(feeRate) / 100;
        } catch (e) {
            console.log("⚠️ 'accumulatedFees' not found. Likely V1 Contract (No Protocol Fees).");
        }

        console.log("Reading Owner...");
        let owner = "Unknown";
        try {
            owner = await market.owner();
        } catch (e) {
            console.log("⚠️ Could not read owner");
        }

        // 6. Report
        const report = `
💰 FINANCIAL REPORT
-----------------------------------------
Target Contract:         ${MARKET_ADDRESS}
Contract Owner:          ${owner}
Current TVL (Balance):   ${balance} ${symbol}
Accumulated Fees:        ${fees} ${symbol}
Protocol Fee Rate:       ${rate}%
Total Markets Created:   ${count}
-----------------------------------------
        `;

        console.log(report);
        fs.writeFileSync('financial_report.txt', report);

    } catch (e) {
        console.error("\n❌ Error querying contract:");
        console.error(e);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
