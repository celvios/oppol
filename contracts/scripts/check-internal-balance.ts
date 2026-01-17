
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
const MARKET_ADDRESS = '0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6';
const USER_ADDRESS = '0xD70ebD0Faa2D1547260176278e0cdE4b3AC41D2a';

const ABI = [
    'function userBalances(address) view returns (uint256)'
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(MARKET_ADDRESS, ABI, provider);

    console.log(`Checking Internal Balance for: ${USER_ADDRESS}`);
    const balance = await contract.userBalances(USER_ADDRESS);

    console.log(`Internal Contract Balance: ${ethers.formatUnits(balance, 6)} USDC`); // USDC is 6 decimals? Actually MockUSDC might be 18
    // Wait, check USDC decimals. MockUSDC usually 18.
    // Let's assume 18 for safety, or print raw.
    console.log(`Raw Balance: ${balance.toString()}`);

    // Check MockUSDC file? Step 1152 view.
    // It inherits ERC20. Default 18.
    // But `assertionBond = 500 * 1e6`.
    // So USDC is 18? or 6?
    // Most testnet USDC is 18. Real USDC is 6.
    // If Mint was 2000 * 10^18.

    // I'll print raw.
}

main();
