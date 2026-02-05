import { ethers } from "ethers";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const RPC_URL = "https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/";
const USDC_MAINNET = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
const USER_WALLET = "0x93Edd0429c6Ac4B3644A174Ade5E9d4412E43680";

async function investigateDeposit() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    console.log("🔍 Investigating missing $2 deposit...\n");
    
    try {
        const latestBlock = await provider.getBlockNumber();
        const fromBlock = Math.max(0, latestBlock - 5000);
        
        // Check outgoing USDC transfers
        const outgoingFilter = {
            address: USDC_MAINNET,
            topics: [
                ethers.id("Transfer(address,address,uint256)"),
                ethers.zeroPadValue(USER_WALLET, 32),
                null
            ],
            fromBlock: fromBlock,
            toBlock: latestBlock
        };
        
        const outgoingLogs = await provider.getLogs(outgoingFilter);
        console.log(`Found ${outgoingLogs.length} outgoing USDC transfers`);
        
        for (const log of outgoingLogs.slice(-3)) {
            const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], log.data);
            const amount = ethers.formatUnits(decoded[0], 6);
            const toAddress = ethers.getAddress("0x" + log.topics[2].slice(26));
            console.log(`  - ${amount} USDC to ${toAddress} (TX: ${log.transactionHash})`);
        }
        
        // Check transaction history
        const txHistory = await provider.getHistory(USER_WALLET);
        console.log(`\nFound ${txHistory.length} total transactions`);
        
        for (const tx of txHistory.slice(-3)) {
            console.log(`  - ${tx.hash} | ${ethers.formatEther(tx.value)} BNB | Block: ${tx.blockNumber}`);
        }
        
    } catch (error) {
        console.error("Error:", error.message);
    }
}

investigateDeposit().catch(console.error);