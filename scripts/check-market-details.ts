import { ethers } from 'ethers';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const RPC_URL = process.env.BNB_RPC_URL || "https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/";
const MARKET_ADDRESS = process.env.NEXT_PUBLIC_MARKET_ADDRESS || "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";

async function main() {
    console.log("----------------------------------------");
    console.log("FETCHING DETAILED MARKET DATA");
    console.log("----------------------------------------");

    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(MARKET_ADDRESS, [
        "function marketCount() view returns (uint256)",
        "function getMarketBasicInfo(uint256) view returns (string, string, string, uint256, uint256, uint256, bool, uint256)",
        "function getMarketOutcomes(uint256) view returns (string[])",
        "function getMarketShares(uint256) view returns (uint256[])",
        "function getAllPrices(uint256) view returns (uint256[])"
    ], provider);

    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();
        const count = await contract.marketCount();
        const marketCount = Number(count);
        console.log(`Total Markets: ${marketCount}`);

        let output = "";
        output += `# Market Details Report\n\n`;
        output += `**Total Markets:** ${marketCount}\n\n`;
        output += `| ID | Question | Outcomes | Prices (Chances) | Total Shares (Liquidity) | Trade Volume (USDC) |\n`;
        output += `|---|---|---|---|---|---|\n`;

        for (let i = 0; i < marketCount; i++) {
            try {
                // Fetch On-Chain Data
                const [basicInfo, outcomes, shares, prices] = await Promise.all([
                    contract.getMarketBasicInfo(i),
                    contract.getMarketOutcomes(i),
                    contract.getMarketShares(i),
                    contract.getAllPrices(i)
                ]);

                // Fetch DB Volume
                const dbRes = await client.query('SELECT volume FROM markets WHERE market_id = $1', [i]);
                const dbVolume = dbRes.rows.length > 0 ? parseFloat(dbRes.rows[0].volume || '0').toFixed(2) : "0.00";

                const question = basicInfo[0];
                const outcomeNames = outcomes.join(", ");

                // Format Prices
                const priceStr = prices.map((p: bigint) => `${(Number(p) / 100).toFixed(1)}%`).join(" / ");

                // Calculate Total Shares
                let totalShares = BigInt(0);
                shares.forEach((s: bigint) => totalShares += s);
                const shareCount = ethers.formatUnits(totalShares, 18);

                // Format row
                output += `| ${i} | ${question.substring(0, 40)}... | ${outcomeNames} | ${priceStr} | ${parseFloat(shareCount).toFixed(2)} | $${dbVolume} |\n`;

                console.log(`Market ${i}: Shares=${parseFloat(shareCount).toFixed(2)}, Vol=$${dbVolume}`);

            } catch (err: any) {
                console.error(`Failed to fetch market ${i}:`, err.message);
                output += `| ${i} | ERROR | - | - | - | - |\n`;
            }
        }

        fs.writeFileSync('market_details_report.md', output);
        console.log("\nReport saved to market_details_report.md");

    } catch (e: any) {
        console.error("Fatal Error:", e.message);
    } finally {
        await client.end();
    }
}

main();
