import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.join(__dirname, "../.env") });

async function checkBalance() {
    console.log("🔍 Checking deployer wallet balance...");

    // Connect to BSC Mainnet via public node
    const provider = new ethers.JsonRpcProvider("https://bsc-dataseed1.binance.org/");

    // Get private key from .env
    const privateKey = process.env.PRIVATE_KEY;
    if (!privateKey) {
        console.error("❌ PRIVATE_KEY is missing from .env");
        return;
    }

    try {
        const wallet = new ethers.Wallet(privateKey, provider);
        console.log(`\n================================`);
        console.log(`✅ Deployer Address: ${wallet.address}`);

        const balance = await provider.getBalance(wallet.address);
        console.log(`💰 BNB Balance: ${ethers.formatEther(balance)} BNB`);
        console.log(`================================\n`);

        if (balance === 0n) {
            console.log("⚠️ This address has exactly 0 BNB. You must send BNB to the address printed above to pay for transaction gas.");
        }
    } catch (error) {
        console.error("❌ Failed to load wallet or fetch balance:", error);
    }
}

checkBalance();
