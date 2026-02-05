import { ethers } from "ethers";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const RPC_URL = "https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/";
const USDC_MAINNET = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";

async function checkSystemWallets() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    console.log("🔍 Checking for custodial/system wallets...\n");
    
    // Check if there's a system wallet from env
    const systemWallet = process.env.PRIVATE_KEY;
    if (systemWallet) {
        try {
            const wallet = new ethers.Wallet(systemWallet);
            console.log(`System wallet address: ${wallet.address}`);
            
            // Check this wallet's USDC balance
            const usdcContract = new ethers.Contract(USDC_MAINNET, [
                "function balanceOf(address) view returns (uint256)"
            ], provider);
            
            const balance = await usdcContract.balanceOf(wallet.address);
            console.log(`System wallet USDC balance: ${ethers.formatUnits(balance, 6)}`);
            
            // Check recent incoming transfers to system wallet
            const latestBlock = await provider.getBlockNumber();
            const fromBlock = Math.max(0, latestBlock - 5000);
            
            const filter = {
                address: USDC_MAINNET,
                topics: [
                    ethers.id("Transfer(address,address,uint256)"),
                    null,
                    ethers.zeroPadValue(wallet.address, 32)
                ],
                fromBlock: fromBlock,
                toBlock: latestBlock
            };
            
            const logs = await provider.getLogs(filter);
            console.log(`\nFound ${logs.length} recent USDC transfers to system wallet`);
            
            for (const log of logs.slice(-5)) {
                const decoded = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], log.data);
                const amount = ethers.formatUnits(decoded[0], 6);
                const fromAddress = ethers.getAddress("0x" + log.topics[1].slice(26));
                const block = await provider.getBlock(log.blockNumber);
                
                console.log(`📥 ${amount} USDC from ${fromAddress}`);
                console.log(`   Time: ${new Date(block.timestamp * 1000).toLocaleString()}`);
                console.log(`   TX: ${log.transactionHash}`);
                
                // Check if this could be the user's $2 deposit
                if (parseFloat(amount) === 2.0) {
                    console.log(`   ⚠️  POTENTIAL MATCH: This could be the user's $2 deposit!`);
                }
                console.log();
            }
            
        } catch (error) {
            console.error("Error checking system wallet:", error.message);
        }
    }
    
    console.log("\n=== RECOMMENDATIONS ===");
    console.log("1. Ask user for their deposit transaction hash");
    console.log("2. Check if they deposited to a different address");
    console.log("3. Verify they're on BSC mainnet (not testnet/other chains)");
    console.log("4. Check your database for unprocessed deposits");
    console.log("5. The 2000.0 USDC in balance_final.txt needs investigation");
}

checkSystemWallets().catch(console.error);