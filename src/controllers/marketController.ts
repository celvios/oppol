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

const CACHE_TTL_MS = 10000; // 10 seconds cache TTL (reduced from 5 minutes for debugging)

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

        console.log('🔄 Cache miss - fetching fresh market data from blockchain via Multicall3');
        const result = await query('select * from markets', []);

        const { CONFIG } = require('../config/contracts');
        const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL);
        const MARKET_ADDRESS = CONFIG.MARKET_CONTRACT;
        console.log('📄 [CLIENT API] Using contract address:', MARKET_ADDRESS);
        console.log('📄 [CLIENT API] RPC:', CONFIG.RPC_URL);

        // Multicall3 on BSC Mainnet
        const MULTICALL3_ADDRESS = '0xcA11bde05977b3631167028862bE2a173976CA11';
        const MULTICALL3_ABI = [
            'function aggregate3(tuple(address target, bool allowFailure, bytes callData)[] calls) view returns (tuple(bool success, bytes returnData)[] returnData)'
        ];

        const marketAbi = [
            'function getMarketOutcomes(uint256) view returns (string[])',
            'function getAllPrices(uint256) view returns (uint256[])',
            'function getMarketBasicInfo(uint256) view returns (string, string, string, uint256, uint256, uint256, bool, uint256)',
            'function getMarketShares(uint256) view returns (uint256[])'
        ];

        const marketInterface = new ethers.Interface(marketAbi);
        const multicall = new ethers.Contract(MULTICALL3_ADDRESS, MULTICALL3_ABI, provider);

        // Build multicall batch: 4 calls per market (outcomes, prices, basicInfo, shares)
        const calls: any[] = [];
        result.rows.forEach((row) => {
            const marketId = row.market_id;

            // Call 1: getMarketOutcomes
            calls.push({
                target: MARKET_ADDRESS,
                allowFailure: true,
                callData: marketInterface.encodeFunctionData('getMarketOutcomes', [marketId])
            });

            // Call 2: getAllPrices
            calls.push({
                target: MARKET_ADDRESS,
                allowFailure: true,
                callData: marketInterface.encodeFunctionData('getAllPrices', [marketId])
            });

            // Call 3: getMarketBasicInfo
            calls.push({
                target: MARKET_ADDRESS,
                allowFailure: true,
                callData: marketInterface.encodeFunctionData('getMarketBasicInfo', [marketId])
            });

            // Call 4: getMarketShares
            calls.push({
                target: MARKET_ADDRESS,
                allowFailure: true,
                callData: marketInterface.encodeFunctionData('getMarketShares', [marketId])
            });
        });

        console.log(`📞 Executing Multicall3 with ${calls.length} calls (${result.rows.length} markets)`);
        const startTime = Date.now();

        // Execute single multicall batch
        const responses = await multicall.aggregate3(calls);

        console.log(`✅ Multicall3 completed in ${Date.now() - startTime}ms`);

        // Decode responses and map to markets
        const markets = result.rows.map((row, index) => {
            const baseIndex = index * 4; // Each market has 4 calls

            const outcomesResponse = responses[baseIndex];
            const pricesResponse = responses[baseIndex + 1];
            const basicInfoResponse = responses[baseIndex + 2];
            const sharesResponse = responses[baseIndex + 3];

            let onChainData: any = {};

            try {
                // Decode outcomes
                const outcomes = outcomesResponse.success
                    ? marketInterface.decodeFunctionResult('getMarketOutcomes', outcomesResponse.returnData)[0]
                    : ['Yes', 'No'];

                // Decode prices - Contract returns basis points (10000 = 100%)
                const prices = pricesResponse.success
                    ? marketInterface.decodeFunctionResult('getAllPrices', pricesResponse.returnData)[0].map((p: bigint) => {
                        const basisPoints = Number(p);
                        // If prices are suspiciously low (< 1), contract might be returning bad data
                        if (basisPoints < 1 && basisPoints > 0) {
                            console.warn(`[Market ${row.market_id}] Suspiciously low price detected: ${basisPoints}`);
                            // Return equal distribution as fallback
                            return null;
                        }
                        // Convert from basis points to percentage (0-100)
                        return basisPoints / 100;
                    })
                    : (() => {
                        // Dynamic fallback
                        const count = outcomes.length; // outcomes derived above
                        const equalShare = 100 / count;
                        return Array(count).fill(equalShare);
                    })();

                // Check if any prices are null (bad data) and use fallback
                const hasBadData = prices.some((p: number | null) => p === null);
                const finalPrices = hasBadData ? Array(outcomes.length).fill(100 / outcomes.length) : prices;

                // Decode basic info
                const basicInfo = basicInfoResponse.success
                    ? marketInterface.decodeFunctionResult('getMarketBasicInfo', basicInfoResponse.returnData)
                    : [null, null, null, 2, Math.floor(Date.now() / 1000) + 86400, '0', false, 0];

                // Decode shares
                const shares = sharesResponse.success
                    ? marketInterface.decodeFunctionResult('getMarketShares', sharesResponse.returnData)[0]
                    : [];

                // Calculate total volume from shares (shares are in 6 decimals for USDC)
                let totalVolume = '0';
                if (shares.length > 0) {
                    const volumeSum = shares.reduce((sum: bigint, share: bigint) => sum + share, BigInt(0));
                    totalVolume = (Number(volumeSum) / 1e6).toFixed(2); // Convert from 6 decimals to readable
                }

                onChainData = {
                    outcomes: outcomes,
                    prices: finalPrices,
                    outcomeCount: Number(basicInfo[3]),
                    endTime: Number(basicInfo[4]),
                    liquidityParam: basicInfo[5].toString(),
                    resolved: basicInfo[6],
                    winningOutcome: Number(basicInfo[7]),
                    totalVolume: totalVolume
                };

                if (!outcomesResponse.success || !pricesResponse.success || !basicInfoResponse.success || !sharesResponse.success) {
                    console.warn(`[Market ${row.market_id}] Some multicall responses failed (outcomes: ${outcomesResponse.success}, prices: ${pricesResponse.success}, basicInfo: ${basicInfoResponse.success}, shares: ${sharesResponse.success})`);
                }
            } catch (err: any) {
                console.error(`[Market ${row.market_id}] Failed to decode multicall response:`, err.message);
                onChainData = {
                    outcomes: ['Yes', 'No'],
                    prices: [50, 50],
                    outcomeCount: 2,
                    endTime: Math.floor(Date.now() / 1000) + 86400,
                    liquidityParam: '0',
                    resolved: false,
                    winningOutcome: 0,
                    totalVolume: '0'
                };
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
        });

        // Filter out markets that are Resolved AND older than 48 hours (after endTime)
        const VISIBLE_WINDOW = 48 * 60 * 60; // 48 Hours in seconds
        const nowSec = Math.floor(Date.now() / 1000);

        const visibleMarkets = markets.filter((m: any) => {
            // Always show active markets (not resolved)
            if (!m.resolved) return true;

            // For resolved markets, check if they are within the retention window
            // We use endTime as the anchor since we don't track exact resolution time
            return (nowSec < (m.endTime + VISIBLE_WINDOW));
        });

        // Store in cache
        marketCache.all = { data: visibleMarkets, timestamp: Date.now() };
        console.log(`✅ Cached ${visibleMarkets.length} markets (${markets.length - visibleMarkets.length} hidden)`);

        res.json({ success: true, markets: visibleMarkets });
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
                'function markets(uint256) view returns (string, uint256, uint256, uint256, uint256, bool, bool, uint256)',
                'function getMarketShares(uint256) view returns (uint256[])'
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
                // Dynamic fallback based on outcome count
                const count = outcomes.length;
                const equalShare = Math.floor(10000 / count);
                prices = Array(count).fill(BigInt(equalShare));
            }

            let shares: bigint[] = [];
            try {
                shares = await contract.getMarketShares(marketId);
                console.log(`[Market ${marketId}] Shares success:`, shares.map((s: bigint) => s.toString()));
            } catch (e) {
                console.error(`[Market ${marketId}] getMarketShares failed:`, e);
                shares = Array(outcomes.length).fill(BigInt(0));
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
            console.log(`[Market ${marketId}] Raw shares:`, shares.map((s: bigint) => s.toString()));
            console.log(`[Market ${marketId}] Basic info:`, basicInfo);

            // Calculate total volume from shares
            const volumeSum = shares.reduce((sum: bigint, share: bigint) => sum + share, BigInt(0));
            const totalVolume = (Number(volumeSum) / 1e6).toFixed(2); // Convert from 6 decimals

            onChainData = {
                outcomes: outcomes,
                prices: prices.map((p: bigint) => Number(p) / 100),
                outcomeCount: Number(basicInfo[3]),
                endTime: Number(basicInfo[4]),
                liquidityParam: basicInfo[5].toString(),
                resolved: basicInfo[6],
                winningOutcome: Number(basicInfo[7]),
                totalVolume: totalVolume
            };

            console.log(`[Market ${marketId}] Processed prices:`, onChainData.prices);
        } catch (err: any) {
            // Suppress "missing revert data" noise for mismatched markets
            if (err.code !== 'CALL_EXCEPTION') {
                console.warn(`[Market ${marketId}] On-chain fetch failed:`, err.message);
            }
            // Fallback for outcomes if on-chain fails (default Yes/No)
            onChainData = {
                outcomes: ['Yes', 'No'],
                prices: [0.5, 0.5],
                outcomeCount: 2,
                endTime: Math.floor(Date.now() / 1000) + 86400, // +24h
                liquidityParam: '0',
                resolved: false,
                winningOutcome: 0,
                totalVolume: '0'
            };
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
