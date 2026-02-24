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

export const getMarketPriceHistory = async (req: Request, res: Response) => {
    try {
        const { marketId } = req.params;
        const interval = (req.query.interval as string) || '1h'; // 1h, 1d, all

        // Map interval to bucket size
        const bucketMap: Record<string, string> = {
            '1h': '5 minutes',
            '1d': '1 hour',
            'all': '6 hours',
        };
        const bucket = bucketMap[interval] || '1 hour';

        // Query price_history table — stores real on-chain getAllPrices() values (basis points)
        // This is the correct source for LMSR price history (not cost/shares approximation)
        const truncUnit = bucket === '5 minutes' ? 'minute' : bucket === '1 hour' ? 'hour' : 'day';
        const result = await query(`
            SELECT
                date_trunc($2, recorded_at) AS time_bucket,
                AVG(price) / 100.0 AS yes_price
            FROM price_history
            WHERE market_id = $1
            GROUP BY time_bucket
            ORDER BY time_bucket ASC
        `, [marketId, truncUnit]);

        // If no price_history yet, fall back to current market price
        if (result.rows.length === 0) {
            const marketResult = await query('SELECT prices FROM markets WHERE market_id = $1', [marketId]);
            if (marketResult.rows.length > 0) {
                let prices = marketResult.rows[0].prices;
                if (typeof prices === 'string') { try { prices = JSON.parse(prices); } catch (e) { prices = [50, 50]; } }
                const currentYesPrice = Array.isArray(prices) ? (prices[0] || 50) / 100 : 0.5;
                return res.json({
                    success: true,
                    history: [{ time: new Date().toISOString(), prob: currentYesPrice }]
                });
            }
            return res.json({ success: true, history: [] });
        }

        // Format as { time, prob } for frontend chart
        const history = result.rows.map((row: any) => ({
            time: row.time_bucket,
            prob: Math.min(Math.max(parseFloat(row.yes_price) || 0.5, 0.01), 0.99)
        }));

        // Append current price as final data point
        const marketResult = await query('SELECT prices FROM markets WHERE market_id = $1', [marketId]);
        if (marketResult.rows.length > 0) {
            let prices = marketResult.rows[0].prices;
            if (typeof prices === 'string') { try { prices = JSON.parse(prices); } catch (e) { prices = [50, 50]; } }
            const currentYesPrice = Array.isArray(prices) ? (prices[0] || 50) / 100 : 0.5;
            history.push({ time: new Date().toISOString(), prob: currentYesPrice });
        }

        res.json({ success: true, history });
    } catch (error) {
        console.error('Get Price History Error:', error);
        res.status(500).json({ success: false, message: 'Server error', history: [] });
    }
};

