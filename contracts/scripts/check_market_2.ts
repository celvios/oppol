
import { ethers } from "hardhat";

async function main() {
    const MARKET_ADDRESS = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B"; // Mainnet address
    console.log(`Checking Market 2 on ${MARKET_ADDRESS}...`);

    const marketABI = [
        "function getMarketBasicInfo(uint256) view returns (string, string, string, uint256, uint256, uint256, bool, uint256)",
        "function getMarketShares(uint256) view returns (uint256[])",
        "function getMarketOutcomes(uint256) view returns (string[])"
    ];

    const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/");
    const contract = new ethers.Contract(MARKET_ADDRESS, marketABI, provider);

    try {
        const [basic, shares, outcomes] = await Promise.all([
            contract.getMarketBasicInfo(2),
            contract.getMarketShares(2),
            contract.getMarketOutcomes(2)
        ]);

        console.log("--- On-Chain Data ---");
        console.log(`Question: ${basic[0]}`);
        console.log(`Outcomes: ${outcomes.join(", ")}`);
        console.log(`Shares Distributed:`);
        shares.forEach((s: any, i: number) => {
            console.log(`  Outcome ${i} (${outcomes[i]}): ${ethers.formatUnits(s, 18)}`);
        });
        console.log(`Liquidity Param: ${basic[5]}`);

    } catch (e: any) {
        console.error("Error fetching market data:", e.message);
    }
}

main().catch(console.error);
