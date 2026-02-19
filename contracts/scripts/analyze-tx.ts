
import { ethers } from "ethers";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const RPC_URL = "https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/";
const TX_HASH = "0x9946dc267afcb2ec72446cd25bcae6d5025a140e748f238e1e3b8a7b4ff18a28";

async function analyzeTx() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    console.log(`🔍 Analyzing transaction: ${TX_HASH}\n`);

    try {
        const tx = await provider.getTransaction(TX_HASH);
        const receipt = await provider.getTransactionReceipt(TX_HASH);

        if (!tx || !receipt) {
            console.log("❌ Transaction not found on BSC mainnet");
            return;
        }

        console.log("=== TRANSACTION DETAILS ===");
        console.log(`From: ${tx.from}`);
        console.log(`To: ${tx.to}`);
        console.log(`Value: ${ethers.formatEther(tx.value)} BNB`);
        console.log(`Status: ${receipt.status === 1 ? '✅ Success' : '❌ Failed'}`);

        if (tx.blockNumber) {
            console.log(`Block: ${tx.blockNumber}`);
            const block = await provider.getBlock(tx.blockNumber);
            if (block) {
                console.log(`Time: ${new Date(block.timestamp * 1000).toLocaleString()}`);
            }
        }

        // Decode input data if possible
        if (tx.data && tx.data !== "0x") {
            console.log(`\nInput Data (Selector): ${tx.data.slice(0, 10)}`);
        }

        console.log("\n=== LOGS/EVENTS ===");
        for (const log of receipt.logs) {
            try {
                if (log.topics[0] === ethers.id("Transfer(address,address,uint256)")) {
                    const from = ethers.getAddress("0x" + log.topics[1].slice(26));
                    const to = ethers.getAddress("0x" + log.topics[2].slice(26));
                    const amount = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], log.data)[0];

                    // Display both 18 and 6 decimals to be safe
                    console.log(`📤 Transfer Event:`);
                    console.log(`   Amount: ${ethers.formatUnits(amount, 18)} (if 18 decimals) / ${ethers.formatUnits(amount, 6)} (if 6 decimals)`);
                    console.log(`   From: ${from}`);
                    console.log(`   To: ${to}`);
                    console.log(`   Contract: ${log.address}`);
                }
            } catch (e: any) {
                console.log(`Log: ${log.address} - ${log.topics[0]}`);
            }
        }

    } catch (error: any) {
        console.error("Error:", error.message);
    }
}

analyzeTx().catch(console.error);