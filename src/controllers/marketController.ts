import { Request, Response } from 'express';
import pool from '../config/database';
import { ethers } from 'ethers';

// Helper to query mock DB
const query = (text: string, params: any[]) => pool.query(text, params);

// --- CACHING: Reduce RPC calls by caching market data ---
interface CacheEntry {
    data: any;
    timestamp: number;
}

const marketCache: { all?: CacheEntry; single: Map<string, CacheEntry> } = {
    all: undefined,
    single: new Map()
};

const CACHE_TTL_MS = 30000; // 30 seconds cache TTL

function isCacheValid(entry: CacheEntry | undefined): boolean {
    if (!entry) return false;
    return Date.now() - entry.timestamp < CACHE_TTL_MS;
}

// --- MARKETS ---

export const createMarketMetadata = async (req: Request, res: Response) => {
    try {
        const { marketId, question, description, imageUrl, categoryId, creatorAddress } = req.body;

        if (!marketId || !question) {
            return res.status(400).json({ success: false, message: 'Missing marketId or question' });
        }

        await query(
            'insert into markets (market_id, question, description, image, category, creator_address) values ($1, $2, $3, $4, $5, $6)',
            [marketId, question, description || '', imageUrl || '', categoryId || '', creatorAddress || '']
        );

        res.json({ success: true, message: 'Market metadata created' });
    } catch (error) {
        console.error('Create Metadata Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

export const getAllMarketMetadata = async (req: Request, res: Response) => {
    try {
        // Check cache first - return cached data if valid
        if (isCacheValid(marketCache.all)) {
            console.log('📦 Returning cached markets data');
            return res.json({ success: true, markets: marketCache.all!.data });
        }

        console.log('🔄 Cache miss - fetching fresh market data from blockchain');
        const result = await query('select * from markets', []);

        const { CONFIG } = require('../config/contracts');
        const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
        const MARKET_ADDRESS = CONFIG.MARKET_CONTRACT;
        console.log('📄 Using contract address:', MARKET_ADDRESS);

        const abi = [
            'function getMarketOutcomes(uint256) view returns (string[])',
            'function getAllPrices(uint256) view returns (uint256[])',
            'function getMarketBasicInfo(uint256) view returns (string, string, string, uint256, uint256, uint256, bool, uint256)'
        ];
        const contract = new ethers.Contract(MARKET_ADDRESS, abi, provider);

        // Fetch ALL markets' on-chain data in PARALLEL for instant loading
        const markets = await Promise.all(
            result.rows.map(async (row) => {
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
                        outcomeCount: Number(basicInfo[3]),
                        endTime: Number(basicInfo[4]),
                        liquidityParam: basicInfo[5].toString(),
                        resolved: basicInfo[6],
                        winningOutcome: Number(basicInfo[7])
                    };
                } catch (err) {
                    console.error(`Failed to fetch on-chain data for market ${row.market_id}:`, err);
                    onChainData = { outcomes: ['Yes', 'No'], prices: [50, 50] };
                }

                return {
                    market_id: row.market_id,
                    question: row.question,
                    description: row.description || '',
                    image_url: row.image || '',
                    category_id: row.category || '',
                    creator_address: row.creator_address || '',
                    is_boosted: row.is_boosted || false,
                    boost_expires_at: row.boost_expires_at ? Number(row.boost_expires_at) : 0,
                    creator_fee: 2, // V3 Constant
                    ...onChainData
                };
            })
        );

        // Store in cache
        marketCache.all = { data: markets, timestamp: Date.now() };
        console.log('✅ Markets cached for 30 seconds');

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
            const { CONFIG } = require('../config/contracts');
            const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
            const MARKET_ADDRESS = CONFIG.MARKET_CONTRACT;
            console.log(`[Market ${marketId}] Fetching from contract: ${MARKET_ADDRESS}`);
            console.log(`[Market ${marketId}] RPC URL: ${process.env.BNB_RPC_URL}`);

            const abi = [
                'function getPrice(uint256) view returns (uint256)',
                'function markets(uint256) view returns (string, uint256, uint256, uint256, uint256, bool, bool, uint256)'
            ];
            const contract = new ethers.Contract(MARKET_ADDRESS, abi, provider);

            console.log(`[Market ${marketId}] Calling contract methods...`);

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
                prices: prices.map((p: bigint) => Number(p) / 100),
                outcomeCount: Number(basicInfo[3]),
                endTime: Number(basicInfo[4]),
                liquidityParam: basicInfo[5].toString(),
                resolved: basicInfo[6],
                winningOutcome: Number(basicInfo[7])
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
            creator_address: row.creator_address || '',
            is_boosted: row.is_boosted || false,
            boost_expires_at: row.boost_expires_at ? Number(row.boost_expires_at) : 0,
            creator_fee: 2, // V3 Constant
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

export const deleteCategory = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        if (!id) return res.status(400).json({ success: false, message: 'Category ID is required' });

        await query('delete from categories where id = $1', [id]);
        res.json({ success: true, message: 'Category deleted' });
    } catch (error) {
        console.error('Delete Category Error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};
