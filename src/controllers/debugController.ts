import { Request, Response } from 'express';
import { ethers } from 'ethers';

export const checkContractMarkets = async (req: Request, res: Response) => {
    try {
        const provider = new ethers.JsonRpcProvider('https://bsc-rpc.publicnode.com');
        const CONTRACT = '0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6';
        
        const abi = [
            'function marketCount() view returns (uint256)',
            'function getAllPrices(uint256) view returns (uint256[])'
        ];
        
        const contract = new ethers.Contract(CONTRACT, abi, provider);
        
        const count = await contract.marketCount();
        const markets = [];
        
        for (let i = 0; i < Number(count); i++) {
            try {
                const prices = await contract.getAllPrices(i);
                markets.push({
                    id: i,
                    prices: prices.map((p: bigint) => Number(p) / 100)
                });
            } catch (e) {
                markets.push({ id: i, error: 'Failed to fetch' });
            }
        }
        
        res.json({ contract: CONTRACT, totalMarkets: count.toString(), markets });
    } catch (error: any) {
        res.json({ error: error.message });
    }
};
