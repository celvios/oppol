// Simple script to check for custodial wallet patterns
const { ethers } = require("ethers");

const RPC_URL = "https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/";
const USDC_MAINNET = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
const USER_WALLET = "0x93Edd0429c6Ac4B3644A174Ade5E9d4412E43680";

async function investigateDeposit() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    console.log("🔍 Investigating missing $2 deposit...\n");
    
    // Check if user has any outgoing transactions (indicating they sent USDC somewhere)
    console.log("=== CHECKING OUTGOING TRANSACTIONS ===");
    try {
        const latestBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, latestBlock - 5000); // Check last 5000 blocks
        
        // Check for outgoing USDC transfers FROM user's wallet
        const outgoingFilter = {
            address: USDC_MAINNET,
            topics: [
                ethers.id("Transfer(address,address,uint256)"),
                ethers.zeroPadValue(USER_WALLET, 32), // FROM user
                null // TO anyone
            ],
            fromBlock: fromBlock,
            toBlock: latestBlock
        };
        
        const outgoingLogs = await provider.getLogs(outgoingFilter);
        console.log(`Found ${outgoingLogs.length} outgoing USDC transfers from user's wallet`);
        
        if (outgoingLogs.length > 0) {
            console.log("Recent outgoing transfers:");
            for (const log of outgoingLogs.slice(-5)) {
                const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], log.data);
                const amount = ethers.formatUnits(decoded[0], 6);
                const toAddress = ethers.getAddress("0x" + log.topics[2].slice(26));
                const block = await provider.getBlock(log.blockNumber);
                
                console.log(`  - ${amount} USDC to ${toAddress}`);
                console.log(`    Block: ${log.blockNumber}, Time: ${new Date(block.timestamp * 1000).toLocaleString()}`);
                console.log(`    TX: ${log.transactionHash}\n`);
            }
        }
        
        // Check for ANY incoming transactions to user's wallet (not just USDC)
        console.log("=== CHECKING ALL INCOMING TRANSACTIONS ===");
        const txHistory = await provider.getHistory(USER_WALLET);
        console.log(`Found ${txHistory.length} total transactions for this wallet`);
        
        if (txHistory.length > 0) {
            console.log("Recent transactions:");
            for (const tx of txHistory.slice(-5)) {
                console.log(`  - ${tx.hash}`);
                console.log(`    From: ${tx.from} To: ${tx.to}`);
                console.log(`    Value: ${ethers.formatEther(tx.value)} BNB`);
                console.log(`    Block: ${tx.blockNumber}\n`);
            }
        }
        
    } catch (error) {
        console.error("Error checking transactions:", error.message);
    }
    
    console.log("=== RECOMMENDATIONS ===");
    console.log("1. Ask user for the transaction hash of their $2 deposit");
    console.log("2. Check if your system uses custodial wallets");
    console.log("3. Verify which network the user deposited on");
    console.log("4. Check your internal database for pending deposits");
    console.log("5. The 2000.0 USDC in balance_final.txt might be test data");
}

investigateDeposit().catch(console.error);