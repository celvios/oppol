/**
 * configure-creation-tokens.mjs
 * 
 * Configures the V3 prediction market contract to allow market creation
 * for holders of BC400 Token (10M) OR BC400 NFT (1).
 * 
 * Run: node scripts/configure-creation-tokens.mjs
 * Requires: ~0.002 BNB in the owner wallet for gas
 */

import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
dotenv.config();

const MARKET_ADDR = process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MARKET_CONTRACT;
const BC400_TOKEN = '0x61Fc93c7C070B32B1b1479B86056d8Ec1D7125BD'; // BC400 ERC-20
const BC400_NFT = '0xB929177331De755d7aCc5665267a247e458bCdeC'; // BC400 NFT
const MIN_BC400 = ethers.parseUnits('10000000', 18);            // 10 Million BC400
const MIN_NFT = 1n;                                            // 1 NFT

const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

if (!PRIVATE_KEY) { console.error('❌ PRIVATE_KEY not set'); process.exit(1); }
if (!MARKET_ADDR) { console.error('❌ MARKET_ADDRESS not set'); process.exit(1); }

const ABI = [
    // V3: Set primary creation token + balance
    'function setCreationSettings(address _token, uint256 _minBalance, bool _publicCreation) external',
    // V3: Set secondary (NFT) creation token
    'function setSecondaryCreationSettings(address _token, uint256 _minBalance) external',
    // Read current state
    'function creationToken() view returns (address)',
    'function minCreationBalance() view returns (uint256)',
    'function secondaryCreationToken() view returns (address)',
    'function secondaryMinBalance() view returns (uint256)',
    'function publicCreation() view returns (bool)',
    'function operator() view returns (address)',
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL, 56);
    const signer = new ethers.Wallet(PRIVATE_KEY, provider);

    const bnbBal = await provider.getBalance(signer.address);
    console.log(`\n🔑 Owner wallet: ${signer.address}`);
    console.log(`💰 BNB balance: ${ethers.formatEther(bnbBal)} BNB`);

    if (bnbBal < ethers.parseEther('0.001')) {
        console.error(`\n❌ Insufficient BNB. Need ~0.001 BNB. Current: ${ethers.formatEther(bnbBal)}`);
        console.error(`   Send BNB to: ${signer.address}`);
        process.exit(1);
    }

    const contract = new ethers.Contract(MARKET_ADDR, ABI, signer);

    // Read current state
    let currentToken, currentMin, currentPublic, currentSecToken, currentSecMin;
    try {
        [currentToken, currentMin, currentPublic, currentSecToken, currentSecMin] = await Promise.all([
            contract.creationToken(),
            contract.minCreationBalance(),
            contract.publicCreation(),
            contract.secondaryCreationToken(),
            contract.secondaryMinBalance(),
        ]);
        console.log(`\n📋 Current config:`);
        console.log(`   Primary token:  ${currentToken}`);
        console.log(`   Primary min:    ${ethers.formatUnits(currentMin, 18)}`);
        console.log(`   Public:         ${currentPublic}`);
        console.log(`   Secondary token: ${currentSecToken}`);
        console.log(`   Secondary min:  ${currentSecMin}`);
    } catch (e) {
        console.log('⚠️  Could not read current config:', e.message);
    }

    // 1. Set primary token: BC400 (10M required, public creation = false)
    console.log(`\n⚙️  Setting primary creation token: BC400 (10M required)...`);
    try {
        const tx1 = await contract.setCreationSettings(BC400_TOKEN, MIN_BC400, false);
        console.log(`   TX: ${tx1.hash}`);
        await tx1.wait();
        console.log(`   ✅ Primary token set!`);
    } catch (e) {
        // V3 may not have setCreationSettings — try setCreationToken if available
        console.log(`   ⚠️  setCreationSettings failed: ${e.message}`);
        console.log(`   Trying alternative...`);
        try {
            const altAbi = ['function setCreationToken(address _token, uint256 _minBalance) external'];
            const altContract = new ethers.Contract(MARKET_ADDR, altAbi, signer);
            const tx1b = await altContract.setCreationToken(BC400_TOKEN, MIN_BC400);
            console.log(`   TX: ${tx1b.hash}`);
            await tx1b.wait();
            console.log(`   ✅ Primary token set (via setCreationToken)!`);
        } catch (e2) {
            console.log(`   ❌ Both attempts failed. Primary token unchanged.`);
            console.log(`   Error: ${e2.message}`);
        }
    }

    // 2. Set secondary token: BC400 NFT (1 required)
    console.log(`\n⚙️  Setting secondary creation token: BC400 NFT (1 required)...`);
    try {
        const tx2 = await contract.setSecondaryCreationSettings(BC400_NFT, MIN_NFT);
        console.log(`   TX: ${tx2.hash}`);
        await tx2.wait();
        console.log(`   ✅ NFT (secondary) token set!`);
    } catch (e) {
        console.log(`   ❌ setSecondaryCreationSettings failed: ${e.message}`);
    }

    // Read final state
    console.log(`\n📋 Final config:`);
    try {
        const [ft, fm, fp, st, sm] = await Promise.all([
            contract.creationToken(),
            contract.minCreationBalance(),
            contract.publicCreation(),
            contract.secondaryCreationToken(),
            contract.secondaryMinBalance(),
        ]);
        console.log(`   Primary token:    ${ft}`);
        console.log(`   Primary min:      ${ethers.formatUnits(fm, 18)} BC400`);
        console.log(`   Public creation:  ${fp}`);
        console.log(`   Secondary token:  ${st}`);
        console.log(`   Secondary min:    ${sm} (NFT)`);
        console.log(`\n✅ Done! Users with 10M BC400 OR 1 BC400 NFT can now create markets directly.`);
    } catch (e) {
        console.log('Could not read final config:', e.message);
    }
}

main().catch(e => {
    console.error('Fatal:', e.message);
    process.exit(1);
});
