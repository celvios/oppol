
import { ethers } from "ethers";
import pg from 'pg';
const { Pool } = pg;
import dotenv from "dotenv";

dotenv.config();

// DB Config
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    max: 1
});

async function main() {
    try {
        console.log("🔍 Finding latest user position...");

        // Get latest active bet from telegram_transactions
        const res = await pool.query(`
      SELECT * FROM telegram_transactions 
      WHERE type = 'BET' AND status = 'CONFIRMED' 
      ORDER BY id DESC 
      LIMIT 1
    `);

        if (res.rows.length === 0) {
            console.log("❌ No active bets found in database.");
            return;
        }

        const bet = res.rows[0];
        console.log(`✅ Found Bet: Market ${bet.market_id}, Outcome ${bet.outcome}, Amount $${bet.amount}`);

        const marketId = bet.market_id;
        const userOutcome = bet.outcome;

        // Connect to Contract
        const RPC_URL = process.env.BNB_RPC_URL || "https://bsc-testnet-rpc.publicnode.com";
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) throw new Error("Missing PRIVATE_KEY");

        const wallet = new ethers.Wallet(privateKey, provider);
        const MARKET_ADDR = "0xeA616854b8e87cB95628B5A65B9972d34D721710"; // V2 Address

        console.log(`🔌 Connected to V2 Contract: ${MARKET_ADDR}`);

        // CORRECT V2 ABI
        const marketABI = [
            "function getMarketBasicInfo(uint256) view returns (string, uint256, uint256, uint256, bool, uint256)",
            "function buyShares(uint256, uint256, uint256, uint256) external",
            "function resolveMarket(uint256, uint256) external",
            "function outcomeCount(uint256) view returns (uint256)",
            "function calculateCost(uint256, uint256, uint256) view returns (uint256)"
        ];

        const contract = new ethers.Contract(MARKET_ADDR, marketABI, wallet);

        // 1. Verify Market Status
        // Returns: (question, outcomeCount, endTime, liquidity, resolved, winningOutcome)
        const [question, outcomeCount, endTime, liquidity, resolved, winningOutcome] = await contract.getMarketBasicInfo(marketId);

        console.log(`📊 Market Status: Resolved=${resolved}, EndTime=${new Date(Number(endTime) * 1000).toISOString()}`);

        if (resolved) {
            console.log(`✅ Market already resolved. Winner: ${winningOutcome}`);
            return;
        }

        const now = Math.floor(Date.now() / 1000);

        // If Market Ended, we can't bet, only resolve.
        if (now >= Number(endTime)) {
            console.log("⚠️ Market has ended. Skipping bets, proceeding to resolution...");
        } else {
            // Place bets logic only if active
            console.log("🎲 Placing bets on OTHER outcomes...");
            const otherOutcome = userOutcome === 0 ? 1 : 0;

            // Check USDC
            const USDC_ADDR = "0x16E4A3d9697D47c61De3bDD1DdDa4148aA09D634";
            const usdcABI = [
                "function balanceOf(address) view returns (uint256)",
                "function allowance(address, address) view returns (uint256)",
                "function approve(address, uint256) returns (bool)"
            ];
            const usdc = new ethers.Contract(USDC_ADDR, usdcABI, wallet);

            const sharesToBuy = ethers.parseUnits("50", 6);
            const maxCost = ethers.parseUnits("50", 6);

            const balance = await usdc.balanceOf(wallet.address);
            console.log(`💰 Deployer Balance: ${ethers.formatUnits(balance, 6)} USDC`);

            if (balance < maxCost) {
                console.log("❌ Insufficient USDC (Need 50). Skipping bet.");
            } else {
                const allowance = await usdc.allowance(wallet.address, MARKET_ADDR);
                if (allowance < maxCost) {
                    console.log("🔓 Approving USDC...");
                    await (await usdc.approve(MARKET_ADDR, ethers.MaxUint256)).wait();
                }

                try {
                    const tx = await contract.buyShares(marketId, otherOutcome, sharesToBuy, maxCost);
                    console.log(`⏳ Waiting for bet tx: ${tx.hash}`);
                    await tx.wait();
                    console.log("✅ Counter-bet placed!");
                } catch (e: any) {
                    console.log("⚠️ Failed to place counter-bet:", e.message);
                }
            }
        }

        // 2. Resolve Market
        console.log(`⚖️ Resolving Market ${marketId} with Winning Outcome: ${userOutcome}...`);

        try {
            const resolveTx = await contract.resolveMarket(marketId, userOutcome);
            console.log(`⏳ Waiting for resolution tx: ${resolveTx.hash}`);
            await resolveTx.wait();
            console.log("✅ Market Resolved Successfully!");
            console.log("🎉 User can now check their Telegram PnL/Payout.");
        } catch (e: any) {
            console.log("❌ Failed to resolve:", e.message);
        }

    } catch (error) {
        console.error("❌ Error:", error);
    } finally {
        pool.end();
    }
}

main();
