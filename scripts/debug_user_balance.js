const { ethers } = require("ethers");
require("dotenv").config();

const RPCS = [
    "https://bsc-dataseed1.defibit.io/",
    "https://bsc-dataseed.binance.org/",
    "https://bsc-rpc.publicnode.com"
];

// Contracts
const MARKET_ADDR = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B"; // Admin/Zap Market
const USER_ADDR = "0x93Edd0429c6Ac4B3644A174Ade5E9d4412E43680";
const USDC_ADDR = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";

const MARKET_ABI = [
    "function getDepositedBalance(address user) view returns (uint256)",
    "function userBalances(address) view returns (uint256)"
];

const ERC20_ABI = [
    "function balanceOf(address) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

async function main() {
    console.log("Checking balances for:", USER_ADDR);
    console.log("Market Config:", MARKET_ADDR);

    let provider;
    for (const rpc of RPCS) {
        try { provider = new ethers.JsonRpcProvider(rpc); await provider.getNetwork(); break; } catch (e) { }
    }
    if (!provider) { console.error("No RPC."); return; }

    // 1. Check Wallet USDC Balance
    const usdc = new ethers.Contract(USDC_ADDR, ERC20_ABI, provider);
    const walletBalance = await usdc.balanceOf(USER_ADDR);
    console.log("Wallet USDC:", ethers.formatUnits(walletBalance, 18));

    // 2. Check Market Balance
    const market = new ethers.Contract(MARKET_ADDR, MARKET_ABI, provider);

    try {
        const deposited = await market.getDepositedBalance(USER_ADDR);
        console.log("Market Deposited (getDepositedBalance):", ethers.formatUnits(deposited, 18));
    } catch (e) {
        // console.log("getDepositedBalance failed:", e.message);
        try {
            const bal = await market.userBalances(USER_ADDR);
            console.log("Market userBalances (raw):", ethers.formatUnits(bal, 18));
        } catch (e2) {
            console.log("userBalances failed:", e2.message);
        }
    }
}

main().catch(console.error);
