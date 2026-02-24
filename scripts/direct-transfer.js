/**
 * direct-transfer.js
 * Transfers USDC direct from 0xd0A115... to destination using the user's provided private key.
 * 0xd0A115... is a plain EOA with no contract code, so whoever has its private key can transfer.
 */
require('dotenv').config();
const { ethers } = require('ethers');

const CUSTODIAL = '0xd0A115Ea64B59F951B70276fCb65b4946465e3a9';
const DESTINATION = '0x667967E3cA6e7d5F2750a172595d3a5416c3b984'; // Platform custodial = connected wallet
const USDC_ADDR = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const RPC_URL = 'https://rpc.ankr.com/bsc/8696831c7e5da7cc66fb967d8f86b97ff978d69ebbf902a0ac5785375df17fc8';

// Try with the user's private key for 0x42501490...
const USER_KEY = '8535a93559f1f9d75f06d478d5d929f760d7ced3e93282054830c126e1a64654';

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    const usdc = new ethers.Contract(USDC_ADDR, [
        'function balanceOf(address) view returns (uint256)',
        'function decimals() view returns (uint8)',
    ], provider);

    const bal = await usdc.balanceOf(CUSTODIAL);
    const dec = Number(await usdc.decimals().catch(() => 18));
    console.log(`Balance at ${CUSTODIAL}: ${ethers.formatUnits(bal, dec)} USDC`);

    if (bal === 0n) {
        console.log('Nothing to transfer.');
        return;
    }

    // Try: does 0x42501490... key control 0xd0A115...?
    const signer = new ethers.Wallet(USER_KEY, provider);
    console.log(`Signer address from key: ${signer.address}`);

    if (signer.address.toLowerCase() !== CUSTODIAL.toLowerCase()) {
        console.log(`\n⚠️  Key controls: ${signer.address}`);
        console.log(`    Custodial is: ${CUSTODIAL}`);
        console.log(`    These don't match — this key cannot sign transactions ON BEHALF of ${CUSTODIAL}.`);
        console.log(`\n    To transfer from ${CUSTODIAL}, you need the private key FOR that address.`);
        console.log(`    The funds were deposited INTO ${CUSTODIAL} from ${signer.address}.`);
        console.log(`    Check if your wallet app has a way to export the key for ${CUSTODIAL}.`);
        return;
    }

    // If we get here, the key IS for 0xd0A115...
    const bnb = await provider.getBalance(CUSTODIAL);
    console.log(`BNB for gas: ${ethers.formatEther(bnb)}`);

    if (bnb < ethers.parseEther('0.0005')) {
        console.log('Funding gas from relayer...');
        const relayer = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
        const tx = await relayer.sendTransaction({ to: CUSTODIAL, value: ethers.parseEther('0.002') });
        await tx.wait();
        console.log('Gas funded:', tx.hash);
    }

    const usdcSigned = new ethers.Contract(USDC_ADDR, [
        'function transfer(address, uint256) returns (bool)',
    ], signer);

    console.log(`\nTransferring ${ethers.formatUnits(bal, dec)} USDC to ${DESTINATION}...`);
    const tx = await usdcSigned.transfer(DESTINATION, bal);
    await tx.wait();
    console.log(`\n🎉 SUCCESS! https://bscscan.com/tx/${tx.hash}`);
}

main().catch(e => console.error('❌', e.message));
