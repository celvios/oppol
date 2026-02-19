const { ethers } = require('ethers');

// QuickNode or Binance RPC
const RPC_URL = process.env.BNB_RPC_URL || 'https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/';
const TARGET_WALLET = '0x3B6a79d61523631473CF80d3845E9e6A0B11e5a4';
const USDT_ADDR = '0x55d398326f99059fF775485246999027B3197955'; // BSC USDT

async function main() {
    console.log(`Checking ${TARGET_WALLET} for USDT on BSC...`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    try {
        const usdt = new ethers.Contract(USDT_ADDR, ['function balanceOf(address) view returns (uint256)'], provider);
        const bal = await usdt.balanceOf(TARGET_WALLET);
        console.log(`USDT: ${ethers.formatUnits(bal, 18)}`); // USDT on BSC is 18 decimals
    } catch (e) {
        console.error("Error:", e);
    }
}

main();
