import { ethers } from "hardhat";
import pkg from 'pg';
const { Pool } = pkg;

async function main() {
    const MARKET_ADDRESS = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";

    console.log("🔄 Syncing markets from blockchain to database...\n");

    // Setup blockchain connection
    const provider = new ethers.JsonRpcProvider("https://bsc-rpc.publicnode.com");
    const abi = [
        "function marketCount() view returns (uint256)",
        "function getMarketBasicInfo(uint256) view returns (string question, string image, string description, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome)",
        "function getMarketOutcomes(uint256) view returns (string[])",
        "function getMarketShares(uint256) view returns (uint256[])"
    ];

    const contract = new ethers.Contract(MARKET_ADDRESS, abi, provider);

    // Setup database connection
    const dbConfig: any = {
        connectionString: process.env.DATABASE_URL
    };

    // Only add SSL for production/remote databases
    if (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('render.com')) {
        dbConfig.ssl = { rejectUnauthorized: false };
    }

    const pool = new Pool(dbConfig);

    try {
        const count = await contract.marketCount();
        console.log(`Found ${count.toString()} markets on-chain\n`);

        for (let i = 0; i < Number(count); i++) {
            try {
                console.log(`Processing Market ID ${i}...`);

                // Fetch market data
                const info = await contract.getMarketBasicInfo(i);
                const outcomes = await contract.getMarketOutcomes(i);
                const shares = await contract.getMarketShares(i);

                const question = info[0];
                const image = info[1];
                const description = info[2];
                const outcomeCount = Number(info[3]);
                const endTime = new Date(Number(info[4]) * 1000);
                const liquidityParam = info[5].toString();
                const resolved = info[6];
                const winningOutcome = Number(info[7]);

                // Check if market already exists in DB
                const checkResult = await pool.query(
                    'SELECT market_id FROM markets WHERE market_id = $1',
                    [i]
                );

                if (checkResult.rows.length > 0) {
                    // Update existing market
                    await pool.query(`
                        UPDATE markets 
                        SET question = $1, 
                            image = $2, 
                            description = $3,
                            category = $4
                        WHERE market_id = $5
                    `, [
                        question,
                        image || '',
                        description || '',
                        'Other',
                        i
                    ]);
                    console.log(`  ✅ Updated Market ${i}: "${question.substring(0, 50)}..."`);
                } else {
                    // Insert new market
                    await pool.query(`
                        INSERT INTO markets (
                            market_id, 
                            question, 
                            image, 
                            description,
                            category,
                            outcome_names
                        ) VALUES ($1, $2, $3, $4, $5, $6)
                    `, [
                        i,
                        question,
                        image || '',
                        description || '',
                        'Other',
                        JSON.stringify(outcomes)
                    ]);
                    console.log(`  ✅ Inserted Market ${i}: "${question.substring(0, 50)}..."`);
                }

            } catch (error: any) {
                console.error(`  ❌ Failed to sync Market ${i}:`, error.message);
            }
        }

        console.log("\n✨ Sync complete!");

        // Show summary
        const result = await pool.query('SELECT COUNT(*) FROM markets');
        console.log(`\n📊 Total markets in database: ${result.rows[0].count}`);

    } catch (error: any) {
        console.error("Sync failed:", error);
        throw error;
    } finally {
        await pool.end();
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
