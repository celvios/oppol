// Probe the smart account to find out what execute functions it has
require('dotenv').config({ path: '../../.env' });
const { ethers } = require('ethers');

const SMART_ACCOUNT = '0xd0A115Ea64B59F951B70276fCb65b4946465e3a9';
const USDC_ADDR = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const MY_WALLET = '0x42501490f7c291b4B28110900c9Bd81f3B35B849';
const MY_KEY = process.env.MY_PRIVATE_KEY;

const USDC_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
    'function transfer(address,uint256) returns (bool)',
];

// EIP-7702 / Safe / Biconomy / Kernel / Alchemy Light Account execute ABIs
const ATTEMPTS = [
    // Kernel / Biconomy Nexus
    {
        name: 'execute(address,uint256,bytes)',
        abi: ['function execute(address dest, uint256 value, bytes calldata func)']
    },
    // Safe-style
    {
        name: 'execTransaction(address,uint256,bytes,...)',
        abi: ['function execTransaction(address to, uint256 value, bytes calldata data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address payable refundReceiver, bytes calldata signatures) payable returns (bool success)']
    },
    // Alchemy Light Account
    {
        name: 'execute(address,uint256,bytes) - Light',
        abi: ['function execute(address dest, uint256 value, bytes calldata func) external']
    },
    // Coinbase Smart Wallet
    {
        name: 'execute(bytes32,bytes[])',
        abi: ['function execute(bytes32 userOpHash, bytes[] calldata signatures)']
    },
];

async function main() {
    const provider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/');

    // Check code at smart account
    const code = await provider.getCode(SMART_ACCOUNT);
    console.log(`\nCode at ${SMART_ACCOUNT}: ${code.length > 2 ? `YES (${code.length} bytes)` : 'NO (EOA)'}`);

    // Check balances
    const usdc = new ethers.Contract(USDC_ADDR, USDC_ABI, provider);
    const dec = Number(await usdc.decimals().catch(() => 18));
    const bal = await usdc.balanceOf(SMART_ACCOUNT);
    console.log(`USDC balance: ${ethers.formatUnits(bal, dec)}`);

    if (code.length <= 2) {
        console.log('\n⚠️  Smart account has NO code — it is a plain EOA.');
        console.log('   Someone with the private key of this address controls it directly.');
        console.log('   The platform may have created this as a custodial wallet. Check via Privy dashboard.');
        return;
    }

    if (!MY_KEY || bal === 0n) {
        console.log('\nNo key or no balance — stopping here.');
        return;
    }

    // Get first 4 bytes of code to compare signatures
    console.log(`\nCode prefix (implementation hint): ${code.slice(0, 20)}`);

    const signer = new ethers.Wallet(MY_KEY, provider);
    const usdcIface = new ethers.Interface(USDC_ABI);
    const transferData = usdcIface.encodeFunctionData('transfer', [MY_WALLET, bal]);

    for (const attempt of ATTEMPTS) {
        try {
            const ct = new ethers.Contract(SMART_ACCOUNT, attempt.abi, signer);
            const fn = attempt.abi[0].match(/function (\w+)/)[1];
            console.log(`\nTrying ${attempt.name}...`);
            const tx = await ct[fn](USDC_ADDR, 0n, transferData);
            await tx.wait();
            console.log(`\n🎉 SUCCESS! TX: https://bscscan.com/tx/${tx.hash}`);
            return;
        } catch (e) {
            console.log(`  ↳ Failed: ${e.message.slice(0, 100)}`);
        }
    }

    console.log('\n❌ All standard execute patterns failed.');
    console.log(`   Check BSCScan for the contract ABI: https://bscscan.com/address/${SMART_ACCOUNT}#code`);
}

main().catch(console.error);
