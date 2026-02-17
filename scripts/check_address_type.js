const ethers = require('ethers');

// RPC from env or default
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-dataseed.binance.org';
const provider = new ethers.JsonRpcProvider(RPC_URL);

const ADDRESS = "0xB929177331De755d7aCc5665267a247e458bCdeC";

async function main() {
    console.log(`Checking address: ${ADDRESS}`);
    const code = await provider.getCode(ADDRESS);

    if (code === '0x') {
        console.log("Result: EOA (Externally Owned Account) - This is a User Wallet.");
    } else {
        console.log("Result: CONTRACT - This is a Smart Contract.");
        console.log(`Code length: ${code.length}`);
    }
}

main().catch(console.error);
