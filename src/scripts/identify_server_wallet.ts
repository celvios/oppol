import dotenv from 'dotenv';
import { ethers } from 'ethers';
import path from 'path';

// Try to load env from multiple locations
dotenv.config({ path: path.join(__dirname, '../../.env') });

async function main() {
    const pk = process.env.PRIVATE_KEY || process.env.OPERATOR_PRIVATE_KEY;
    if (!pk) {
        console.error("❌ No PRIVATE_KEY or OPERATOR_PRIVATE_KEY found in env.");
        process.exit(1);
    }

    const wallet = new ethers.Wallet(pk);
    console.log("\n🔑 Server Identity Found:");
    console.log("   Address:", wallet.address);
    console.log("   (Derived from PRIVATE_KEY in .env)\n");
}

main();
