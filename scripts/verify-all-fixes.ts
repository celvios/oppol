/**
 * verify-all-fixes.ts
 * Runs all verification tests for the decimal fix audit.
 * Run: npx ts-node scripts/verify-all-fixes.ts
 */
import { ethers } from 'ethers';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const ABI = [
    'function userBalances(address) view returns (uint256)',
    'function calculateCost(uint256,uint256,uint256) view returns (uint256)',
    'function getPrice(uint256,uint256) view returns (uint256)',
    'function protocolFee() view returns (uint256)',
    'function accumulatedFees() view returns (uint256)',
];

// Multiple BSC RPC fallbacks — tries each until one works
const RPC_URLS = [
    process.env.RPC_URL,
    process.env.BNB_RPC_URL,
    'https://bsc-dataseed.binance.org/',
    'https://bsc-dataseed1.binance.org/',
    'https://binance.llamarpc.com',
    'https://bsc.publicnode.com',
].filter(Boolean) as string[];

let passed = 0;
let failed = 0;

function pass(msg: string) { console.log(`  ✅ PASS: ${msg}`); passed++; }
function fail(msg: string) { console.log(`  ❌ FAIL: ${msg}`); failed++; }

async function getWorkingProvider(): Promise<ethers.JsonRpcProvider> {
    for (const url of RPC_URLS) {
        try {
            const p = new ethers.JsonRpcProvider(url);
            await p.getBlockNumber(); // quick connectivity check
            console.log(`  Using RPC: ${url.slice(0, 55)}...`);
            return p;
        } catch {
            console.log(`  RPC failed: ${url.slice(0, 40)}... trying next`);
        }
    }
    throw new Error('All RPC endpoints failed');
}

