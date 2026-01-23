const { ethers } = require("hardhat");

async function main() {
    const MARKET_ADDRESS = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    console.log("Checking market count for:", MARKET_ADDRESS);

    // ABI to get market count and maybe look at the latest market
    const abi = [
        "function marketCount() view returns (uint256)",
        "function markets(uint256) view returns (string, string, string, string[], uint256[], uint256, uint256, uint256, bool, uint256, uint256, bytes32, bool, address, uint256)"
        // Note: The second function signature depends on V1 vs V2. 
        // V1 might not have image/description in the struct or in that order.
        // Let's stick to marketCount first.
    ];

    try {
        const provider = new ethers.JsonRpcProvider("https://bsc-rpc.publicnode.com");
        const contract = new ethers.Contract(MARKET_ADDRESS, abi, provider);

        const count = await contract.marketCount();
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("📊 Total Markets On-Chain:", count.toString());
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

    } catch (error) {
        console.error("Error reading contract:", error.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
