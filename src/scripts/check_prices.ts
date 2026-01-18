
import { ethers } from 'ethers';
import dotenv from 'dotenv';
dotenv.config();

const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
// Use the address found in app.ts or logs
const MARKET_ADDR = '0x95BEec73d2F473bB9Df7DC1b65637fB4CFc047Ae';

const ABI = [
    'function marketCount() view returns (uint256)',
    'function getAllPrices(uint256) view returns (uint256[])',
    'function getMarketBasicInfo(uint256) view returns (string question, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome)'
];

import fs from 'fs';
const log = (msg: string) => {
    console.log(msg);
    fs.appendFileSync('price_check.log', msg + '\n');
};
fs.writeFileSync('price_check.log', '');

async function checkPrices() {
    log(`Checking prices for Market 0 on ${MARKET_ADDR}`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(MARKET_ADDR, ABI, provider);

    try {
        const count = await contract.marketCount();
        log('Total Markets: ' + count.toString());

        if (count == 0) {
            log('Contract has 0 markets. (Deploy script createMarket likely failed)');
            return;
        }

        const prices = await contract.getAllPrices(0);
        log('Raw Prices (basis points): ' + prices.map((p: any) => p.toString()));
        log('Formatted (%): ' + prices.map((p: any) => Number(p) / 100 + '%'));

        const info = await contract.getMarketBasicInfo(7);
        log('Contract Question: ' + info.question);
        log('Outcome Count: ' + info.outcomeCount.toString());
        log('Liquidity Param: ' + ethers.formatUnits(info.liquidityParam, 18));
    } catch (e: any) {
        log('Error: ' + e.message);
    }
}

checkPrices();
