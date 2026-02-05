import { ethers } from "ethers";

async function main() {
    const BC400_TOKEN_ADDRESS = "0x61Fc93c7C070B32B1b1479B86056d8Ec1D7125BD";
    const YOUR_WALLET = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B"; // Replace with actual wallet

    const ABI = [
        "function decimals() view returns (uint8)",
        "function balanceOf(address owner) view returns (uint256)",
        "function symbol() view returns (string)",
        "function name() view returns (string)"
    ];

    const provider = new ethers.JsonRpcProvider("https://bsc-rpc.publicnode.com");
    const token = new ethers.Contract(BC400_TOKEN_ADDRESS, ABI, provider);

    try {
        const decimals = await token.decimals();
        const symbol = await token.symbol();
        const name = await token.name();
        const balance = await token.balanceOf(YOUR_WALLET);

        console.log("=== BC400 Token Info ===");
        console.log(`Name: ${name}`);
        console.log(`Symbol: ${symbol}`);
        console.log(`Decimals: ${decimals}`);
        console.log(`\nYour Balance (raw): ${balance.toString()}`);
        console.log(`Your Balance (formatted): ${ethers.formatUnits(balance, decimals)} ${symbol}`);

        // Check against 10M requirement
        const required = ethers.parseUnits("10000000", decimals);
        console.log(`\nRequired: ${ethers.formatUnits(required, decimals)} ${symbol}`);
        console.log(`Has Access: ${balance >= required ? "✅ YES" : "❌ NO"}`);

    } catch (error) {
        console.error("Error:", error);
    }
}

main().catch(console.error);