async function main() {
    console.log('======================================================');
    console.log('  Oppol Fix Verification Suite');
    console.log('======================================================\n');

    // ---------------------------------------------------------------
    // TEST 1: Protocol Fee is 10%
    // ---------------------------------------------------------------
    console.log('TEST 1: Protocol Fee & Accumulated Fees');
    try {
        const provider = await getWorkingProvider();
        const contract = new ethers.Contract(process.env.NEXT_PUBLIC_MARKET_ADDRESS!, ABI, provider);

        const fee = await contract.protocolFee();
        const acc = await contract.accumulatedFees();
        console.log(`  Protocol fee: ${Number(fee) / 100}%  (${fee} bps)`);
        console.log(`  Accumulated fees (18-dec): ${ethers.formatUnits(acc, 18)} USDC`);
        Number(fee) === 1000 ? pass('Fee is 10%') : fail(`Fee is ${Number(fee) / 100}%, expected 10%`);

        // ---------------------------------------------------------------
        // TEST 2: calculateCost returns 18-dec LMSR values (not 6-dec)
        // ---------------------------------------------------------------
        console.log('\nTEST 2: calculateCost decimal (1 share on market 1)');
        const oneShare = ethers.parseUnits('1', 18);
        const cost = await contract.calculateCost(1, 0, oneShare);
        const as18dec = parseFloat(ethers.formatUnits(cost, 18));
        const as6dec = parseFloat(ethers.formatUnits(cost, 6));
        console.log(`  18-dec (CORRECT — LMSR output): $${as18dec.toFixed(6)} USDC`);
        console.log(`  6-dec  (WRONG if used):         $${as6dec.toFixed(0)} USDC`);
        // Realistic cost for 1 share at ~any probability: $0.001 – $10
        (as18dec > 0.001 && as18dec < 10)
            ? pass(`Cost $${as18dec.toFixed(4)} is valid at 18-dec`)
            : fail(`Cost ${as18dec} looks wrong at 18-dec`);
        as6dec > 1_000_000
            ? pass('Confirmed: 6-dec gives absurdly large value (proves 18-dec is correct scale)')
            : fail(`6-dec sanity check unexpected: ${as6dec}`);

        // ---------------------------------------------------------------
        // TEST 3: getPrice returns valid basis points
        // ---------------------------------------------------------------
        console.log('\nTEST 3: getPrice basis points');
        const price = await contract.getPrice(1, 0);
        const bp = Number(price);
        console.log(`  Price: ${bp} bps = ${bp / 100}% probability`);
        (bp >= 100 && bp <= 9900)
            ? pass(`Price ${bp / 100}% is in valid 1–99% range`)
            : fail(`Price ${bp} out of range`);

    } catch (e: any) {
        fail('Contract tests failed: ' + e.message.slice(0, 80));
        console.log('  (Skip Tests 2-3 — RPC unavailable)');
    }

    // ---------------------------------------------------------------
    // TEST 4: DB volumes look like real USDC
    // ---------------------------------------------------------------
    console.log('\nTEST 4: DB volume sanity');
    const dbUrl = process.env.DATABASE_URL!;
    const isRender = dbUrl.includes('render.com');
    const pool = new Pool({
        connectionString: dbUrl,
        ssl: isRender ? { rejectUnauthorized: false } : undefined,
        connectionTimeoutMillis: 10000,
    });
    try {
        const res = await pool.query('SELECT market_id, volume FROM markets ORDER BY market_id');
        let totalVol = 0;
        console.log('  DB volumes (non-zero only):');
        for (const row of res.rows) {
            const vol = parseFloat(row.volume || '0');
            totalVol += vol;
            if (vol > 0) {
                const isRealistic = vol >= 0.0001 && vol < 1_000_000;
                console.log(`    Market ${row.market_id}: $${vol.toFixed(6)}  ${isRealistic ? '✓' : '← SUSPICIOUS'}`);
                if (!isRealistic) fail(`Market ${row.market_id} volume $${vol} looks wrong`);
            }
        }
        console.log(`  DB TOTAL: $${totalVol.toFixed(6)} USDC`);
        (totalVol > 0 && totalVol < 1_000_000)
            ? pass(`Total $${totalVol.toFixed(4)} is a sensible amount`)
            : fail(`Total $${totalVol} looks suspicious`);
    } catch (e: any) {
        fail('DB volume check failed: ' + e.message.slice(0, 80));
    }

    // ---------------------------------------------------------------
    // TEST 5: price_history table has rows in valid range
    // ---------------------------------------------------------------
    console.log('\nTEST 5: price_history table populated');
    try {
        const res = await pool.query(`
            SELECT market_id, COUNT(*) as cnt, MIN(price) as min_p, MAX(price) as max_p
            FROM price_history
            GROUP BY market_id ORDER BY market_id
        `);
        if (res.rows.length === 0) {
            fail('price_history is empty — priceTracker has not run yet');
        } else {
            let allValid = true;
            for (const row of res.rows) {
                const minP = Number(row.min_p);
                const maxP = Number(row.max_p);
                const validRange = minP >= 100 && maxP <= 9900;
                if (!validRange) allValid = false;
            }
            allValid
                ? pass(`All ${res.rows.length} markets have valid price ranges (100–9900 bps)`)
                : fail('Some markets have out-of-range prices');
            console.log(`  (${res.rows.length} markets tracked, showing first 3):`);
            res.rows.slice(0, 3).forEach(r =>
                console.log(`    Market ${r.market_id}: ${r.cnt} rows, ${Number(r.min_p) / 100}%–${Number(r.max_p) / 100}%`)
            );
        }
    } catch (e: any) {
        fail('price_history check failed: ' + e.message.slice(0, 80));
    } finally {
        await pool.end().catch(() => { });
    }

    // ---------------------------------------------------------------
    // SUMMARY
    // ---------------------------------------------------------------
    console.log('\n======================================================');
    console.log(`  Results: ${passed} passed, ${failed} failed`);
    console.log('======================================================');
    if (failed === 0) console.log('  🎉 All tests passed!');
    else console.log('  ⚠️  Some tests failed — review above.');
}

main().catch(e => {
    console.error('Fatal:', e.message);
    process.exit(1);
});
