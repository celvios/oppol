
import { ethers } from "hardhat";

async function main() {
    const PROXY_ADDRESS = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";

    console.log("🚀 Starting RAW V3 Deployment...");

    const [signer] = await ethers.getSigners();
    console.log(`Signer: ${signer.address}`);

    // 1. Get Factory just to get bytecode
    const V3Factory = await ethers.getContractFactory("PredictionMarketMultiV3");
    const bytecode = V3Factory.bytecode;

    if (!bytecode || bytecode === "0x") {
        throw new Error("Failed to fetch bytecode for PredictionMarketMultiV3");
    }

    console.log("Constructing raw deploy transaction (only data)...");

    const rawTx = {
        data: bytecode,
        // Explicitly undefined 'to' just in case, though omitting it is standard
        to: undefined
    };

    console.log("Sending raw transaction...");
    try {
        const txResponse = await signer.sendTransaction(rawTx);
        console.log(`Deploy Tx Sent: ${txResponse.hash}`);

        console.log("Waiting for confirmation...");
        const receipt = await txResponse.wait();
        const implAddress = receipt?.contractAddress;

        if (!implAddress) {
            throw new Error("No contract address in receipt!");
        }

        console.log(`✅ Implementation Deployed at: ${implAddress}`);

        // 4. Upgrade Proxy
        console.log("Upgrading Proxy...");
        // We can reuse the factory for attachment now that we have an address
        const proxy = V3Factory.attach(PROXY_ADDRESS);

        const upgradeTx = await proxy.upgradeTo(implAddress);
        console.log(`Upgrade Tx: ${upgradeTx.hash}`);
        await upgradeTx.wait();
        console.log("✅ Proxy Upgraded");

        // 5. Initialize
        console.log("Initializing...");
        try {
            const initTx = await proxy.initializeV3();
            await initTx.wait();
            console.log("✅ V3 Initialized");
        } catch (e: any) {
            console.log("⚠️ Initialization warning (expected if already initialized):", e.message);
        }

        // 6. Set Fee
        console.log("Setting Protocol Fee to 10%...");
        try {
            const feeTx = await proxy.setProtocolFee(1000);
            await feeTx.wait();
            console.log("✅ Fees Set");
        } catch (e: any) {
            console.log("⚠️ Set Fee warning:", e.message);
        }

    } catch (e: any) {
        console.error("❌ FATAL ERROR during deployment:", e);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
