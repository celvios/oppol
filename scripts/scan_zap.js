const { ethers } = require("ethers");
require("dotenv").config();

const RPCS = [
    "https://bsc-dataseed1.defibit.io/",
    "https://bsc-dataseed.binance.org/"
];

const ZAP_ADDR = "0xAdeA2580607B668735B065E22fdF66404C90A12A";
const TOKENS = {
    "USDT": "0x55d398326f99059fF775485246999027B3197955",
    "BUSD": "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56",
    "DAI": "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3"
};

const ERC20_ABI = ["function balanceOf(address) view returns (uint256)"];

async function main() {
    console.log("Scanning Zap Contract...");

    let provider;
    for (const rpc of RPCS) {
        try { provider = new ethers.JsonRpcProvider(rpc); await provider.getNetwork(); break; } catch (e) { }
    }
    if (!provider) return;

    for (const [name, addr] of Object.entries(TOKENS)) {
        const contract = new ethers.Contract(addr, ERC20_ABI, provider);
        const bal = await contract.balanceOf(ZAP_ADDR);
        console.log(`${name}: ${ethers.formatUnits(bal, 18)}`); // Using 18 for simplicity, USDT is 18 on BSC? Check. BUSD is 18.
    }
}

main().catch(console.error);
