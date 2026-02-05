
import { ethers } from "hardhat";

async function main() {
    // 1. Setup
    const MARKET_ADDRESS = "0x390114d8a1822359e4238Cb7E531147eD1aE5adB"; // From address.txt
    const USDC_ADDRESS = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"; // BSC Mainnet USDC
    const RPC_URL = "https://bsc-dataseed.binance.org/"; // Official BSC RPC

    console.log("🔍 Connecting to BSC Mainnet...");
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // 2. ABIs
    const MARKET_ABI = [
        "function accumulatedFees() view returns (uint256)",
        "function protocolFee() view returns (uint256)",
        "function marketCount() view returns (uint256)",
        "function owner() view returns (address)",
        "function getToken() view returns (address)"
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
        const feesRaw = await market.accumulatedFees();
        const balanceRaw = await usdc.balanceOf(MARKET_ADDRESS);
        const feeRate = await market.protocolFee();
        const count = await market.marketCount();
        const decimals = await usdc.decimals();
        const symbol = await usdc.symbol();

        // 5. Format
        const fees = ethers.formatUnits(feesRaw, decimals);
        const balance = ethers.formatUnits(balanceRaw, decimals);
        const rate = Number(feeRate) / 100; // 500 = 5%

        // 6. Report
        console.log("\n💰 Financials:");
        console.log(`- Total TVL (Current Balance): ${balance} ${symbol}`);
        console.log(`- Accumulated Fees:          ${fees} ${symbol}`);
        console.log(`- Protocol Fee Rate:         ${rate}%`);

        console.log("\n📈 Activity:");
        console.log(`- Total Markets Created:     ${count}`);

        console.log("\n---------------------------------------------------");
        if (Number(fees) > 0) {
            console.log(`✅ You have claimable fees!`);
        } else {
            console.log(`ℹ️  No fees accumulated yet.`);
        }

    } catch (e) {
        console.error("\n❌ Error querying contract:");
        console.error(e);
        console.log("\nPossible causes:");
        console.log("1. Wrong Contract Address?");
        console.log("2. Not on BSC Mainnet?");
        console.log("3. RPC Issue?");
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
