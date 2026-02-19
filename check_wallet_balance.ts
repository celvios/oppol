import { ethers } from 'ethers';
import dotenv from 'dotenv';
import { CONFIG } from './src/config/contracts';
dotenv.config();

async function main() {
    const targetWallet = '0x3B6a79d61523631473CF80d3845E9e6A0B11e5a4';
    const rpcUrl = process.env.BNB_RPC_URL;

    if (!rpcUrl) { console.error("No RPC URL"); return; }

    const provider = new ethers.JsonRpcProvider(rpcUrl);

    // BNB Balance
    const bnbBal = await provider.getBalance(targetWallet);
    console.log(`BNB Balance: ${ethers.formatEther(bnbBal)}`);

    // USDC Balance
    const usdcAbi = ['function balanceOf(address) view returns (uint256)'];
    const usdc = new ethers.Contract(CONFIG.USDC_CONTRACT, usdcAbi, provider);
    const usdcBal = await usdc.balanceOf(targetWallet);
    console.log(`USDC Balance: ${ethers.formatUnits(usdcBal, 18)}`);
}

main();
