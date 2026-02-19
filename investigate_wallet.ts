
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    const privateKey = "0x9e45d80adad2f53d67fe3bbda4c107643d523e8ce65ccd10f3066504b4f12fd8";
    const providerUrl = "https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/";

    // Admin Wallet from .env (hardcoded for comparison based on previous reading)
    const envAdminWallet = "0xa4B1B886f955b2342bC9bB4f77B80839357378b7";

    const provider = new ethers.JsonRpcProvider(providerUrl);
    const wallet = new ethers.Wallet(privateKey, provider);

    console.log("--- Wallet Investigation ---");
    console.log("Private Key Provided: (HIDDEN)");
    console.log("Derived Address:     ", wallet.address);
    console.log("Admin Wallet in .env:", envAdminWallet);

    if (wallet.address !== envAdminWallet) {
        console.warn("WARNING: The derived address DOES NOT MATCH the Admin Wallet in .env!");
        console.warn(`Difference: \nDerived: ${wallet.address}\nEnv:     ${envAdminWallet}`);
    } else {
        console.log("Matches .env Admin Wallet: YES");
    }

    try {
        const balance = await provider.getBalance(wallet.address);
        const balanceEth = ethers.formatEther(balance);
        const nonce = await provider.getTransactionCount(wallet.address);

        console.log("\nCurrent Balance (BNB):", balanceEth);
        console.log("Transaction Count (Nonce):", nonce);

        // Estimate gas spent strictly from nonce is hard without history.
        // But if nonce is high, they did many txs.

    } catch (error) {
        console.error("Error fetching data:", error);
    }
}

main().catch(console.error);
