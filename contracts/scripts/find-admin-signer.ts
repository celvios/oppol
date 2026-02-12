import { ethers } from "hardhat";

async function main() {
    const MARKET_ADDRESS = "0xB6a211822649a61163b94cf46e6fCE46119D3E1b";
    const market = await ethers.getContractAt("PredictionMarketMultiV2", MARKET_ADDRESS);

    const owner = await market.owner();
    console.log("Contract Owner Address:", owner);

    const signers = await ethers.getSigners();
    console.log(`\nChecking ${signers.length} local signers...`);

    let adminSigner = null;

    for (const signer of signers) {
        console.log(`- Signer: ${signer.address}`);
        if (signer.address.toLowerCase() === owner.toLowerCase()) {
            console.log("✅ FOUND ADMIN SIGNER!");
            adminSigner = signer;
            break;
        }
    }

    if (adminSigner) {
        console.log("\nReady to create 5-hour market as Admin.");
    } else {
        console.log("\n❌ No local signer matches the contract owner.");
        console.log("Please add the owner private key to your .env file.");
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
