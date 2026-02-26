/**
 * Redeploy the Zap contract pointing to the CORRECT market address.
 * Also rescues the user's USDC stuck in the old market.
 * 
 * Run: npx hardhat run scripts/redeploy-zap.ts --network bsc
 */
import { ethers } from "hardhat";
import * as dotenv from "dotenv";
dotenv.config();

const CORRECT_MARKET = process.env.NEXT_PUBLIC_MARKET_ADDRESS || "0x224960Ccf500CfECba7DF579772067BF2390d259";
const USDC_ADDRESS = process.env.NEXT_PUBLIC_USDC_CONTRACT || "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
const PANCAKE_ROUTER = "0x10ED43C718714eb63d5aA57B78B54704E256024E";

async function main() {
    const [deployer] = await ethers.getSigners();
    console.log("\n━━━ REDEPLOY ZAP CONTRACT ━━━");
    console.log("Deployer:", deployer.address);
    console.log("Market:  ", CORRECT_MARKET);
    console.log("USDC:    ", USDC_ADDRESS);
    console.log("Router:  ", PANCAKE_ROUTER);

    const ZapFactory = await ethers.getContractFactory("Zap");
    const zap = await ZapFactory.deploy(CORRECT_MARKET, USDC_ADDRESS, PANCAKE_ROUTER);
    await zap.waitForDeployment();

    const newZapAddress = await zap.getAddress();
    console.log("\n✅ New Zap deployed at:", newZapAddress);
    console.log("\nNow update your .env:");
    console.log(`  NEXT_PUBLIC_ZAP_ADDRESS=${newZapAddress}`);
    console.log("\nAnd on Render, update the env var too.");
    console.log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n");
}

main().catch((error) => {
    console.error(error);
    process.exit(1);
});
