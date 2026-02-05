import { ethers } from "ethers";
import * as dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const RPC_URL = "https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/";
const TX_HASH = "0xfc14bbaf4e101ad5b543f345651838e81626725430859d2d509c25778a5ec2a5";
const USDC_ADDRESS = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";

async function getActualUSDCAmount() {
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    
    const receipt = await provider.getTransactionReceipt(TX_HASH);
    
    console.log("🔍 Checking actual USDC amounts in transaction...\n");
    
    for (const log of receipt.logs) {
        if (log.address.toLowerCase() === USDC_ADDRESS.toLowerCase() && 
            log.topics[0] === ethers.id("Transfer(address,address,uint256)")) {
            
            const amount = ethers.AbiCoder.defaultAbiCoder().decode(["uint256"], log.data)[0];
            const from = ethers.getAddress("0x" + log.topics[1].slice(26));
            const to = ethers.getAddress("0x" + log.topics[2].slice(26));
            
            console.log(`USDC Transfer: ${ethers.formatUnits(amount, 6)} USDC`);
            console.log(`From: ${from}`);
            console.log(`To: ${to}\n`);
        }
    }
}

getActualUSDCAmount().catch(console.error);