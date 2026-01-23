const { ethers } = require("hardhat");

async function main() {
    const MARKET_ADDRESS = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    console.log("Fetching markets from:", MARKET_ADDRESS);

    // ABI for V1/V2 compatibility (getMarketBasicInfo is standard across both usually)
    const abi = [
        "function marketCount() view returns (uint256)",
        "function getMarketBasicInfo(uint256) view returns (string, string, string, uint256, uint256, uint256, bool, uint256)"
    ];

    try {
        const provider = new ethers.JsonRpcProvider("https://bsc-rpc.publicnode.com");
        const contract = new ethers.Contract(MARKET_ADDRESS, abi, provider);

        const count = await contract.marketCount();
        console.log(`\nFound ${count.toString()} markets on-chain.\n`);

        for (let i = 0; i < Number(count); i++) {
            try {
                // Returns: question, image, description, outcomeCount, endTime, liquidity, resolved, winningOutcome
                const info = await contract.getMarketBasicInfo(i);

                console.log(`[ID: ${i}] ${info[0]}`); // Question
                console.log(`       Ends: ${new Date(Number(info[4]) * 1000).toLocaleString()}`);
                console.log(`       Resolved: ${info[6]}`);
                console.log("----------------------------------------");
            } catch (e) {
                console.log(`[ID: ${i}] Failed to fetch info: ${e.message.split('(')[0]}`);
            }
        }

    } catch (error) {
        console.error("Error:", error.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
