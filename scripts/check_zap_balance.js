const { ethers } = require("ethers");
require("dotenv").config();

const RPCS = [
    "https://bsc-dataseed1.defibit.io/",
    "https://bsc-dataseed.binance.org/",
    "https://bsc-rpc.publicnode.com"
];

const ZAP_ADDR = "0xAdeA2580607B668735B065E22fdF66404C90A12A";
const USDC_ADDR = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";

const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

async function main() {
    console.log("Checking Zap Contract Balance...");

    // Find working RPC
    let provider;
    for (const rpc of RPCS) {
        try {
            const tempProvider = new ethers.JsonRpcProvider(rpc);
            await tempProvider.getNetwork();
            provider = tempProvider;
            console.log("Connected to:", rpc);
            break;
        } catch (e) { }
    }

    if (!provider) { console.error("No RPC."); return; }

    const usdc = new ethers.Contract(USDC_ADDR, ERC20_ABI, provider);
    const balance = await usdc.balanceOf(ZAP_ADDR);

    console.log("Zap Contract Address:", ZAP_ADDR);
    console.log("Stuck USDC in Zap Contract:", ethers.formatUnits(balance, 18));

    const nativeBal = await provider.getBalance(ZAP_ADDR);
    console.log("Stuck BNB in Zap Contract:", ethers.formatUnits(nativeBal, 18));
}

main().catch(console.error);
