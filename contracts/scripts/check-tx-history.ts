import { ethers } from "ethers";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const RPC_URL = "https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/";
const USDC_MAINNET = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
const USER_WALLET = "0x93Edd0429c6Ac4B3644A174Ade5E9d4412E43680";

async function checkTransactionHistory() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    console.log(`📋 Transaction History for: ${USER_WALLET}\n`);
    
    try {
        const latestBlock = await provider.getBlockNumber();
        console.log(`Latest block: ${latestBlock}`);
        
        // Check last 10,000 blocks for any USDC activity
        const fromBlock = Math.max(0, latestBlock - 10000);
        console.log(`Checking blocks ${fromBlock} to ${latestBlock}\n`);
        
        // Check incoming USDC transfers
        console.log("=== INCOMING USDC TRANSFERS ===");
        const incomingFilter = {
            address: USDC_MAINNET,
            topics: [
                ethers.id("Transfer(address,address,uint256)"),
                null, // from anyone
                ethers.zeroPadValue(USER_WALLET, 32) // to user
            ],
            fromBlock: fromBlock,
            toBlock: latestBlock
        };
        
        const incomingLogs = await provider.getLogs(incomingFilter);
        console.log(`Found ${incomingLogs.length} incoming USDC transfers`);
        
        for (const log of incomingLogs) {
            const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], log.data);
            const amount = ethers.formatUnits(decoded[0], 6);
            const fromAddress = ethers.getAddress("0x" + log.topics[1].slice(26));
            const block = await provider.getBlock(log.blockNumber);
            
            console.log(`📥 ${amount} USDC from ${fromAddress}`);
            console.log(`   Block: ${log.blockNumber} | Time: ${new Date(block.timestamp * 1000).toLocaleString()}`);
            console.log(`   TX: ${log.transactionHash}\n`);
        }
        
        // Check outgoing USDC transfers
        console.log("=== OUTGOING USDC TRANSFERS ===");
        const outgoingFilter = {
            address: USDC_MAINNET,
            topics: [
                ethers.id("Transfer(address,address,uint256)"),
                ethers.zeroPadValue(USER_WALLET, 32), // from user
                null // to anyone
            ],
            fromBlock: fromBlock,
            toBlock: latestBlock
        };
        
        const outgoingLogs = await provider.getLogs(outgoingFilter);
        console.log(`Found ${outgoingLogs.length} outgoing USDC transfers`);
        
        for (const log of outgoingLogs) {
            const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], log.data);
            const amount = ethers.formatUnits(decoded[0], 6);
            const toAddress = ethers.getAddress("0x" + log.topics[2].slice(26));
            const block = await provider.getBlock(log.blockNumber);
            
            console.log(`📤 ${amount} USDC to ${toAddress}`);
            console.log(`   Block: ${log.blockNumber} | Time: ${new Date(block.timestamp * 1000).toLocaleString()}`);
            console.log(`   TX: ${log.transactionHash}\n`);
        }
        
        // Check all transactions (BNB transfers)
        console.log("=== ALL BNB TRANSACTIONS ===");
        const txCount = await provider.getTransactionCount(USER_WALLET);
        console.log(`Total transaction count: ${txCount}`);
        
        // Get recent transactions by checking recent blocks
        const recentTxs = [];
        for (let i = latestBlock; i > latestBlock - 100 && i >= 0; i--) {
            try {
                const block = await provider.getBlock(i, true);
                if (block && block.transactions) {
                    for (const tx of block.transactions) {
                        if (tx.from === USER_WALLET || tx.to === USER_WALLET) {
                            recentTxs.push(tx);
                        }
                    }
                }
            } catch (e) {
                // Skip blocks that can't be fetched
            }
        }
        
        console.log(`Found ${recentTxs.length} recent BNB transactions`);
        for (const tx of recentTxs.slice(-5)) {
            console.log(`💰 ${tx.hash}`);
            console.log(`   From: ${tx.from} To: ${tx.to}`);
            console.log(`   Value: ${ethers.formatEther(tx.value)} BNB\n`);
        }
        
    } catch (error) {
        console.error("Error checking transaction history:", error.message);
    }
}

checkTransactionHistory().catch(console.error);