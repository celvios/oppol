
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import path from "path";

// Load env explicitly
const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

const USDC_ADDRESS = "0x87D45E316f5f1f2faffCb600c97160658B799Ee0";
const TARGET_ADDRESS = "0xD70ebD0Faa2D1547260176278e0cdE4b3AC41D2a";
const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-testnet.bnbchain.org';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

// Minimal ABI for Minting
const MOCK_USDC_ABI = [
    "function mint(address to, uint256 amount) external",
    "function balanceOf(address account) external view returns (uint256)",
    "function decimals() external view returns (uint8)"
];

async function main() {
    console.log("🚀 Starting Standalone Mint Script...");

    if (!PRIVATE_KEY) {
        throw new Error("❌ PRIVATE_KEY missing in .env");
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`🔑 Signer: ${wallet.address}`);

    // Check Gas
    const bnbBal = await provider.getBalance(wallet.address);
    console.log(`⛽ BNB Balance: ${ethers.formatEther(bnbBal)}`);

    if (bnbBal === BigInt(0)) {
        throw new Error("❌ Insufficient Gas (0 BNB). Cannot transaction.");
    }

    const usdc = new ethers.Contract(USDC_ADDRESS, MOCK_USDC_ABI, wallet);

    // Mint 2000 USDC (6 decimals)
    const AMOUNT = ethers.parseUnits("2000", 6);

    console.log(`💸 Minting 2000 USDC to ${TARGET_ADDRESS}...`);

    try {
        const tx = await usdc.mint(TARGET_ADDRESS, AMOUNT);
        console.log(`⏳ TX Sent: ${tx.hash}`);
        await tx.wait();
        console.log("✅ Mint Successful!");

        // Verify
        const finalBal = await usdc.balanceOf(TARGET_ADDRESS);
        console.log(`💰 New Balance: ${ethers.formatUnits(finalBal, 6)} USDC`);

    } catch (error: any) {
        console.error("❌ Mint Failed:", error);
        // Add specific handling for 'Caller is not owner'
        if (error.message.includes("Ownable: caller is not the owner")) {
            console.error("⚠️ REASON: You are not the owner of the USDC contract!");
        }
        process.exit(1);
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
