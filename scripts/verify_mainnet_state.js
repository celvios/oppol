const { ethers } = require("ethers");

async function main() {
    const RPCS = [
        "https://bsc-dataseed1.binance.org",
        "https://bsc-dataseed2.binance.org",
        "https://bsc-dataseed3.binance.org",
        "https://bsc-rpc.publicnode.com"
    ];

    const MARKET_ADDRESS = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B"; // Address from .env

    let provider = null;
    for (const rpc of RPCS) {
        try {
            console.log(`Trying RPC: ${rpc}...`);
            const p = new ethers.JsonRpcProvider(rpc);
            await p.getNetwork(); // Test connection
            console.log("✅ Connected!");
            provider = p;
            break;
        } catch (e) {
            console.log(`❌ Failed: ${e.message}`);
        }
    }

    if (!provider) {
        console.error("❌ All RPCs failed.");
        return;
    }

    const ABI = [
        "function marketCount() view returns (uint256)",
        "function getMarketBasicInfo(uint256) view returns (string, string, string, uint256, uint256, uint256, bool, uint256)",
        "function getMarketOutcomes(uint256) view returns (string[])",
        "function getMarketShares(uint256) view returns (uint256[])",
        "function getAllPrices(uint256) view returns (uint256[])",
        "function userBalances(address) view returns (uint256)"
    ];

    const contract = new ethers.Contract(MARKET_ADDRESS, ABI, provider);

    try {
        console.log(`Checking Market Contract at ${MARKET_ADDRESS}...`);

        // 1. Check Code
        const code = await provider.getCode(MARKET_ADDRESS);
        if (code === "0x") {
            console.error("❌ ERROR: No contract code at this address!");
            return;
        }
        console.log("✅ Contract code exists.");

        // 2. Check Market Count
        const count = await contract.marketCount();
        console.log(`✅ Market Count: ${count.toString()}`);

        if (Number(count) > 0) {
            console.log("\n--- Fetching Market 0 ---");
            try {
                const basicInfo = await contract.getMarketBasicInfo(0);
                console.log("Question:", basicInfo[0]);
                console.log("Outcomes:", basicInfo[3].toString()); // count
                console.log("Liquidity:", ethers.formatUnits(basicInfo[5], 18));
            } catch (e) { console.error("BasicInfo failed:", e.message) }

            try {
                const outcomes = await contract.getMarketOutcomes(0);
                console.log("Outcomes (Names):", outcomes);
            } catch (e) { console.error("Outcomes failed:", e.message) }

            try {
                const prices = await contract.getAllPrices(0);
                console.log("Prices:", prices.map(p => p.toString()));
            } catch (e) { console.error("Prices failed:", e.message) }
        } else {
            console.warn("⚠️ Market count is 0. Contract is empty.");
        }

    } catch (error) {
        console.error("❌ ERROR Querying Contract:", error.message);
    }
}

main();
