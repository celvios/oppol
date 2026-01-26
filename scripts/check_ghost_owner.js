const { ethers } = require("ethers");
require("dotenv").config();

const RPCS = [
    "https://bsc-dataseed1.defibit.io/",
    "https://bsc-dataseed.binance.org/"
];

const GHOST_ADDR = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
const ABI = ["function owner() view returns (address)"];

async function main() {
    console.log("Checking Owner...");
    let provider;
    for (const rpc of RPCS) {
        try { provider = new ethers.JsonRpcProvider(rpc); await provider.getNetwork(); break; } catch (e) { }
    }

    const adminWallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);

    const contract = new ethers.Contract(GHOST_ADDR, ABI, provider);
    const owner = await contract.owner();

    console.log("Ghost Market Owner:", owner);
    console.log("Admin Wallet:      ", adminWallet.address);
    console.log("Is Admin Owner?    ", owner.toLowerCase() === adminWallet.address.toLowerCase());
}

main().catch(console.error);
