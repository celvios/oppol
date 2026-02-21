/**
 * Deploy fresh ZAP contract pointing at new V4 market
 */
const { ethers } = require('hardhat');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log('Deployer:', deployer.address);

    const MARKET = process.env.MARKET_CONTRACT;
    const USDC = process.env.USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
    // PancakeSwap V2 router on BSC Mainnet
    const ROUTER = '0x10ED43C718714eb63d5aA57B78B54704E256024E';

    console.log('Market:', MARKET);
    console.log('USDC:  ', USDC);
    console.log('Router:', ROUTER);

    const ZapFactory = await ethers.getContractFactory('Zap');
    console.log('\nDeploying Zap...');
    const zap = await ZapFactory.deploy(MARKET, USDC, ROUTER);
    await zap.waitForDeployment();
    const zapAddr = await zap.getAddress();

    console.log('✅ Zap deployed at:', zapAddr);
    console.log('\nUpdate your .env and Render with:');
    console.log('NEXT_PUBLIC_ZAP_ADDRESS=' + zapAddr);
}

main().catch(e => { console.error('❌ FAILED:', e.message); process.exitCode = 1; });
