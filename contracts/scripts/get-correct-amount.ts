import { ethers } from "ethers";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const RPC_URL = "https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/";
const TX_HASH = "0xfc14bbaf4e101ad5b543f345651838e81626725430859d2d509c25778a5ec2a5";
const USDC_ADDRESS = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";

async function getCorrectAmount() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    // Get USDC contract to check decimals
    const usdcContract = new ethers.Contract(USDC_ADDRESS, [
        "function decimals() view returns (uint8)"
    ], provider);
    
    const decimals = await usdcContract.decimals();
    console.log(`USDC decimals: ${decimals}`);
    
    const receipt = await provider.getTransactionReceipt(TX_HASH);
    
    console.log("\n🔍 Correct USDC amounts:\n");
    
    for (const log of receipt.logs) {
        if (log.address.toLowerCase() === USDC_ADDRESS.toLowerCase() && 
            log.topics[0] === ethers.id("Transfer(address,address,uint256)")) {
            
            const amount = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], log.data)[0];
            const to = ethers.getAddress("0x" + log.topics[2].slice(26));
            
            const correctAmount = ethers.formatUnits(amount, decimals);
            console.log(`${correctAmount} USDC to ${to}`);
            
            // Check if this is to the custodial wallet
            if (to.toLowerCase() === "0xe3Eb84D7e271A5C44B27578547f69C80c497355B".toLowerCase()) {
                console.log(`✅ User received: ${correctAmount} USDC`);
            }
        }
    }
}

getCorrectAmount().catch(console.error);