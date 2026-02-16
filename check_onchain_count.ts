import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, './.env') });

const RPC_URL = process.env.BNB_RPC_URL || "https://bsc-rpc.publicnode.com";
const MARKET_ADDRESS = process.env.NEXT_PUBLIC_MARKET_ADDRESS;

async function run() {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const abi = ["function marketCount() view returns (uint256)"];
        const contract = new ethers.Contract(MARKET_ADDRESS!, abi, provider);

        const count = await contract.marketCount();
        console.log("On-chain marketCount:", count.toString());
    } catch (e: any) {
        console.error("Error:", e.message);
    } finally {
        process.exit(0);
    }
}
run();
