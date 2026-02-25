/**
 * transfer-ownership.mjs
 * 
 * Transfers contract ownership + configures BC400/NFT creation tokens.
 * Run from current owner's wallet, then server wallet becomes owner.
 * 
 * Usage:
 *   OWNER_PRIVATE_KEY=0x... node scripts/transfer-ownership.mjs
 */

import { ethers } from 'ethers';
import * as dotenv from 'dotenv';
dotenv.config();

const MARKET_ADDR = process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MARKET_CONTRACT;
const SERVER_WALLET = '0x0ff7e81Cb052243ECf72d19D63e0d4268fa26eC9'; // Render server wallet

// Use OWNER_PRIVATE_KEY or fall back to PRIVATE_KEY
const OWNER_KEY = process.env.OWNER_PRIVATE_KEY || process.env.PRIVATE_KEY;
const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org';

if (!OWNER_KEY) { console.error('❌ Set OWNER_PRIVATE_KEY=0x... in env'); process.exit(1); }
if (!MARKET_ADDR) { console.error('❌ MARKET_ADDRESS not set'); process.exit(1); }

const ABI = [
    'function owner() view returns (address)',
    'function operator() view returns (address)',
    'function transferOwnership(address newOwner) external',
    'function setCreationSettings(address _token, uint256 _minBalance, bool _publicCreation) external',
    'function setSecondaryCreationSettings(address _token, uint256 _minBalance) external',
];

const BC400_TOKEN = '0x61Fc93c7C070B32B1b1479B86056d8Ec1D7125BD';
const BC400_NFT = '0xB929177331De755d7aCc5665267a247e458bCdeC';
const MIN_BC400 = ethers.parseUnits('10000000', 18);  // 10M
const MIN_NFT = 1n;

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL, 56);
    const signer = new ethers.Wallet(OWNER_KEY, provider);

    const bnb = await provider.getBalance(signer.address);
    console.log(`\n🔑 Signing as: ${signer.address}`);
    console.log(`💰 BNB: ${ethers.formatEther(bnb)}`);

    const contract = new ethers.Contract(MARKET_ADDR, ABI, signer);
    const currentOwner = await contract.owner();
    console.log(`\n📋 Current owner: ${currentOwner}`);
    console.log(`   Target owner:  ${SERVER_WALLET}`);

    if (currentOwner.toLowerCase() !== signer.address.toLowerCase()) {
        console.error(`\n❌ Your wallet (${signer.address}) is NOT the current owner.`);
        console.error(`   Current owner is: ${currentOwner}`);
        process.exit(1);
    }

    if (bnb < ethers.parseEther('0.003')) {
        console.error(`\n❌ Not enough BNB. Need ~0.003 BNB. Have: ${ethers.formatEther(bnb)}`);
        process.exit(1);
    }

    // 1. Set primary creation token: BC400 (10M)
    console.log('\n⚙️  Setting BC400 as creation token...');
    try {
        const tx = await contract.setCreationSettings(BC400_TOKEN, MIN_BC400, false);
        await tx.wait();
        console.log(`   ✅ BC400 token set (${tx.hash})`);
    } catch (e) {
        console.log(`   ⚠️  setCreationSettings failed: ${e.message.substring(0, 80)}`);
    }

    // 2. Set secondary creation token: BC400 NFT (1)
    console.log('\n⚙️  Setting BC400 NFT as secondary token...');
    try {
        const tx = await contract.setSecondaryCreationSettings(BC400_NFT, MIN_NFT);
        await tx.wait();
        console.log(`   ✅ NFT set (${tx.hash})`);
    } catch (e) {
        console.log(`   ⚠️  setSecondaryCreationSettings failed: ${e.message.substring(0, 80)}`);
    }

    // 3. Transfer ownership to server wallet
    console.log(`\n⚙️  Transferring ownership to ${SERVER_WALLET}...`);
    const tx = await contract.transferOwnership(SERVER_WALLET);
    await tx.wait();
    console.log(`   ✅ Ownership transferred! (${tx.hash})`);

    const newOwner = await contract.owner();
    console.log(`\n✅ Done! New owner: ${newOwner}`);
    console.log(`   Server can now call /api/admin/configure-creation-tokens anytime.`);
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
