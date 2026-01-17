
import { ethers } from "ethers";
import * as dotenv from "dotenv";

dotenv.config();

const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
const MARKET_ADDRESS = '0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6';
// The User Address we've been debugging with
const USER_ADDRESS = '0xD70ebD0Faa2D1547260176278e0cdE4b3AC41D2a';

const ABI = [
    'function marketCount() view returns (uint256)',
    'function getUserPosition(uint256, address) view returns (uint256[], bool)',
    'function getMarketBasicInfo(uint256) view returns (string, uint256, uint256, uint256, bool, uint256)',
    'function getMarketOutcomes(uint256) view returns (string[])'
];

async function main() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(MARKET_ADDRESS, ABI, provider);

    console.log(`🔍 Checking Portfolio for: ${USER_ADDRESS}`);
    const count = await contract.marketCount();
    console.log(`Scanning ${count} markets...`);

    let foundPositions = false;

    for (let i = 0; i < Number(count); i++) {
        try {
            const [shares, claimed] = await contract.getUserPosition(i, USER_ADDRESS);

            // Check if user has any shares > 0
            const totalShares = shares.reduce((a: bigint, b: bigint) => a + b, BigInt(0));

            if (totalShares > BigInt(0)) {
                foundPositions = true;
                const info = await contract.getMarketBasicInfo(i);
                const outcomes = await contract.getMarketOutcomes(i);

                console.log(`\n✅ FOUND POSITION in Market #${i}`);
                console.log(`   Question: "${info[0]}"`);
                console.log(`   Claimed: ${claimed}`);
                console.log(`   Outcome Shares:`);

                for (let j = 0; j < outcomes.length; j++) {
                    const shareAmt = ethers.formatUnits(shares[j], 18);
                    if (shares[j] > BigInt(0)) {
                        console.log(`     - [${outcomes[j]}]: ${shareAmt} shares`);
                    }
                }
            }
        } catch (e) {
            console.error(`Error checking market ${i}:`, e);
        }
    }

    if (!foundPositions) {
        console.log('\n❌ No active positions found.');
    } else {
        console.log('\n✨ End of Portfolio.');
    }
}

main();
