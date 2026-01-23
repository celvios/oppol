import { ethers } from "hardhat";

async function main() {
    const PROXY_ADDRESS = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    
    const contract = await ethers.getContractAt("PredictionMarketMultiV2", PROXY_ADDRESS);
    
    const count = await contract.marketCount();
    console.log(`\n📊 Total Markets: ${count}\n`);
    
    for (let i = 0; i < count; i++) {
        try {
            const basicInfo = await contract.getMarketBasicInfo(i);
            const outcomes = await contract.getMarketOutcomes(i);
            
            console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`Market #${i}: ${basicInfo[0]}`);
            console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
            console.log(`Image: ${basicInfo[1]}`);
            console.log(`Description: ${basicInfo[2]}`);
            console.log(`Outcome Count: ${basicInfo[3]}`);
            console.log(`End Time: ${basicInfo[4]} (${new Date(Number(basicInfo[4]) * 1000).toLocaleString()})`);
            console.log(`Liquidity: ${basicInfo[5]}`);
            console.log(`Resolved: ${basicInfo[6]}`);
            console.log(`Winning Outcome: ${basicInfo[7]}`);
            console.log(`Outcomes: ${outcomes.join(', ')}`);
            
            const now = Math.floor(Date.now() / 1000);
            const hasEnded = now >= Number(basicInfo[4]);
            console.log(`\n⏰ Status: ${hasEnded ? '🔴 ENDED' : '🟢 ACTIVE'}`);
            console.log(`📍 Resolved: ${basicInfo[6] ? '✅ YES' : '❌ NO'}`);
            
        } catch (e) {
            console.error(`\n❌ Error reading market ${i}:`, e);
        }
    }
}

main().catch(console.error);
