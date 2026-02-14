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
        // Fix: Client sends 'category', but we were looking for 'categoryId'
        const { marketId, question, description, imageUrl, categoryId, category, creatorAddress, outcome_names } = req.body;

        // Use provided category name (support both field names)
        const categoryName = category || categoryId || '';

        if (!marketId || !question) {
            return res.status(400).json({ success: false, message: 'Missing marketId or question' });
        }

        // 1. Ensure category exists in categories table
        if (categoryName) {
            await query('INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING', [categoryName]);
        }

        // 2. Insert market with correct category name
        await query(
            'insert into markets (market_id, question, description, image, category, creator_address, outcome_names) values ($1, $2, $3, $4, $5, $6, $7)',
            [
                marketId,
                question,
                description || '',
                imageUrl || '',
                categoryName,
                creatorAddress || '',
                outcome_names ? JSON.stringify(outcome_names) : null
            ]
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
            // console.log('📦 Returning cached markets data');
            return res.json({ success: true, markets: marketCache.all!.data });
        }

        // console.log('🔄 Fetching fresh market data from DB (Indexer Source of Truth)');
        const result = await query('select * from markets order by volume::numeric desc', []);

        // Process DB rows directly - NO Multicall!
        // The Indexer keeps the DB fresh, so we trust it.
        const markets = result.rows.map((row) => {
            // Parse JSON fields if they are strings
            let outcomes = row.outcome_names;
            if (typeof outcomes === 'string') {
                try { outcomes = JSON.parse(outcomes); } catch (e) { outcomes = ['Yes', 'No']; }
            }
            if (!outcomes) outcomes = ['Yes', 'No'];

            let prices = row.prices;
            if (typeof prices === 'string') {
                try { prices = JSON.parse(prices); } catch (e) { prices = [0.5, 0.5]; }
            }
            if (!prices) prices = [0.5, 0.5];

            // Normalize fields to match frontend expectations
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

                // On-chain data from DB
                outcomes: outcomes,
                prices: prices,
                outcomeCount: Number(row.outcome_count || 2),
                endTime: row.end_time ? Math.floor(new Date(row.end_time).getTime() / 1000) : Math.floor(Date.now() / 1000) + 86400,
                liquidityParam: row.liquidity_param || '0',
                resolved: row.resolved || false,
                winningOutcome: Number(row.winning_outcome || 0),
                totalVolume: row.volume || '0',
                created_at: row.created_at // Add timestamp for "New" filter
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

        // Store in cache (shorter TTL now that it's fast DB verify)
        marketCache.all = { data: visibleMarkets, timestamp: Date.now() };
        // console.log(`✅ Served ${visibleMarkets.length} markets from DB`);

        res.json({ success: true, markets: visibleMarkets });
    } catch (error) {
        console.error('Get All Metadata Error:', error);
        res.json({ success: true, markets: [] });
    }
};

export const getMarketMetadata = async (req: Request, res: Response) => {
    try {
        const { marketId } = req.params;

        // Check cache first
        if (marketCache.single.has(marketId)) {
            const entry = marketCache.single.get(marketId);
            if (isCacheValid(entry)) {
                // console.log(`[Market ${marketId}] Returning cached DB data`);
                return res.json({ success: true, market: entry!.data });
            }
        }

        const result = await query('select * from markets where market_id = $1', [marketId]);

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Market not found' });
        }

        const row = result.rows[0];

        // Parse JSON fields
        let outcomes = row.outcome_names;
        if (typeof outcomes === 'string') {
            try { outcomes = JSON.parse(outcomes); } catch (e) { outcomes = ['Yes', 'No']; }
        }
        if (!outcomes) outcomes = ['Yes', 'No'];

        let prices = row.prices;
        if (typeof prices === 'string') {
            try { prices = JSON.parse(prices); } catch (e) { prices = [0.5, 0.5]; }
        }
        if (!prices) prices = [0.5, 0.5];

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

            // Serve directly from DB (Indexer is Source of Truth)
            outcomes: outcomes,
            prices: prices,
            outcomeCount: Number(row.outcome_count || 2),
            endTime: row.end_time ? Math.floor(new Date(row.end_time).getTime() / 1000) : Math.floor(Date.now() / 1000) + 86400,
            liquidityParam: row.liquidity_param || '0',
            resolved: row.resolved || false,
            winningOutcome: Number(row.winning_outcome || 0),
            totalVolume: row.volume || '0'
        };

        // Cache the result
        marketCache.single.set(marketId, { data: market, timestamp: Date.now() });

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
