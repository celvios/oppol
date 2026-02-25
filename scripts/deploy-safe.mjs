/**
 * deploy-safe.mjs
 * 
 * Deploys PredictionMarketMultiV3 with safe ownership patterns:
 * - DEPLOYER wallet = owner + initial operator (your MetaMask, never on server)
 * - BC400 token + NFT configured as creation tokens at deploy time
 * - Server has NO private key needed
 * 
 * Usage:
 *   DEPLOY_PRIVATE_KEY=0x... node scripts/deploy-safe.mjs
 * 
 * After deploy:
 *   1. Update NEXT_PUBLIC_MARKET_ADDRESS in Render to new address
 *   2. Admin connects same MetaMask to create markets (operator)
 *   3. Public uses BC400 or NFT wallet to create markets
 */

import { ethers } from 'ethers';
import { createRequire } from 'module';
import * as dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { resolve } from 'path';

dotenv.config();

const require = createRequire(import.meta.url);

const DEPLOY_KEY = process.env.DEPLOY_PRIVATE_KEY || process.env.PRIVATE_KEY;
const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org';
const USDC_ADDR = process.env.NEXT_PUBLIC_USDC_CONTRACT;
const BC400_TOKEN = '0x61Fc93c7C070B32B1b1479B86056d8Ec1D7125BD';
const BC400_NFT = '0xB929177331De755d7aCc5665267a247e458bCdeC';
const MIN_BC400 = ethers.parseUnits('10000000', 18); // 10M BC400
const MIN_NFT = 1n;

if (!DEPLOY_KEY) { console.error('❌ Set DEPLOY_PRIVATE_KEY=0x... '); process.exit(1); }
if (!USDC_ADDR) { console.error('❌ NEXT_PUBLIC_USDC_CONTRACT not set'); process.exit(1); }

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL, 56);
    const signer = new ethers.Wallet(DEPLOY_KEY, provider);
    const bnb = await provider.getBalance(signer.address);

    console.log('\n🚀 Deploying PredictionMarketMultiV3...');
    console.log(`   Deployer (owner + operator): ${signer.address}`);
    console.log(`   BNB balance: ${ethers.formatEther(bnb)}`);
    console.log(`   USDC: ${USDC_ADDR}`);

    if (bnb < ethers.parseEther('0.002')) {
        console.warn(`\n⚠️  Warning: Low BNB balance (${ethers.formatEther(bnb)}). The deployment might fail if gas spikes.`);
    }

    // Load compiled artifact
    let artifact;
    try {
        artifact = require('../contracts/artifacts/contracts/PredictionMarketMultiV3.sol/PredictionMarketMultiV3.json');
    } catch (e) {
        console.error('❌ Contract not compiled. Run: cd contracts && npx hardhat compile');
        process.exit(1);
    }

    // Deploy
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
    const contract = await factory.deploy(USDC_ADDR);
    await contract.waitForDeployment();
    const addr = await contract.getAddress();
    console.log(`\n✅ Deployed at: ${addr}`);

    // Setup ABI fragments
    const setupAbi = [
        'function setCreationSettings(address _token, uint256 _minBalance, bool _publicCreation) external',
        'function setSecondaryCreationSettings(address _token, uint256 _minBalance) external',
        'function setOperator(address _operator) external',
        'function operator() view returns (address)',
        'function owner() view returns (address)',
    ];
    const c = new ethers.Contract(addr, setupAbi, signer);

    // 1. Set BC400 token as primary creation token
    console.log('\n⚙️  Configuring BC400 as creation token (10M required)...');
    try {
        const tx = await c.setCreationSettings(BC400_TOKEN, MIN_BC400, false);
        await tx.wait();
        console.log(`   ✅ Done (${tx.hash})`);
    } catch (e) { console.log(`   ⚠️  ${e.message.slice(0, 80)}`); }

    // 2. Set BC400 NFT as secondary creation token
    console.log('\n⚙️  Configuring BC400 NFT as secondary token (1 required)...');
    try {
        const tx = await c.setSecondaryCreationSettings(BC400_NFT, MIN_NFT);
        await tx.wait();
        console.log(`   ✅ Done (${tx.hash})`);
    } catch (e) { console.log(`   ⚠️  ${e.message.slice(0, 80)}`); }

    // 3. Set deployer as operator (so admin MetaMask can createMarketFor)
    console.log(`\n⚙️  Setting ${signer.address} as operator...`);
    try {
        const tx = await c.setOperator(signer.address);
        await tx.wait();
        console.log(`   ✅ Done (${tx.hash})`);
    } catch (e) { console.log(`   ⚠️  ${e.message.slice(0, 80)}`); }

    const [owner, operator] = await Promise.all([c.owner(), c.operator()]);

    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('🎉 Deployment complete!');
    console.log(`   Contract:  ${addr}`);
    console.log(`   Owner:     ${owner}`);
    console.log(`   Operator:  ${operator}`);
    console.log('\n📋 Next steps:');
    console.log(`   1. Update Render env: NEXT_PUBLIC_MARKET_ADDRESS=${addr}`);
    console.log(`   2. Admin connects MetaMask (${signer.address}) to create markets`);
    console.log(`   3. If you want a different admin wallet later:`);
    console.log(`      → Call setOperator(newAddress) from owner MetaMask`);
    console.log(`   4. Server needs NO private key for market creation`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

main().catch(e => { console.error('Fatal:', e.message); process.exit(1); });
