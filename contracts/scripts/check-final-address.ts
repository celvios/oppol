import { ethers } from "ethers";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const RPC_URL = "https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/";
const USDC_ADDRESS = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
const FINAL_ADDRESS = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";

async function checkFinalAddress() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const usdc = new ethers.Contract(USDC_ADDRESS, ["function balanceOf(address) view returns (uint256)"], provider);
    
    console.log(`💰 Checking USDC balance at: ${FINAL_ADDRESS}`);
    
    const balance = await usdc.balanceOf(FINAL_ADDRESS);
    console.log(`Balance: ${ethers.formatUnits(balance, 6)} USDC`);
    
    if (parseFloat(ethers.formatUnits(balance, 6)) > 1990) {
        console.log("✅ Found the user's USDC! This address has the funds.");
    }
}

checkFinalAddress().catch(console.error);