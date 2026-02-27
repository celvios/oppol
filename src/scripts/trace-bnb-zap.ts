/**
 * Check where BNB-zapped funds landed:
 * - Market balance at the ZAP contract address (msg.sender issue)
 * - Old market (0xe5a5320...) balance at user's EOA
 * - Market balance at user's EOA
 */
import dotenv from 'dotenv';
dotenv.config();
import { ethers } from 'ethers';
import { query } from '../config/database';

const RPC = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org';
const MARKET = process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MARKET_CONTRACT || '';
const OLD_MARKET = '0xe5a5320b3764Bd8FFFd95cF7aA7F406DaC2B070C';
const USDC = process.env.NEXT_PUBLIC_USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';

const USER_EOA = '0xBe7db7c2a7c6f911C65F0335C893E58Cb34590e3';

async function main() {
    // Get ZAP address from DB/env
    const contracts = await query(`SELECT * FROM information_schema.tables WHERE table_name='markets'`).catch(() => null);
    const ZAP = process.env.NEXT_PUBLIC_ZAP_ADDRESS || '';

    const provider = new ethers.JsonRpcProvider(RPC);
    const mktAbi = ['function userBalances(address) view returns (uint256)'];
    const erc20Abi = ['function balanceOf(address) view returns (uint256)'];

    const newMkt = MARKET ? new ethers.Contract(MARKET, mktAbi, provider) : null;
    const oldMkt = new ethers.Contract(OLD_MARKET, mktAbi, provider);
    const usdcC = new ethers.Contract(USDC, erc20Abi, provider);

    console.log('\nConfig:');
    console.log('  MARKET    :', MARKET);
    console.log('  OLD_MARKET:', OLD_MARKET);
    console.log('  ZAP       :', ZAP || '(not set)');
    console.log('  USER EOA  :', USER_EOA);
    console.log();

    const addresses: { label: string; addr: string }[] = [
        { label: 'User EOA', addr: USER_EOA },
    ];
    if (ZAP) addresses.push({ label: 'ZAP contract', addr: ZAP });

    for (const { label, addr } of addresses) {
        console.log(`─── ${label} (${addr}) ─────────────────────`);

        // New market userBalance
        if (newMkt) {
            const b = await newMkt.userBalances(addr).catch(() => null);
            if (b !== null) console.log(`  New Market userBalance : ${ethers.formatUnits(b, 18)}`);
        }

        // Old market userBalance
        const ob = await oldMkt.userBalances(addr).catch(() => null);
        if (ob !== null) console.log(`  Old Market userBalance : ${ethers.formatUnits(ob, 18)}`);

        // USDC token balance
        const ub = await usdcC.balanceOf(addr).catch(() => 0n);
        console.log(`  USDC token balance     : ${ethers.formatUnits(ub, 18)}`);
        console.log();
    }

    // Also check BNB balance at user EOA (to see if they still have BNB)
    const bnbBal = await provider.getBalance(USER_EOA).catch(() => 0n);
    console.log(`User EOA BNB balance: ${ethers.formatEther(bnbBal)} BNB`);

    // Check last few txns - get nonce to see how many txns they've sent
    const nonce = await provider.getTransactionCount(USER_EOA).catch(() => 0);
    console.log(`User EOA tx count   : ${nonce}`);

    process.exit(0);
}
main().catch(e => { console.error('Fatal:', e); process.exit(1); });
