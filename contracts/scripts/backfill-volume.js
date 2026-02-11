const { ethers } = require("hardhat");
const { Pool } = require("pg");
require("dotenv").config({ path: "../.env" });


async function main() {
    const PROXY_ADDRESS = process.env.NEXT_PUBLIC_MARKET_ADDRESS || "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";

    // Setup database
    const pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
    });

    console.log(`\n=== BACKFILLING VOLUME DATA ===`);
    console.log(`Contract: ${PROXY_ADDRESS}\n`);

    const [signer] = await ethers.getSigners();
    const marketContract = new ethers.Contract(
        PROXY_ADDRESS,
        [
            "function marketCount() view returns (uint256)",
            "event SharesPurchased(uint256 indexed marketId, address indexed user, uint256 outcomeIndex, uint256 shares, uint256 cost)"
        ],
        signer
    );

    const marketCount = Number(await marketContract.marketCount());
    console.log(`Total Markets: ${marketCount}\n`);

    const currentBlock = await signer.provider.getBlockNumber();
    console.log(`Current Block: ${currentBlock}`);

    // Scan back ~580k blocks (20 days on BSC to be safe)
    const startBlock = Math.max(0, currentBlock - 580000);
    console.log(`Scanning from block ${startBlock} to ${currentBlock}\n`);

    const CHUNK_SIZE = 5000;
    const volumes = new Map();

    // Initialize all markets to 0
    for (let i = 0; i < marketCount; i++) {
        volumes.set(i, BigInt(0));
    }

    console.log(`Scanning in ${Math.ceil((currentBlock - startBlock) / CHUNK_SIZE)} chunks...`);

    for (let from = startBlock; from <= currentBlock; from += CHUNK_SIZE) {
        const to = Math.min(from + CHUNK_SIZE - 1, currentBlock);

        try {
            // Use generic filter to get ALL SharesPurchased events
            const filter = marketContract.filters.SharesPurchased();
            const logs = await marketContract.queryFilter(filter, from, to);

            if (logs.length > 0) {
                console.log(`  Blocks ${from}-${to}: Found ${logs.length} trades`);
            }

            for (const log of logs) {
                const marketId = Number(log.args[0]);
                const cost = BigInt(log.args[4]);

                const currentVol = volumes.get(marketId) || BigInt(0);
                volumes.set(marketId, currentVol + cost);
            }
        } catch (e) {
            console.error(`  ERROR blocks ${from}-${to}:`, e.message);
        }
    }

    console.log(`\n=== RESULTS ===`);

    for (let marketId = 0; marketId < marketCount; marketId++) {
        const volume = volumes.get(marketId);
        const volumeFormatted = ethers.formatUnits(volume, 18);

        console.log(`Market ${marketId}: $${volumeFormatted}`);

        if (volume > 0n) {
            // Update database
            try {
                await pool.query(
                    `UPDATE markets SET volume = $1 WHERE market_id = $2`,
                    [volumeFormatted, marketId]
                );
                console.log(`  ✅ Database updated`);
            } catch (e) {
                console.error(`  ❌ DB error:`, e.message);
            }
        }
    }

    console.log(`\n✅ Backfill complete!`);
    await pool.end();
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });
