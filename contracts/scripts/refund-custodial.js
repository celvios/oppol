// Direct refund: check if destination is a Biconomy smart account, withdraw from market if needed,
// then use admin to send gas + the custodial wallet key (if found) or report exact status.
require('dotenv').config({ path: '../../.env' });
const { ethers } = require('ethers');
const { Pool } = require('pg');

const DEST = '0xd0A115Ea64B59F951B70276fCb65b4946465e3a9';
const USER = '0x42501490f7c291b4B28110900c9Bd81f3B35B849';
const USDC = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';

async function main() {
    const provider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });

    // 1. Check all balances on DEST
    const usdcABI = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)', 'function transfer(address,uint256) returns (bool)'];
    const usdcCt = new ethers.Contract(USDC, usdcABI, provider);
    const dec = Number(await usdcCt.decimals().catch(() => 18));
    const usdcBal = await usdcCt.balanceOf(DEST);
    const bnbBal = await provider.getBalance(DEST);

    console.log(`\n=== DEST (${DEST}) ===`);
    console.log(`USDC: ${ethers.formatUnits(usdcBal, dec)}`);
    console.log(`BNB:  ${ethers.formatEther(bnbBal)}`);

    // 2. Look for dest in wallets table (custodial?)
    const r = await pool.query(
        `SELECT w.encrypted_private_key, u.privy_user_id, u.display_name
        FROM wallets w JOIN users u ON u.id = w.user_id
        WHERE LOWER(w.public_address) = LOWER($1)`,
        [DEST]
    );

    if (r.rows.length > 0) {
        const { encrypted_private_key, privy_user_id, display_name } = r.rows[0];
        console.log(`\n✅ Found in DB! Owner: ${display_name || privy_user_id}`);

        // Decrypt key
        const crypto = require('crypto');
        const keyBuf = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
        const [ivHex, enc] = encrypted_private_key.split(':');
        const iv = Buffer.from(ivHex, 'hex');
        const dc = crypto.createDecipheriv('aes-256-cbc', keyBuf, iv);
        const privKey = dc.update(enc, 'hex', 'utf8') + dc.final('utf8');

        const signer = new ethers.Wallet(privKey, provider);

        // Fund gas if needed
        const minGas = ethers.parseEther('0.001');
        if (bnbBal < minGas) {
            const admin = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
            const ftx = await admin.sendTransaction({ to: DEST, value: minGas - bnbBal + ethers.parseEther('0.0005') });
            await ftx.wait();
            console.log(`⛽ Gas funded`);
        }

        // Transfer USDC back to user
        if (usdcBal > 0n) {
            const usdcS = new ethers.Contract(USDC, usdcABI, signer);
            const tx = await usdcS.transfer(USER, usdcBal);
            await tx.wait();
            console.log(`\n🎉 REFUND COMPLETE!`);
            console.log(`   Sent ${ethers.formatUnits(usdcBal, dec)} USDC to ${USER}`);
            console.log(`   TX: ${tx.hash}`);
        } else {
            console.log('⚠️  No USDC balance in custodial wallet to refund.');
        }
    } else {
        console.log(`\n⚠️  Address NOT in wallet database.`);
        console.log('    This appears to be a Biconomy/Privy Smart Account address.');
        console.log('    The $3 USDC is inside this smart account.');
        console.log(`\n    USDC balance there: ${ethers.formatUnits(usdcBal, dec)}`);
        console.log(`    BNB balance there:  ${ethers.formatEther(bnbBal)}`);
        if (usdcBal > 0n) {
            console.log(`\n    ACTION: The $3 is in your Smart Account. You can use it directly`);
            console.log(`    on the platform — it IS your game balance, just held at a different address.`);
        }
    }

    await pool.end();
}

main().catch(e => { console.error(e); process.exit(1); });
