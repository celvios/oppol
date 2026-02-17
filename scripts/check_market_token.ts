
import { ethers } from 'ethers';
import { MARKET_ABI } from '../src/config/abis';
import { CONFIG } from '../src/config/contracts';
import { getProvider } from '../src/config/provider';
import dotenv from 'dotenv';

dotenv.config();

async function main() {
    console.log(`Checking Market Contract Token...`);
    console.log(`Market Address: ${CONFIG.MARKET_CONTRACT}`);

    const provider = getProvider();

    // ABI snippet for 'token'
    const abi = [
        ...MARKET_ABI,
        'function token() view returns (address)'
    ];

    const contract = new ethers.Contract(CONFIG.MARKET_CONTRACT, abi, provider);

    try {
        const tokenAddress = await contract.token();
        console.log(`Market Base Token: ${tokenAddress}`);

        // Check if it matches known addresses
        const USDT = "0x55d398326f99059fF775485246999027B3197955";
        const USDC = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";

        if (tokenAddress === USDT) console.log("Identified as: USDT (BSC)");
        else if (tokenAddress === USDC) console.log("Identified as: USDC (BSC)");
        else console.log("Unknown Token");

    } catch (e) {
        console.error("Error fetching token:", e);
    }
}

main().catch(console.error);
