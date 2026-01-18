
import { ethers } from "ethers";
import { Pool } from "pg";
import dotenv from "dotenv";

dotenv.config();

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
});

async function main() {
    try {
        console.log("🔍 Finding latest user bet to check market...");
        const res = await pool.query(`
      SELECT * FROM telegram_transactions 
      WHERE type = 'BET' AND status = 'CONFIRMED' 
      ORDER BY id DESC 
      LIMIT 1
    `);

        if (res.rows.length === 0) {
            console.log("❌ No active bets found.");
            return;
        }

        const bet = res.rows[0];
        const marketId = bet.market_id;
        console.log(`✅ Checking Market ID: ${marketId}`);

        const RPC_URL = process.env.BNB_RPC_URL || "https://bsc-testnet-rpc.publicnode.com";
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const MARKET_ADDR = "0xeA616854b8e87cB95628B5A65B9972d34D721710";

        const marketABI = [
            "function getMarket(uint256) view returns (string, string[], uint256, uint256, bool, bool)",
            "function winningOutcome(uint256) view returns (uint256)"
        ];

        const contract = new ethers.Contract(MARKET_ADDR, marketABI, provider);

        const marketData = await contract.getMarket(marketId);
        // [question, outcomeNames, endTime, outcomeCount, resolved, cancelled]
        const resolved = marketData[4];
        console.log(`On-Chain Resolved: ${resolved}`);

        if (resolved) {
            const winner = await contract.winningOutcome(marketId);
            console.log(`🏆 Winning Outcome: ${winner}`);
            console.log(`User Outcome: ${bet.outcome}`);

            if (winner.toString() === bet.outcome.toString()) {
                console.log("✅ Resolution matches User Prediction!");
            } else {
                console.log("⚠️ Resolution matches OTHER outcome.");
            }
        } else {
            console.log("❌ Market NOT resolved yet.");
        }

    } catch (error) {
        console.error("Error:", error);
    } finally {
        pool.end();
    }
}

main();
