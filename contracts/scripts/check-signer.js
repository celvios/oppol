const { ethers } = require("hardhat");

async function main() {
    try {
        const [signer] = await ethers.getSigners();
        console.log("Configured Signer Address:", signer.address);
    } catch (error) {
        console.error("Error getting signer:", error);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
