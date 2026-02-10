const { ethers } = require("hardhat");

async function main() {
    const PROXY_ADDRESS = process.env.NEXT_PUBLIC_MARKET_ADDRESS || "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    const [signer] = await ethers.getSigners();
    console.log(`Signer: ${signer.address}`);

    const ABI = ["function owner() view returns (address)"];
    const proxy = new ethers.Contract(PROXY_ADDRESS, ABI, signer);

    try {
        const owner = await proxy.owner();
        console.log(`Proxy Owner: ${owner}`);
        if (owner.toLowerCase() === signer.address.toLowerCase()) {
            console.log("✅ Signer is Owner");
        } else {
            console.log("❌ Signer is NOT Owner");
        }
    } catch (e) {
        console.log("Error fetching owner:", e.message);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
