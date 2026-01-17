import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const RPC_URL = 'https://bsc-testnet-rpc.publicnode.com'; // Hardcoded for reliability
const USDC_ADDR = '0x16E4A3d9697D47c61De3bDD1DdDa4148aA09D634';
const TARGET_ADDR = '0x42501490f7c291b4B28110900c9Bd81f3B35B849';

const ABI = ['function balanceOf(address) view returns (uint256)'];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(USDC_ADDR, ABI, provider);

    console.log(`Checking USDC balance for: ${TARGET_ADDR}`);
    const balance = await contract.balanceOf(TARGET_ADDR);

    console.log(`Raw Balance: ${balance.toString()}`);
    console.log(`Formatted: ${ethers.formatUnits(balance, 6)} USDC`);
}

main().catch(console.error);
