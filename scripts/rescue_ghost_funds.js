const { ethers } = require("ethers");
require("dotenv").config();

const RPCS = [
    "https://bsc-dataseed1.defibit.io/",
    "https://bsc-dataseed.binance.org/",
    "https://bsc-rpc.publicnode.com"
];

// The "Ghost" Market where funds are stuck
const GHOST_MARKET_ADDR = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";

const ABI = [
    "function withdraw(uint256 amount) external",
    "function userBalances(address) view returns (uint256)"
];

async function main() {
    console.log("Initializing Rescue from Ghost Market...");
    console.log("Target Contract:", GHOST_MARKET_ADDR);

    // 1. Setup Provider
    let provider;
    for (const rpc of RPCS) {
        try { provider = new ethers.JsonRpcProvider(rpc); await provider.getNetwork(); break; } catch (e) { }
    }
    if (!provider) { console.error("No RPC."); return; }

    // 2. Setup Wallet (User needs to put THEIR key in .env)
    if (!process.env.PRIVATE_KEY) {
        console.error("❌ MISSING PRIVATE_KEY in .env");
        console.error("Please add the PRIVATE_KEY of the affected user (0x93...) to .env to withdraw.");
        return;
    }

    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log("Signer Address:", wallet.address);

    const contract = new ethers.Contract(GHOST_MARKET_ADDR, ABI, wallet);

    // 3. Check Balance
    const balance = await contract.userBalances(wallet.address);
    console.log(`Balance in Ghost Market: ${ethers.formatUnits(balance, 6)} USDC`);

    if (balance == 0n) {
        console.log("No funds to withdraw.");
        return;
    }

    // 4. Withdraw
    console.log("Withdrawing all funds...");
    try {
        const tx = await contract.withdraw(balance);
        console.log("Transaction Sent:", tx.hash);
        await tx.wait();
        console.log("✅ Withdrawal Successful! Funds returned to wallet.");
    } catch (e) {
        console.error("Withdrawal Failed:", e.message);
    }
}

main().catch(console.error);
