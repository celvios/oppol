import { Request, Response } from 'express';
import pool from '../config/database';
import { ethers } from 'ethers';

// Helper to query mock DB
const query = (text: string, params: any[]) => pool.query(text, params);

// --- MARKETS ---

export const createMarketMetadata = async (req: Request, res: Response) => {
    try {
        const { marketId, question, description, imageUrl, categoryId } = req.body;

        if (!marketId || !question) {
            return res.status(400).json({ success: false, message: 'Missing marketId or question' });
        }

        await query(
            'insert into markets (market_id, question, description, image, category) values ($1, $2, $3, $4, $5)',
            [marketId, question, description || '', imageUrl || '', categoryId || '']
        );

        res.json({ success: true, message: 'Market metadata created' });
    } catch (error) {
        console.error('Create Metadata Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getAllMarketMetadata = async (req: Request, res: Response) => {
    try {
        const result = await query('select * from markets', []);
        const markets = [];

        const provider = new ethers.JsonRpcProvider(process.env.BNB_RPC_URL || 'https://bsc-rpc.publicnode.com');
        const { CONFIG } = require('../config/contracts');
        const MARKET_ADDRESS = CONFIG.MARKET_CONTRACT;
        console.log('📄 Using contract address:', MARKET_ADDRESS);

        const abi = [
            'function getMarketOutcomes(uint256) view returns (string[])',
            'function getAllPrices(uint256) view returns (uint256[])',
            'function getMarketBasicInfo(uint256) view returns (string, uint256, uint256, uint256, bool, uint256)'
        ];
        const contract = new ethers.Contract(MARKET_ADDRESS, abi, provider);

        for (const row of result.rows) {
            let onChainData: any = {};
            try {
                const [outcomes, prices, basicInfo] = await Promise.all([
                    contract.getMarketOutcomes(row.market_id),
                    contract.getAllPrices(row.market_id),
                    contract.getMarketBasicInfo(row.market_id)
                ]);

                onChainData = {
                    outcomes: outcomes,
                    prices: prices.map((p: bigint) => Number(p) / 100),
                    liquidityParam: basicInfo[3].toString(),
                    endTime: Number(basicInfo[2]),
                    resolved: basicInfo[4],
                    winningOutcome: Number(basicInfo[5])
                };
            } catch (err) {
                console.error(`Failed to fetch on-chain data for market ${row.market_id}:`, err);
                onChainData = { outcomes: ['Yes', 'No'], prices: [50, 50] };
            }

            markets.push({
                market_id: row.market_id,
                question: row.question,
                description: row.description || '',
                image_url: row.image || '',
                category_id: row.category || '',
                ...onChainData
            });
        }

        res.json({ success: true, markets });
    } catch (error) {
        console.error('Get All Metadata Error:', error);
        res.json({ success: true, markets: [] });
    }
};

export const getMarketMetadata = async (req: Request, res: Response) => {
    try {
        const { marketId } = req.params;
        const result = await query('select * from markets where market_id = $1', [marketId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Market not found' });
        }

        const row = result.rows[0];

        // FETCH ON-CHAIN DATA
        let onChainData: any = {};
        try {
            const provider = new ethers.JsonRpcProvider(process.env.BNB_RPC_URL || 'https://bsc-rpc.publicnode.com');
            const { CONFIG } = require('../config/contracts');
            const MARKET_ADDRESS = CONFIG.MARKET_CONTRACT;
            console.log(`[Market ${marketId}] Fetching from contract: ${MARKET_ADDRESS}`);
            console.log(`[Market ${marketId}] RPC URL: ${process.env.BNB_RPC_URL}`);

            const abi = [
                'function getPrice(uint256) view returns (uint256)',
                'function markets(uint256) view returns (string, uint256, uint256, uint256, uint256, bool, bool, uint256)'
            ];
            const contract = new ethers.Contract(MARKET_ADDRESS, abi, provider);

            console.log(`[Market ${marketId}] Calling contract methods...`);

            // Add a small delay to ensure blockchain state is updated
            await new Promise(resolve => setTimeout(resolve, 2000));

            // Try to call each method individually to see which one fails
            let outcomes, prices, basicInfo;

            try {
                outcomes = await contract.getMarketOutcomes(marketId);
                console.log(`[Market ${marketId}] Outcomes success:`, outcomes);
            } catch (e) {
                console.error(`[Market ${marketId}] getMarketOutcomes failed:`, e);
                outcomes = ['Yes', 'No'];
            }

            try {
                prices = await contract.getAllPrices(marketId);
                console.log(`[Market ${marketId}] Prices success:`, prices.map((p: bigint) => p.toString()));
            } catch (e) {
                console.error(`[Market ${marketId}] getAllPrices failed:`, e);
                prices = [BigInt(5000), BigInt(5000)]; // 50% each
            }

            try {
                basicInfo = await contract.getMarketBasicInfo(marketId);
                console.log(`[Market ${marketId}] BasicInfo success:`, basicInfo);
            } catch (e) {
                console.error(`[Market ${marketId}] getMarketBasicInfo failed:`, e);
                basicInfo = ['', 0, 1799622939, 600, false, 0];
            }

            console.log(`[Market ${marketId}] Raw outcomes:`, outcomes);
            console.log(`[Market ${marketId}] Raw prices:`, prices.map((p: bigint) => p.toString()));
            console.log(`[Market ${marketId}] Basic info:`, basicInfo);

            onChainData = {
                outcomes: outcomes,
                prices: prices.map((p: bigint) => Number(p) / 100), // Basis points to %
                liquidityParam: basicInfo[3].toString(),
                endTime: Number(basicInfo[2]),
                resolved: basicInfo[4],
                winningOutcome: Number(basicInfo[5])
            };

            console.log(`[Market ${marketId}] Processed prices:`, onChainData.prices);
        } catch (err) {
            console.error(`Failed to fetch on-chain data for ${marketId}:`, err);
            // Fallback for outcomes if on-chain fails (default Yes/No)
            onChainData = { outcomes: ['Yes', 'No'], prices: [50, 50] };
        }

        const market = {
            market_id: row.market_id,
            question: row.question,
            description: row.description || '',
            image_url: row.image || '',
            category_id: row.category || '',
            ...onChainData
        };

        res.json({ success: true, market });
    } catch (error) {
        console.error('Get Metadata Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

// --- CATEGORIES ---

export const createCategory = async (req: Request, res: Response) => {
    try {
        const { name } = req.body;
        if (!name) return res.status(400).json({ success: false, message: 'Name is required' });

        const result = await query('insert into categories (name) values ($1)', [name]);
        res.json({ success: true, category: result.rows[0] });
    } catch (error) {
        console.error('Create Category Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getCategories = async (req: Request, res: Response) => {
    try {
        const result = await query('select * from categories', []);
        res.json({ success: true, categories: result.rows });
    } catch (error) {
        console.error('Get Categories Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
