
const { ethers } = require("ethers");

// Pancakeswap Addresses
const V2_FACTORY = "0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73";
const V3_FACTORY = "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865";
const WBNB = "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c";
const USDT = "0x55d398326f99059fF775485246999027B3197955";
const BUSD = "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56";
const BC400 = "0xB929177331De755d7aCc5665267a247e458bCdeC";

// RPC
const RPC_URL = "https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/";

const V2_FACTORY_ABI = ["function getPair(address tokenA, address tokenB) external view returns (address pair)"];
const V2_PAIR_ABI = ["function getReserves() external view returns (uint112 reserve0, uint112 reserve1, uint32 blockTimestampLast)", "function token0() view returns (address)"];
const V3_FACTORY_ABI = ["function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool)"];

async function checkV2(provider, tokenA, tokenB, nameA, nameB) {
    const factory = new ethers.Contract(V2_FACTORY, V2_FACTORY_ABI, provider);
    const pair = await factory.getPair(tokenA, tokenB);
    if (pair !== ethers.ZeroAddress) {
        console.log(`[V2] FOUND Pair ${nameA}-${nameB}: ${pair}`);
        const pairContract = new ethers.Contract(pair, V2_PAIR_ABI, provider);
        const reserves = await pairContract.getReserves();
        console.log(`     Reserves: ${reserves[0]} / ${reserves[1]}`);
        return true;
    }
    return false;
}

async function checkV3(provider, tokenA, tokenB, nameA, nameB) {
    const factory = new ethers.Contract(V3_FACTORY, V3_FACTORY_ABI, provider);
    const fees = [100, 500, 2500, 10000];
    let found = false;
    for (const fee of fees) {
        console.log(`     Checking V3 Pool for fee tier ${fee / 10000}%...`);
        const pool = await factory.getPool(tokenA, tokenB, fee);
        if (pool !== ethers.ZeroAddress) {
            console.log(`[V3] FOUND Pool ${nameA}-${nameB} (${fee / 10000}%): ${pool}`);
            found = true;
        }
    }
    return found;
}

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    console.log("Checking Liquidity for BC400:", BC400);

    // Check BNB
    console.log("\n--- WBNB Pairs ---");
    const v2BNB = await checkV2(provider, WBNB, BC400, "WBNB", "BC400");
    const v3BNB = await checkV3(provider, WBNB, BC400, "WBNB", "BC400");
    if (!v2BNB && !v3BNB) console.log("No WBNB pairs found.");

    // Check USDT
    console.log("\n--- USDT Pairs ---");
    const v2USDT = await checkV2(provider, USDT, BC400, "USDT", "BC400");
    const v3USDT = await checkV3(provider, USDT, BC400, "USDT", "BC400");
    if (!v2USDT && !v3USDT) console.log("No USDT pairs found.");

    // Check BUSD
    console.log("\n--- BUSD Pairs ---");
    const v2BUSD = await checkV2(provider, BUSD, BC400, "BUSD", "BC400");
    const v3BUSD = await checkV3(provider, BUSD, BC400, "BUSD", "BC400");
    if (!v2BUSD && !v3BUSD) console.log("No BUSD pairs found.");
}

main().catch(console.error);
