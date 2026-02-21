import { ethers } from "ethers";
import * as dotenv from "dotenv";
import * as path from "path";
dotenv.config({ path: path.join(__dirname, "../.env") });

// The compromised key (owner), used ONCE for ownership transfer
const OLD_OWNER_KEY = "0x9e45d80adad2f53d67fe3bbda4c107643d523e8ce65ccd10f3066504b4f12fd8";

async function main() {
    const provider = new ethers.JsonRpcProvider("https://bsc-dataseed1.binance.org/");

    const oldOwnerWallet = new ethers.Wallet(OLD_OWNER_KEY, provider);
    const newSafeWallet = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);

    const contractAddr = process.env.MARKET_CONTRACT || process.env.NEXT_PUBLIC_MARKET_ADDRESS;
    if (!contractAddr) throw new Error("Missing MARKET_CONTRACT in .env");

    console.log("🔑 Old owner (compromised):", oldOwnerWallet.address);
    console.log("🔐 New safe wallet:        ", newSafeWallet.address);
    console.log("📋 Contract:               ", contractAddr);

    const abi = [
        "function owner() view returns (address)",
        "function transferOwnership(address newOwner) external",
        "function withdrawFees() external",
        "function emergencyWithdraw(address _token, address _to, uint256 _amount) external",
    ];
    const contract = new ethers.Contract(contractAddr, abi, oldOwnerWallet);

    // Verify ownership
    const currentOwner = await contract.owner();
    console.log("\nOn-chain owner:", currentOwner);
    if (currentOwner.toLowerCase() !== oldOwnerWallet.address.toLowerCase()) {
        throw new Error("Old key is NOT the current contract owner. Cannot proceed.");
    }
    console.log("✅ Ownership confirmed. Proceeding with USDC rescue...");

    // Step 1: Drain accumulated fees first (they belong to us already)
    try {
        console.log("\n[1/2] Calling withdrawFees() to drain protocol fees...");
        const feesTx = await contract.withdrawFees({ gasLimit: 200_000 });
        await feesTx.wait();
        console.log("✅ Fees withdrawn. Tx:", feesTx.hash);
    } catch (e: any) {
        console.log("ℹ️  withdrawFees skipped (may be 0):", e.message?.slice(0, 80));
    }

    // Step 2: Pull all USDC from the contract to the old owner (which is us)
    const usdcAddr = process.env.USDC_CONTRACT || "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
    const usdcAbi = ["function balanceOf(address) view returns (uint256)"];
    const usdc = new ethers.Contract(usdcAddr, usdcAbi, provider);
    const totalBal = await usdc.balanceOf(contractAddr);
    console.log(`\n[2/2] Draining all USDC (${ethers.formatUnits(totalBal, 18)}) from contract to safe wallet...`);

    const emergTx = await contract.emergencyWithdraw(
        usdcAddr,
        newSafeWallet.address,  // Send directly to safe wallet!
        totalBal,
        { gasLimit: 300_000 }
    );
    await emergTx.wait();
    console.log("✅ USDC drained! Tx:", emergTx.hash);

    // Step 3: Transfer ownership to safe new wallet
    console.log("\n[3/3] Transferring contract ownership to safe wallet...");
    const transferTx = await contract.transferOwnership(newSafeWallet.address, { gasLimit: 100_000 });
    await transferTx.wait();
    console.log("✅ Ownership transferred to:", newSafeWallet.address);
    console.log("✅ Tx:", transferTx.hash);

    // Final balance check
    const newBal = await usdc.balanceOf(contractAddr);
    console.log("\n🎉 RESCUE COMPLETE!");
    console.log("Remaining USDC in contract:", ethers.formatUnits(newBal, 18));
    const ownerBal = await usdc.balanceOf(newSafeWallet.address);
    console.log("USDC in safe wallet       :", ethers.formatUnits(ownerBal, 18));
}

main().catch((err) => {
    console.error("❌ RESCUE FAILED:", err.message || err);
    process.exit(1);
});
