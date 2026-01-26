const { ethers } = require("ethers");
require("dotenv").config();

const RPCS = [
    "https://bsc-dataseed1.defibit.io/",
    "https://bsc-dataseed.binance.org/",
    "https://bsc-rpc.publicnode.com"
];

const ZAP_ADDR = "0xAdeA2580607B668735B065E22fdF66404C90A12A";
const WBNB_ADDR = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c"; // BSC Mainnet WBNB

const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

async function main() {
    console.log("Checking Zap Balance...");

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

    const wbnb = new ethers.Contract(WBNB_ADDR, ERC20_ABI, provider);
    const balance = await wbnb.balanceOf(ZAP_ADDR);

    console.log("WBNB Address:", WBNB_ADDR);
    console.log("Stuck WBNB in Zap Contract:", ethers.formatUnits(balance, 18));
}

main().catch(console.error);
