const { ethers, upgrades } = require("hardhat");

async function main() {
    const PROXY_ADDRESS = process.env.NEXT_PUBLIC_MARKET_ADDRESS || "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    console.log(`🚀 Upgrading to V4 at ${PROXY_ADDRESS}...`);

    const V4Factory = await ethers.getContractFactory("PredictionMarketMultiV4");

    // Start Upgrade
    console.log("Deploying implementation...");
    // Use manual upgrade pattern or plugin?
    // User's previous script used manual UUPS upgradeTo.
    // I should stick to that pattern for consistency and safety.

    const implementation = await V4Factory.deploy();
    await implementation.waitForDeployment();
    const implAddress = await implementation.getAddress();
    console.log(`✅ V4 Implementation Deployed at: ${implAddress}`);

    // Connect to Proxy
    const [signer] = await ethers.getSigners();
    console.log(`🔑 Signer: ${signer.address}`);

    const UUPSABI = [
        "function upgradeTo(address) external",
        "function owner() external view returns (address)"
    ];
    const proxy = new ethers.Contract(PROXY_ADDRESS, UUPSABI, signer);

    try {
        const owner = await proxy.owner();
        console.log(`👑 Proxy Owner: ${owner}`);
        if (owner.toLowerCase() !== signer.address.toLowerCase()) {
            console.warn("⚠️ WARNING: Signer is NOT the owner! Upgrade will likely fail.");
        }
    } catch (e: any) {
        console.log("⚠️ Could not fetch owner (might be transparent proxy?):", e.message);
    }

    console.log("Upgrading Proxy...");
    const tx = await proxy.upgradeTo(implAddress);
    await tx.wait();
    console.log("✅ Proxy Upgraded to V4");

    // Verification step (optional)
    console.log("Verify Etherscan:");
    console.log(`npx hardhat verify --network bsc ${implAddress}`);
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
