const ethers = require('ethers');

// RPC from env or default
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-dataseed.binance.org';
const provider = new ethers.JsonRpcProvider(RPC_URL);

const ADDRESS = "0x61Fc93c7C070B32B1b1479B86056d8Ec1D7125BD"; // BC400 Token?

const ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function decimals() view returns (uint8)",
    "function totalSupply() view returns (uint256)"
];

async function main() {
    console.log(`Inspecting contract at ${ADDRESS}...`);
    const contract = new ethers.Contract(ADDRESS, ABI, provider);

    try {
        const name = await contract.name();
        console.log(`Name: ${name}`);
        const symbol = await contract.symbol();
        console.log(`Symbol: ${symbol}`);
        const decimals = await contract.decimals();
        console.log(`Decimals: ${decimals}`);
    } catch (e) {
        console.log("Error: " + e.message);
    }
}

main().catch(console.error);
