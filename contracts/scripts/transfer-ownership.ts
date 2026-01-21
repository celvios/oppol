import { ethers } from "hardhat";

async function main() {
    const NEW_OWNER = "0xa4B1B886f955b2342bC9bB4f7B80839357378b76"; // Server Wallet from error log
    const CONTRACT_ADDRESS = "0xA7DEd30e8A292dAA8e75A8d288393f8e290f9717"; // Contract from error log

    console.log(`\n👑 Transferring Ownership`);
    console.log(`Contract:  ${CONTRACT_ADDRESS}`);
    console.log(`New Owner: ${NEW_OWNER}`);

    const [signer] = await ethers.getSigners();
    console.log(`\nCaller:    ${signer.address}`);

    const contract = await ethers.getContractAt("PredictionMarketMultiV2", CONTRACT_ADDRESS);

    // Check current owner
    const currentOwner = await contract.owner();
    console.log(`Current:   ${currentOwner}`);

    if (currentOwner.toLowerCase() === NEW_OWNER.toLowerCase()) {
        console.log("\n✅ Target wallet is ALREADY the owner.");
        return;
    }

    if (currentOwner.toLowerCase() !== signer.address.toLowerCase()) {
        console.error("\n❌ Caller is NOT the current owner. Cannot transfer.");
        return;
    }

    // Transfer
    console.log("\nSending transaction...");
    const tx = await contract.transferOwnership(NEW_OWNER);
    console.log(`Tx Hash: ${tx.hash}`);

    await tx.wait();
    console.log("\n✅ Ownership transferred successfully!");
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
