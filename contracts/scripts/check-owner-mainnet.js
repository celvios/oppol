const { ethers } = require("hardhat");

async function main() {
    const MARKET_ADDRESS = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    console.log("Checking owner for:", MARKET_ADDRESS);

    // We only need the owner function
    const abi = ["function owner() view returns (address)"];

    try {
        const [signer] = await ethers.getSigners();
        // Connect to BSC Mainnet via the provider configured in hardhat config
        const contract = new ethers.Contract(MARKET_ADDRESS, abi, signer);

        const owner = await contract.owner();
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");
        console.log("👑 Contract Owner:", owner);
        console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━");

        if (owner.toLowerCase() === signer.address.toLowerCase()) {
            console.log("✅ YOU (deployer) are the owner.");
        } else {
            console.log("⚠️ YOU are NOT the owner.");
            console.log("   Your address:", signer.address);
        }

    } catch (error) {
        console.error("Failed to get owner. The contract might verify code size or network incorrect.");
        console.error(error);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
