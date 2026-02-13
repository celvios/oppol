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
    const client = new Client({
        connectionString: process.env.DATABASE_URL,
        ssl: { rejectUnauthorized: false }
    });

    try {
        await client.connect();

        // 1. Get all markets from DB
        const res = await client.query('SELECT market_id, question, volume FROM markets ORDER BY market_id ASC');

        let output = "";
        output += "----------------------------------------\n";
        output += "FETCHING ALL MARKET VOLUMES\n";
        output += "----------------------------------------\n";
        output += `Found ${res.rows.length} markets in Database.\n\n`;
        output += "ID\t| Volume (DB)\t| Question\n";
        output += "----------------------------------------------------------------\n";

        let totalDbVolume = 0;

        for (const row of res.rows) {
            const vol = parseFloat(row.volume || '0');
            totalDbVolume += vol;
            output += `${row.market_id}\t| $${vol.toFixed(2)}\t\t| ${row.question.substring(0, 40)}...\n`;
        }

        output += "----------------------------------------------------------------\n";
        output += `TOTAL VOLUME (DB): $${totalDbVolume.toFixed(2)}\n`;
        output += "----------------------------------------------------------------\n";

        fs.writeFileSync('all_volumes_utf8.txt', output);
        console.log("Output written to all_volumes_utf8.txt");

    } catch (e: any) {
        console.error("Error:", e.message);
    } finally {
        await client.end();
    }
}

main();
