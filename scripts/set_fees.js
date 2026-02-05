
const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
    // 1. Configuration
    const MARKET_ADDRESS = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    const NEW_FEE_BPS = 500; // 500 Basis Points = 5%

    // Official RPCs
    const RPCS = [
        "https://bsc-dataseed.binance.org/",
        "https://bsc-dataseed1.defibit.io/",
        "https://bsc-rpc.publicnode.com"
    ];

    console.log(`🔍 Connecting to BSC to set fees to ${NEW_FEE_BPS / 100}%...`);

    // 2. Setup Provider & Wallet
    let provider;
    for (const rpc of RPCS) {
        try {
            const tempProvider = new ethers.JsonRpcProvider(rpc);
            await tempProvider.getNetwork();
            provider = tempProvider;
            console.log(`✅ Connected to: ${rpc}`);
            break;
        } catch (e) { }
    }

    if (!provider) {
        console.error("❌ Could not connect to RPC.");
        return;
    }

    const privateKey = process.env.PRIVATE_KEY || process.env.DEPLOYER_KEY;
    if (!privateKey) {
        console.error("❌ Missing PRIVATE_KEY or DEPLOYER_KEY in .env");
        return;
    }

    const wallet = new ethers.Wallet(privateKey, provider);
    console.log(`wallet: ${wallet.address}`);

    // 3. Contract Setup
    const ABI = [
        "function setProtocolFee(uint256 _fee) external",
        "function protocolFee() view returns (uint256)",
        "function owner() view returns (address)"
    ];

    const market = new ethers.Contract(MARKET_ADDRESS, ABI, wallet);

    // 4. Verify Ownership
    const owner = await market.owner();
    if (owner.toLowerCase() !== wallet.address.toLowerCase()) {
        console.error(`\n❌ PERMISSION DENIED`);
        console.error(`Contract Owner: ${owner}`);
        console.error(`Your Wallet:    ${wallet.address}`);
        console.error("You must use the owner wallet to set fees.");
        return;
    }

    // 5. Execute Transaction
    console.log(`\n⚙️  Setting Protocol Fee to ${NEW_FEE_BPS} (${NEW_FEE_BPS / 100}%)...`);

    try {
        const tx = await market.setProtocolFee(NEW_FEE_BPS);
        console.log(`🚀 Transaction Sent: ${tx.hash}`);
        console.log("Waiting for confirmation...");

        await tx.wait();
        console.log("✅ Confirmation received!");

        // 6. Verify
        const newFee = await market.protocolFee();
        console.log(`\n🎉 Success! New Protocol Fee: ${Number(newFee) / 100}%`);

    } catch (e) {
        console.error("\n❌ Transaction Failed:");
        console.error(e.message);
    }
}

main().catch(console.error);