export const getUserPortfolio = async (req: Request, res: Response) => {
    try {
        const { address } = req.params;
        if (!address) return res.status(400).json({ success: false, message: 'Address required' });

        // Get all markets the user has traded in, with their share balances
        // Group by market + outcome to sum shares, and join market info
        const result = await query(`
            SELECT
                t.market_id,
                t.outcome_index,
                SUM(CAST(t.shares AS NUMERIC)) AS total_shares,
                SUM(CAST(t.total_cost AS NUMERIC)) AS total_cost,
                m.question,
                m.outcome_names,
                m.prices,
                m.resolved,
                m.winning_outcome
            FROM trades t
            LEFT JOIN markets m ON t.market_id = m.market_id
            WHERE LOWER(t.user_address) = LOWER($1)
              AND CAST(t.shares AS NUMERIC) > 0
            GROUP BY t.market_id, t.outcome_index, m.question, m.outcome_names, m.prices, m.resolved, m.winning_outcome
            ORDER BY t.market_id ASC
        `, [address]);

        // Group by market_id
        const marketMap: Record<number, any> = {};
        for (const row of result.rows) {
            const mid = Number(row.market_id);
            if (!marketMap[mid]) {
                let prices: number[] = [50, 50];
                let outcomeNames: string[] = ['YES', 'NO'];
                try { prices = typeof row.prices === 'string' ? JSON.parse(row.prices) : row.prices || [50, 50]; } catch { }
                try { outcomeNames = typeof row.outcome_names === 'string' ? JSON.parse(row.outcome_names) : row.outcome_names || ['YES', 'NO']; } catch { }

                marketMap[mid] = {
                    marketId: mid,
                    question: row.question || `Market ${mid}`,
                    prices,
                    outcomeNames,
                    resolved: row.resolved || false,
                    winningOutcome: row.winning_outcome !== null ? Number(row.winning_outcome) : null,
                    outcomes: {} // outcome_index -> { shares, totalCost }
                };
            }
            marketMap[mid].outcomes[Number(row.outcome_index)] = {
                shares: parseFloat(row.total_shares) || 0,
                totalCost: parseFloat(row.total_cost) || 0,
            };
        }

        // Build positions array
        const positions: any[] = [];
        for (const market of Object.values(marketMap)) {
            const prices: number[] = market.prices;
            for (const [outcomeIdx, data] of Object.entries(market.outcomes) as any) {
                const idx = Number(outcomeIdx);
                const shares = (data as any).shares;
                const totalCost = (data as any).totalCost;
                if (shares <= 0) continue;

                // Current price for this outcome (basis points -> decimal)
                const priceRaw = prices[idx] ?? 50;
                const currentPrice = priceRaw / 100;
                const avgPrice = shares > 0 ? totalCost / shares : currentPrice;

                const currentValue = shares * currentPrice;
                const pnl = currentValue - totalCost;

                const side = market.outcomeNames[idx] || (idx === 0 ? 'YES' : 'NO');
                const isWinner = market.resolved && market.winningOutcome === idx;

                positions.push({
                    marketId: market.marketId,
                    market: market.question,
                    side,
                    outcomeIndex: idx,
                    shares,
                    avgPrice,
                    currentPrice,
                    currentValue,
                    pnl,
                    pnlDisplay: pnl >= 0 ? `+$${pnl.toFixed(2)}` : `-$${Math.abs(pnl).toFixed(2)}`,
                    claimed: false, // default; overridden below for resolved markets
                    marketResolved: market.resolved,
                    isWinner,
                });
            }
        }

        // For resolved market positions, do a batch on-chain check for real claimed status
        const resolvedPositions = positions.filter((p: any) => p.marketResolved);
        if (resolvedPositions.length > 0) {
            try {
                const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-dataseed.binance.org/';
                const provider = new ethers.JsonRpcProvider(rpcUrl);
                const MARKET_ADDR = process.env.MARKET_CONTRACT || process.env.MULTI_MARKET_ADDRESS || process.env.NEXT_PUBLIC_MARKET_ADDRESS;
                if (MARKET_ADDR) {
                    const posABI = ['function getUserPosition(uint256 marketId, address user) view returns (uint256[] shares, bool claimed)'];
                    const marketContract = new ethers.Contract(MARKET_ADDR, posABI, provider);
                    // Group by marketId so we only call once per market per user
                    const checkedMarkets = new Set<number>();
                    await Promise.all(resolvedPositions.map(async (pos: any) => {
                        if (checkedMarkets.has(pos.marketId)) return;
                        checkedMarkets.add(pos.marketId);
                        try {
                            const result = await marketContract.getUserPosition(pos.marketId, address);
                            // Apply claimed to all positions in this market
                            positions
                                .filter((p: any) => p.marketId === pos.marketId)
                                .forEach((p: any) => { p.claimed = result.claimed; });
                        } catch { /* leave as false */ }
                    }));
                }
            } catch (e) {
                console.error('[Portfolio] On-chain claimed check failed, using default false:', e);
            }
        }

        res.json({ success: true, positions });
    } catch (error) {
        console.error('Get User Portfolio Error:', error);
        res.status(500).json({ success: false, message: 'Server error', positions: [] });
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
