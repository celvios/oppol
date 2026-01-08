import { ethers } from "hardhat";

async function main() {
    console.log("--- BUY VERIFICATION START ---");

    const mnemonic = "test test test test test test test test test test test junk";
    // In Hardhat script, we can get signer from ethers directly or create wallet
    // Use JsonRpcProvider with staticNetwork to avoid nonce detection issues
    const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545", undefined, { staticNetwork: true });
    const signer = ethers.Wallet.fromPhrase(mnemonic).connect(provider);

    const MARKET_ADDR = '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512';
    const USDC_ADDR = '0x5FbDB2315678afecb367f032d93F642f64180aa3';

    console.log(`Using Signer: ${signer.address}`);

    const usdc = await ethers.getContractAt("MockUSDC", USDC_ADDR, signer);
    const market = await ethers.getContractAt("PredictionMarketLMSR", MARKET_ADDR, signer);

    console.log("Checking Balances...");
    const usdcBal = await usdc.balanceOf(signer.address);
    // Get Nonce Manually
    const nonce = await provider.getTransactionCount(signer.address);
    console.log(`USDC Balance: ${ethers.formatUnits(usdcBal, 6)} | Nonce: ${nonce}`);

    console.log("approving...");
    // Use manual nonce
    const txApprove = await usdc.approve(MARKET_ADDR, ethers.MaxUint256, { nonce: nonce });
    await txApprove.wait();
    console.log("Approved.");

    const marketId = 1;
    const isYes = true;
    const shares = 100;
    const sharesInUnits = ethers.parseUnits(shares.toString(), 6);

    console.log("Calculating cost...");
    const cost = await market.calculateCost(marketId, isYes, sharesInUnits);
    console.log(`Cost: ${ethers.formatUnits(cost, 6)}`);

    const maxCost = cost + (cost * 5n) / 100n;
    console.log(`MaxCost: ${ethers.formatUnits(maxCost, 6)}`);

    console.log("Executing Buy...");
    try {
        const tx = await market.buyShares(marketId, isYes, sharesInUnits, maxCost, { nonce: nonce + 1 });
        console.log("Tx sent:", tx.hash);
        const receipt = await tx.wait();
        console.log("Tx mined!", receipt.hash);
    } catch (e: any) {
        console.error("BUY FAILED:", e);
    }
}

main().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
