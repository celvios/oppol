/**
 * Upgrade proxy from V2 → V4 using upgradeToAndCall (OZ v5 compatible)
 */
const { ethers } = require('ethers');
const hardhat = require('hardhat');
require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });

async function main() {
    const PROXY_ADDRESS = process.env.NEXT_PUBLIC_MARKET_ADDRESS;
    if (!PROXY_ADDRESS) throw new Error('Missing NEXT_PUBLIC_MARKET_ADDRESS');

    console.log('🚀 Upgrading to V4 at:', PROXY_ADDRESS);

    const [signer] = await hardhat.ethers.getSigners();
    console.log('Signer:', signer.address);

    // Deploy V4 implementation
    const V4Factory = await hardhat.ethers.getContractFactory('PredictionMarketMultiV4');
    console.log('Deploying V4 implementation...');
    const impl = await V4Factory.deploy();
    await impl.waitForDeployment();
    const implAddr = await impl.getAddress();
    console.log('✅ V4 Implementation:', implAddr);

    // Call upgradeToAndCall on the proxy (OZ 5.x UUPS standard)
    const proxyAbi = [
        'function upgradeToAndCall(address newImplementation, bytes calldata data) external',
        'function owner() view returns (address)'
    ];
    const proxy = new hardhat.ethers.Contract(PROXY_ADDRESS, proxyAbi, signer);

    const owner = await proxy.owner();
    console.log('Proxy owner:', owner);
    console.log('Signer:     ', signer.address);
    if (owner.toLowerCase() !== signer.address.toLowerCase()) {
        throw new Error('Signer is not the owner!');
    }

    console.log('Upgrading...');
    const tx = await proxy.upgradeToAndCall(implAddr, '0x', { gasLimit: 500000 });
    await tx.wait();
    console.log('✅ Upgraded to V4! Tx:', tx.hash);

    console.log('\n=== V4 UPGRADE COMPLETE ===');
    console.log('Proxy:', PROXY_ADDRESS);
    console.log('Implementation:', implAddr);
}

main().catch(e => { console.error('❌ FAILED:', e.message); process.exitCode = 1; });
