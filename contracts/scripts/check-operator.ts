
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import path from "path";

const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-testnet.bnbchain.org';
const PRIVATE_KEY = process.env.PRIVATE_KEY;
const TARGET_ADDRESS = "0xD70ebD0Faa2D1547260176278e0cdE4b3AC41D2a";
const USDC_ADDRESS = "0x87D45E316f5f1f2faffCb600c97160658B799Ee0";

async function main() {
    console.log("🔍 Checking Operator Status...");
    if (!PRIVATE_KEY) {
        console.error("❌ NO PRIVATE KEY FOUND!");
        process.exit(1);
    }

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

    console.log(`👤 Operator Address: ${wallet.address}`);

    // Check BNB
    const bnbBal = await provider.getBalance(wallet.address);
    console.log(`⛽ Operator BNB: ${ethers.formatEther(bnbBal)} BNB`);

    // Check Operator USDC
    const usdcAbi = ["function balanceOf(address) view returns (uint256)"];
    const usdc = new ethers.Contract(USDC_ADDRESS, usdcAbi, provider);
    const opUsdc = await usdc.balanceOf(wallet.address);
    console.log(`💵 Operator USDC: ${ethers.formatUnits(opUsdc, 6)} USDC`);

    // Check User USDC
    const userUsdc = await usdc.balanceOf(TARGET_ADDRESS);
    console.log(`👤 User USDC: ${ethers.formatUnits(userUsdc, 6)} USDC`);
}

main().catch(console.error);
