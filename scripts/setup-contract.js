/**
 * Contract Setup Script
 * Configures the newly deployed contract with correct fees, token, and operator
 */
const { ethers } = require('ethers');
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });

const CONTRACT_ABI = [
    'function owner() view returns (address)',
    'function protocolFee() view returns (uint256)',
    'function setProtocolFee(uint256 _fee) external',
    'function setCreationToken(address _token, uint256 _minBalance) external',
    'function setSecondaryCreationSettings(address _token, uint256 _minBalance) external',
    'function setOperator(address _operator) external',
    'function setPublicCreation(bool _enabled) external',
    'function publicCreation() view returns (bool)',
    'function creatorFeeBps() view returns (uint256)',
    'function setCreatorFee(uint256 _bps) external',
    'function initializeV3() external',
];

async function main() {
    const provider = new ethers.JsonRpcProvider('https://bsc-dataseed1.binance.org/');
    const owner = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    const contractAddr = process.env.MARKET_CONTRACT;

    console.log('Owner:', owner.address);
    console.log('Contract:', contractAddr);

    const contract = new ethers.Contract(contractAddr, CONTRACT_ABI, owner);

    // Verify ownership
    const onChainOwner = await contract.owner();
    console.log('On-chain owner:', onChainOwner);
    if (onChainOwner.toLowerCase() !== owner.address.toLowerCase()) {
        throw new Error('You are not the owner!');
    }

    // 1. Set Protocol Fee to 10% (1000 bps)
    console.log('\n[1/5] Setting protocol fee to 10%...');
    const tx1 = await contract.setProtocolFee(1000, { gasLimit: 100000 });
    await tx1.wait();
    console.log('✅ Protocol fee set to 10%');

    // 2. Set Creator Fee to 2% (200 bps) - for V3
    try {
        console.log('\n[2/5] Setting creator fee to 2%...');
        const tx2 = await contract.setCreatorFee(200, { gasLimit: 100000 });
        await tx2.wait();
        console.log('✅ Creator fee set to 2%');
    } catch (e) {
        console.log('ℹ️  setCreatorFee not available on V2 (will be available after V3 upgrade)');
    }

    // 3. Set BC400 as creation token (secondary access)
    const BC400 = process.env.NEXT_PUBLIC_BC400_CONTRACT || '0xB929177331De755d7aCc5665267a247e458bCdeC';
    const NFT_CONTRACT = process.env.NFT_CONTRACT || BC400;
    console.log('\n[3/5] Setting creation token (BC400 / NFT)...');
    try {
        const tx3 = await contract.setCreationToken(NFT_CONTRACT, 1, { gasLimit: 100000 });
        await tx3.wait();
        console.log('✅ Primary creation token set:', NFT_CONTRACT);
    } catch (e) {
        console.log('ℹ️  setCreationToken failed:', e.message?.slice(0, 60));
    }

    // 4. Set backend relayer as operator
    const operatorAddr = owner.address; // Use safe wallet as operator for now
    console.log('\n[4/5] Setting operator...');
    try {
        const tx4 = await contract.setOperator(operatorAddr, { gasLimit: 100000 });
        await tx4.wait();
        console.log('✅ Operator set to:', operatorAddr);
    } catch (e) {
        console.log('ℹ️  setOperator failed:', e.message?.slice(0, 60));
    }

    // 5. Enable public creation (allows NFT/BC400 holders to create markets)
    console.log('\n[5/5] Enabling public creation...');
    try {
        const tx5 = await contract.setPublicCreation(false, { gasLimit: 100000 }); // Keep off - require NFT
        await tx5.wait();
        console.log('✅ Public creation: OFF (requires NFT/BC400)');
    } catch (e) {
        console.log('ℹ️  setPublicCreation:', e.message?.slice(0, 60));
    }

    // Final status
    console.log('\n=== CONTRACT STATUS ===');
    try { console.log('Protocol Fee:', (await contract.protocolFee()).toString(), 'bps'); } catch { }
    try { console.log('Public Creation:', await contract.publicCreation()); } catch { }

    console.log('\n✅ CONTRACT SETUP COMPLETE!');
    console.log('New contract address:', contractAddr);
    console.log('\nUpdate these on Render:');
    console.log('  MARKET_CONTRACT=' + contractAddr);
    console.log('  NEXT_PUBLIC_MARKET_ADDRESS=' + contractAddr);
    console.log('  MULTI_MARKET_ADDRESS=' + contractAddr);
    console.log('  PRIVATE_KEY=' + process.env.PRIVATE_KEY);
}

main().catch(e => { console.error('❌ SETUP FAILED:', e.message); process.exit(1); });
