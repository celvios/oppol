import { ethers } from "hardhat";
import * as dotenv from "dotenv";

dotenv.config();

async function main() {
    const key = process.env.ADMIN_KEY;
    if (!key) {
        console.error("❌ Error: ADMIN_KEY not found in .env file.");
        process.exit(1);
    }

    const wallet = new ethers.Wallet(key);
    console.log("---------------------------------------------------");
    console.log("🔑 Checking Key Address:", wallet.address);
    console.log("---------------------------------------------------");

    const addresses = [
        "0xB6a211822649a61163b94cf46e6fCE46119D3E1b", // Latest
        "0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6"  // Fallback
    ];

    for (const addr of addresses) {
        console.log(`\nChecking Contract: ${addr}`);
        try {
            // Use default provider (from hardhat config)
            const market = await ethers.getContractAt("PredictionMarketMultiV2", addr);
            const owner = await market.owner();
            console.log("  ✅ Owner:", owner);

            if (owner.toLowerCase() === wallet.address.toLowerCase()) {
                console.log("  🎉 SUCCESS! Key matches Owner.");
            } else {
                console.log("  ❌ MISMATCH. Key is not owner.");
            }
        } catch (e: any) {
            console.log(`  ⚠️ Error reading owner: ${e.message}`);
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
