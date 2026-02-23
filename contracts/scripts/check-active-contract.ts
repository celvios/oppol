import { ethers } from "ethers";

const RPC = "https://bsc-dataseed.binance.org/";
const provider = new ethers.JsonRpcProvider(RPC);

const ABI = ["function marketCount() view returns (uint256)"];

async function check(name: string, address: string) {
    const contract = new ethers.Contract(address, ABI, provider);
    try {
        const count = await contract.marketCount();
        console.log(`${name} (${address}): ${count} markets`);
    } catch (e) {
        console.log(`${name} (${address}): ERROR`);
    }
}

async function main() {
    await check("Frontend .env.local 0xe3E", "0xe3Eb84D7e271A5C44B27578547f69C80c497355B");
    await check("Backend .env 0xe5a", "0xe5a5320b3764Bd8FFFd95cF7aA7F406DaC2B070C");
}

main();
