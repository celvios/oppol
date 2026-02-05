import { ethers } from "ethers";
import * as dotenv from "dotenv";
import path from "path";

// Load env
const envPath = path.resolve(__dirname, "../../.env");
dotenv.config({ path: envPath });

const USDC_ADDRESS = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'; // USDC on BSC mainnet
const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-rpc.publicnode.com';
const USER_ADDRESS = "0x93Edd0429c6Ac4B3644A174Ade5E9d4412E43680";

async function checkUserBalance() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    console.log(`Checking balance for: ${USER_ADDRESS}`);
    
    // Check BNB Balance
    const bnbBal = await provider.getBalance(USER_ADDRESS);
    console.log(`BNB Balance: ${ethers.formatEther(bnbBal)}`);

    // Check USDC Balance
    const usdcAbi = [
        "function balanceOf(address) view returns (uint256)",
        "function decimals() view returns (uint8)"
    ];
    
    try {
        const usdc = new ethers.Contract(USDC_ADDRESS, usdcAbi, provider);
        const balance = await usdc.balanceOf(USER_ADDRESS);
        const decimals = await usdc.decimals();
        
        console.log(`USDC Balance: ${ethers.formatUnits(balance, decimals)}`);
        console.log(`Raw USDC Balance: ${balance.toString()}`);
        
        // Check recent transactions
        console.log("\nChecking recent transactions...");
        const latestBlock = await provider.getBlockNumber();
        console.log(`Latest block: ${latestBlock}`);
        
        // Get transaction history (last 1000 blocks)
        const fromBlock = Math.max(0, latestBlock - 1000);
        
        const filter = {
            address: USDC_ADDRESS,
            topics: [
                ethers.id("Transfer(address,address,uint256)"),
                null,
                ethers.zeroPadValue(USER_ADDRESS, 32)
            ],
            fromBlock: fromBlock,
            toBlock: latestBlock
        };
        
        const logs = await provider.getLogs(filter);
        console.log(`Found ${logs.length} incoming USDC transfers in last 1000 blocks`);
        
        for (const log of logs.slice(-5)) { // Show last 5 transfers
            const decoded = ethers.AbiCoder.defaultAbiCoder().decode(
                ["uint256"], 
                log.data
            );
            const amount = ethers.formatUnits(decoded[0], decimals);
            const block = await provider.getBlock(log.blockNumber);
            console.log(`- Block ${log.blockNumber}: ${amount} USDC (${new Date(block.timestamp * 1000).toISOString()})`);
        }
        
    } catch (error) {
        console.error("Error checking USDC balance:", error.message);
    }
}

checkUserBalance().catch(console.error);