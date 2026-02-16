import { ethers } from 'ethers';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(__dirname, './.env') });

const RPC_URL = "https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/";
const ADDRESSES = [
    "0xe3Eb84D7e271A5C44B27578547f69C80c497355B",
    "0x5F9C05bE2Af2adb520825950323774eFF308E353",
    "0xcA46FC562e8Ea82CCFA2Ff99aCD9D0F1dDc1CA87",
    "0xEcB7195979Cb5781C2D6b4e97cD00b159922A6B3"
];

const ABI = [
    "event SharesPurchased(uint256 indexed marketId, address indexed user, uint256 outcomeIndex, uint256 shares, uint256 cost)",
    "function marketCount() view returns (uint256)"
];

async function checkAddress(address: string, provider: ethers.JsonRpcProvider) {
    console.log(`\nChecking Address: ${address}`);
    const contract = new ethers.Contract(address, ABI, provider);

    try {
        const count = await contract.marketCount();
        console.log(`Market Count: ${count.toString()}`);

        const currentBlock = await provider.getBlockNumber();
        const SCAN_DEPTH = 2000000; // 2M blocks (~70 days)
        const startBlock = Math.max(0, currentBlock - SCAN_DEPTH);
        const CHUNK_SIZE = 50000;

        let totalVolume = BigInt(0);

        for (let from = startBlock; from <= currentBlock; from += CHUNK_SIZE) {
            const to = Math.min(from + CHUNK_SIZE - 1, currentBlock);
            const logs = await contract.queryFilter(contract.filters.SharesPurchased(), from, to);
            for (const log of logs) {
                // @ts-ignore
                totalVolume += BigInt(log.args[4]);
            }
        }

        console.log(`Volume (Last 2M blocks): $${ethers.formatUnits(totalVolume, 18)}`);
        return totalVolume;
    } catch (e: any) {
        console.log(`Error or No activity: ${e.message}`);
        return BigInt(0);
    }
}

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    let grandTotal = BigInt(0);

    for (const addr of ADDRESSES) {
        grandTotal += await checkAddress(addr, provider);
    }

    console.log("\n=========================================");
    console.log(`GRAND TOTAL VOLUME: $${ethers.formatUnits(grandTotal, 18)}`);
    console.log("=========================================");
}

main();
