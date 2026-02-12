import { ethers } from "hardhat";

async function main() {
    const RPC_URL = "https://bsc-dataseed.binance.org/";
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // List of all known contract addresses from codebase
    const CONTRACTS = {
        "LATEST_V2": "0xB6a211822649a61163b94cf46e6fCE46119D3E1b",
        "V1_CORRECT": "0xe3Eb84D7e271A5C44B27578547f69C80c497355B",
        "FALLBACK_OLD": "0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6",
        "BSC_TESTNET_ADDR": "0xA7DEd30e8A292dAA8e75A8d288393f8e290f9717",
        "ADMIN_WALLET": "0xa4B1B886f955b2342bC9bB4f77B80839357378b76" // Maybe funds sent here by mistake?
    };
    const USDC_ADDRESS = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"; // BSC-USD

    const erc20Abi = [
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)",
        "function symbol() view returns (string)"
    ];

    const usdc = new ethers.Contract(USDC_ADDRESS, erc20Abi, provider);

    console.log("-----------------------------------------");
    console.log("🔍 Checking Liquidity Across All Contractors");
    console.log("USDC Contract:", USDC_ADDRESS);

    for (const [name, addr] of Object.entries(CONTRACTS)) {
        try {
            const balance = await usdc.balanceOf(addr);
            const decimals = await usdc.decimals();
            // const symbol = await usdc.symbol(); 

            console.log(`\nChecking ${name}: ${addr}`);
            console.log(`  Balance: ${ethers.formatUnits(balance, decimals)} USDC`);

            if (balance > 0n) {
                console.log("  ✅ FUNDS FOUND HERE!");
            }
        } catch (e: any) {
            console.log(`  Error checking ${name}: ${e.message}`);
        }
    }
}

main();
