
import { ethers } from "ethers";

const RPC_URL = "https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/";
const WRONG_ENV_ADDRESS = "0xa4B1B886f955b2342bC9bB4f77B80839357378b7"; // The one currently in .env

async function check() {
    console.log(`Checking address found in .env: ${WRONG_ENV_ADDRESS}`);

    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const balance = await provider.getBalance(WRONG_ENV_ADDRESS);
        const count = await provider.getTransactionCount(WRONG_ENV_ADDRESS);
        const code = await provider.getCode(WRONG_ENV_ADDRESS);

        console.log(`Balance: ${ethers.formatEther(balance)} BNB`);
        console.log(`Nonce: ${count}`);
        console.log(`Type: ${code !== "0x" ? "Contract" : "EOA"}`);

    } catch (error: any) {
        console.error("Error:", error.message);
    }
}

check().catch(console.error);
