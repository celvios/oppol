const ethers = require('ethers');

// RPC from env or default
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-dataseed.binance.org';
const provider = new ethers.JsonRpcProvider(RPC_URL);

const ADDRESS = "0xB929177331De755d7aCc5665267a247e458bCdeC";
const RANDOM_ADDRESS = "0x000000000000000000000000000000000000dead"; // Burn address

const ABI = [
    "function name() view returns (string)",
    "function symbol() view returns (string)",
    "function balanceOf(address) view returns (uint256)",
    "function supportsInterface(bytes4) view returns (bool)"
];

async function main() {
    console.log(`Inspecting contract at ${ADDRESS}...`);
    const contract = new ethers.Contract(ADDRESS, ABI, provider);

    try {
        const name = await contract.name();
        console.log(`Name: ${name}`);
    } catch (e) {
        console.log("Name: [Call Failed] - " + e.code);
    }

    try {
        const symbol = await contract.symbol();
        console.log(`Symbol: ${symbol}`);
    } catch (e) {
        console.log("Symbol: [Call Failed] - " + e.code);
    }

    try {
        const balance = await contract.balanceOf(RANDOM_ADDRESS);
        console.log(`BalanceOf(dead): ${balance.toString()}`);
    } catch (e) {
        console.log("BalanceOf: [Call Failed] - " + e.code);
        // Look for specific revert data if possible
        if (e.data) console.log(`Data: ${e.data}`);
    }

    // Check ERC721 Interface (0x80ac58cd)
    try {
        const is721 = await contract.supportsInterface("0x80ac58cd");
        console.log(`Is ERC721? ${is721}`);
    } catch (e) {
        console.log("SupportsInterface: [Call Failed]");
    }
}

main().catch(console.error);
