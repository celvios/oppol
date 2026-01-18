
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Load env
const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

const USDC_ADDRESS = process.env.USDC_CONTRACT || '0xa7d8e3da8CAc0083B46584F416b98AB934a1Ed0b';
const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) {
    console.error("❌ PRIVATE_KEY is missing in .env");
    process.exit(1);
}

// Target Address from user request
const TARGET_ADDRESS = "0xE434423371E3AacAF0fF8fC0B3Ef1F521e82CCC1";
const AMOUNT_USDC = 2000;

async function main() {
    console.log(`🚀 Connecting to RPC: ${RPC_URL}`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const wallet = new ethers.Wallet(PRIVATE_KEY!, provider);

    console.log(`🔐 Operator Wallet: ${wallet.address}`);
    const balance = await provider.getBalance(wallet.address);
    console.log(`💰 BNB Balance: ${ethers.formatEther(balance)} BNB`);

    const usdcAbi = [
        "function transfer(address to, uint256 amount) returns (bool)",
        "function balanceOf(address account) view returns (uint256)",
        "function decimals() view returns (uint8)"
    ];

    const usdc = new ethers.Contract(USDC_ADDRESS, usdcAbi, wallet);

    // Check Operator USDC Balance
    const usdcBal = await usdc.balanceOf(wallet.address);
    const decimals = await usdc.decimals();
    console.log(`💵 Operator USDC Balance: ${ethers.formatUnits(usdcBal, decimals)} USDC`);

    // Amount to Send
    const amountInWei = ethers.parseUnits(AMOUNT_USDC.toString(), decimals);

    if (usdcBal < amountInWei) {
        console.error("❌ Insufficient USDC balance in Operator Wallet!");
        console.log(`Required: ${AMOUNT_USDC} USDC`);
        console.log(`Has: ${ethers.formatUnits(usdcBal, decimals)} USDC`);

        // Try to MINT if it's testnet mock token?
        // Check if mint function exists?
        // Assuming Standard Token.
        process.exit(1);
    }

    console.log(`💸 Sending ${AMOUNT_USDC} USDC to ${TARGET_ADDRESS}...`);

    try {
        const tx = await usdc.transfer(TARGET_ADDRESS, amountInWei);
        console.log(`⏳ TX Sent: ${tx.hash}`);
        await tx.wait();
        console.log(`✅ Success! Sent ${AMOUNT_USDC} USDC to ${TARGET_ADDRESS}`);
    } catch (error: any) {
        console.error("❌ Transfer Failed:", error.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
