const { ethers } = require("ethers");

const RPC_URL = "https://bsc-dataseed.binance.org/";
const BC400_ADDRESS = "0x61Fc93c7C070B32B1b1479B86056d8Ec1D7125BD";
const ABI = ["function decimals() view returns (uint8)", "function symbol() view returns (string)"];

async function main() {
    console.log(`Connecting to ${RPC_URL}...`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(BC400_ADDRESS, ABI, provider);

    try {
        const symbol = await contract.symbol();
        const decimals = await contract.decimals();
        console.log(`Token: ${symbol}`);
        console.log(`Address: ${BC400_ADDRESS}`);
        console.log(`Decimals: ${decimals}`);
    } catch (error) {
        console.error("Error fetching decimals:", error.message);
    }
}

main();
