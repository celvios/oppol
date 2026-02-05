const { ethers } = require("ethers");
require("dotenv").config();

const RPCS = [
    "https://bsc-dataseed1.defibit.io/",
    "https://bsc-dataseed.binance.org/"
];

const ZAP_ADDR = "0xAdeA2580607B668735B065E22fdF66404C90A12A";
const ZAP_ABI = [
    "function market() view returns (address)",
    "function usdc() view returns (address)"
];

async function main() {
    console.log("Checking Zap Config...");
    let provider;
    for (const rpc of RPCS) {
        try { provider = new ethers.JsonRpcProvider(rpc); await provider.getNetwork(); break; } catch (e) { }
    }

    const zap = new ethers.Contract(ZAP_ADDR, ZAP_ABI, provider);

    try {
        const marketAddr = await zap.market();
        console.log("Zap Linked Market:", marketAddr);

        const usdcAddr = await zap.usdc();
        console.log("Zap Linked USDC:", usdcAddr);
    } catch (e) {
        console.error("Failed to read Zap config:", e.message);
    }
}

main().catch(console.error);
