// Run: npx ts-node scripts/set-protocol-fee.ts
import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

async function main() {
    const provider = new ethers.JsonRpcProvider('https://bsc-dataseed.binance.org/');
    const signer = new ethers.Wallet(process.env.PRIVATE_KEY!, provider);
    const market = new ethers.Contract(
        process.env.NEXT_PUBLIC_MARKET_ADDRESS!,
        ['function setProtocolFee(uint256 _fee) external', 'function protocolFee() view returns (uint256)'],
        signer
    );

    const current = await market.protocolFee();
    console.log(`Current protocol fee: ${Number(current) / 100}% (${current} bps)`);

    const tx = await market.setProtocolFee(1000); // 10%
    console.log(`TX sent: ${tx.hash}`);
    await tx.wait();

    const updated = await market.protocolFee();
    console.log(`Updated protocol fee: ${Number(updated) / 100}% (${updated} bps)`);
}
main();
