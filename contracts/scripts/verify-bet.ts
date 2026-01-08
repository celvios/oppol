import { ethers } from "hardhat";

async function main() {
    console.log("--- ONE-OFF VERIFICATION START ---");

    // Same Hardhat Account #0
    const HARDHAT_KEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff15';
    // const provider = new ethers.JsonRpcProvider('http://127.0.0.1:8545'); 
    // In Hardhat script, 'ethers.provider' is already connected to network
    const provider = ethers.provider;
    const signer = new ethers.Wallet(HARDHAT_KEY, provider);

    const MARKET_ADDR = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
    // const USDC_ADDR = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

    // We need to resolve USDC address if it's not standard (but checking deployed logs it is standard)
    const USDC_ADDR = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

    console.log(`Using Signer: ${signer.address}`);
    const bal = await provider.getBalance(signer.address);
    console.log(`ETH Balance: ${ethers.formatEther(bal)}`);

    const marketCode = await provider.getCode(MARKET_ADDR);
    console.log(`Market Code Len: ${marketCode.length}`);

    if (marketCode === '0x') {
        throw new Error("Market contract NOT found!");
    }

    const market = await ethers.getContractAt("PredictionMarketLMSR", MARKET_ADDR, signer);

    // Check Market Count
    const count = await market.marketCount();
    console.log(`Market Count: ${count}`);

    if (count <= 1n) {
        console.error("Market 1 does not exist!");
    } else {
        console.log("Market 1 exists.");
        const m = await market.markets(1);
        console.log(`Market 1 Liquidity Param: ${m.liquidityParam}`);
        if (m.liquidityParam === 0n) console.error("LIQUIDITY PARAM IS 0! (Panic Source)");
    }

    // Attempt Calculate Cost
    console.log("Calculating cost for 100 YES on Market 1...");
    try {
        const shares = ethers.parseUnits("100", 6);
        const cost = await market.calculateCost(1, true, shares);
        console.log(`Cost: ${ethers.formatUnits(cost, 6)}`);
    } catch (e: any) {
        console.error("Calculate Cost FAILED:");
        console.error(e);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
