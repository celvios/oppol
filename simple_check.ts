import { ethers } from 'ethers';

const RPC_URL = 'https://bsc-dataseed.binance.org/';
const TARGET_WALLET = '0x3B6a79d61523631473CF80d3845E9e6A0B11e5a4';
const USDC_ADDR = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';

async function main() {
    console.log(`Checking ${TARGET_WALLET} on BSC Mainnet...`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    try {
        const bnbBal = await provider.getBalance(TARGET_WALLET);
        console.log(`BNB: ${ethers.formatEther(bnbBal)}`);

        const usdc = new ethers.Contract(USDC_ADDR, ['function balanceOf(address) view returns (uint256)'], provider);
        const usdcBal = await usdc.balanceOf(TARGET_WALLET);
        console.log(`USDC: ${ethers.formatUnits(usdcBal, 18)}`);
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
