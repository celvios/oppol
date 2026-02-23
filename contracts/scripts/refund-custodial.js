require('dotenv').config({ path: '../../.env' });
const { ethers } = require('ethers');
const { Pool } = require('pg');
const crypto = require('crypto');

const DEST = '0xd0A115Ea64B59F951B70276fCb65b4946465e3a9';
const USER = '0x42501490f7c291b4B28110900c9Bd81f3B35B849';
const USDC_ADDR = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const ADMIN_KEY = process.env.PRIVATE_KEY;

const USDC_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function transfer(address,uint256) returns (bool)',
];

function decrypt(enc) {
    const key = Buffer.from(process.env.ENCRYPTION_KEY, 'hex');
    const [ivH, data] = enc.split(':');
    const dc = crypto.createDecipheriv('aes-256-cbc', key, Buffer.from(ivH, 'hex'));
    return dc.update(data, 'hex', 'utf8') + dc.final('utf8');
}

async function main() {
    const provider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
    const usdc = new ethers.Contract(USDC_ADDR, USDC_ABI, provider);
    const dec = Number(await usdc.decimals().catch(() => 18));

    const bal = await usdc.balanceOf(DEST);
    const bnb = await provider.getBalance(DEST);
    console.log(`\nDEST (${DEST}):`);
    console.log(`  USDC: ${ethers.formatUnits(bal, dec)}`);
    console.log(`  BNB:  ${ethers.formatEther(bnb)}`);

    if (bal === 0n) {
        console.log('\n❌ No USDC at destination. Funds may be in market contract or already moved.');
        return;
    }

    // Try DB lookup for custodial private key
    const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
    const r = await pool.query(
        `SELECT encrypted_private_key FROM wallets WHERE LOWER(public_address) = LOWER($1)`,
        [DEST]
    );
    await pool.end();

    if (r.rows.length === 0) {
        console.log('\n⚠️  Address not in DB — it is a Smart Account, not a custodial backend wallet.');
        console.log('   The admin cannot sign transactions on behalf of this smart account.');
        console.log('   The $3 is at that address but requires the owner (you via MetaMask) to sign a tx to move it.');
        console.log(`\n   BSCScan: https://bscscan.com/address/${DEST}`);
        console.log('   You can import this smart account into MetaMask or use Privy to sign a withdraw.');
        return;
    }

    // Has custodial key — do the refund
    const privKey = decrypt(r.rows[0].encrypted_private_key);
    const signer = new ethers.Wallet(privKey, provider);
    console.log(`\n✅ Custodial key found! Signer: ${signer.address}`);

    // Ensure gas
    if (bnb < ethers.parseEther('0.001')) {
        console.log('⛽ Funding gas...');
        const admin = new ethers.Wallet(ADMIN_KEY, provider);
        const gtx = await admin.sendTransaction({ to: DEST, value: ethers.parseEther('0.002') });
        await gtx.wait();
        console.log(`  Gas tx: ${gtx.hash}`);
    }

    // Transfer USDC back
    const usdcS = new ethers.Contract(USDC_ADDR, USDC_ABI, signer);
    console.log(`💸 Sending ${ethers.formatUnits(bal, dec)} USDC → ${USER}...`);
    const tx = await usdcS.transfer(USER, bal);
    await tx.wait();
    console.log(`\n🎉 REFUND COMPLETE!`);
    console.log(`   Amount: ${ethers.formatUnits(bal, dec)} USDC`);
    console.log(`   To:     ${USER}`);
    console.log(`   TX:     https://bscscan.com/tx/${tx.hash}`);
}

main().catch(console.error);
