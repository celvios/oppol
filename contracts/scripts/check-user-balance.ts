
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import path from "path";

// Load env
const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

const USDC_ADDRESS = '0x87D45E316f5f1f2faffCb600c97160658B799Ee0';
const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';

const TARGET_ADDRESS = "0xD70ebD0Faa2D1547260176278e0cdE4b3AC41D2a";

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // Check ETH Balance (BNB)
    const bnbBal = await provider.getBalance(TARGET_ADDRESS);
    console.log(`BNB Balance: ${ethers.formatEther(bnbBal)}`);

    // Check USDC Balance
    const usdcAbi = ["function balanceOf(address) view returns (uint256)"];
    const usdc = new ethers.Contract(USDC_ADDRESS, usdcAbi, provider);
    const bal = await usdc.balanceOf(TARGET_ADDRESS);

    console.log(`USDC Balance: ${ethers.formatUnits(bal, 6)}`);
}

main();
