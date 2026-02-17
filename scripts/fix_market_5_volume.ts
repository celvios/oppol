
import { query } from '../src/config/database';
import { ethers } from 'ethers';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    const marketId = 5;
    const correctVolumeWei = 7996120000000000000n;
    const correctVolumeStr = ethers.formatUnits(correctVolumeWei, 18);

    console.log(`Fixing Market ${marketId} Volume...`);
    console.log(`Setting volume to: ${correctVolumeStr}`);

    try {
        await query(
            'UPDATE markets SET volume = $1 WHERE market_id = $2',
            [correctVolumeStr, marketId]
        );
        console.log("Success! Volume updated.");

        const res = await query('SELECT volume FROM markets WHERE market_id = $1', [marketId]);
        console.log("New DB Volume:", res.rows[0].volume);

    } catch (e) {
        console.error("Error updating volume:", e);
    }
    process.exit(0);
}

main();
