import express from 'express';
import { ethers } from 'ethers';
import { query } from '../config/database';
import { CONFIG } from '../config/contracts';
import { MARKET_ABI } from '../config/abis';
import { getProvider } from '../config/provider';

const router = express.Router();

// Middleware to check admin secret
const checkAdminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const adminSecret = req.headers['x-admin-secret'];
    const VALID_SECRET = process.env.ADMIN_SECRET || 'admin123';

    if (adminSecret !== VALID_SECRET) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Admin Secret' });
    }
    next();
};

router.post('/resolve-market', checkAdminAuth, async (req, res) => {
    try {
        const { marketId, outcomeIndex } = req.body;

        if (marketId === undefined || outcomeIndex === undefined) {
            return res.status(400).json({ success: false, error: 'Missing marketId or outcomeIndex' });
        }

        console.log(`[Admin] Resolving Market ID ${marketId} with Outcome Index ${outcomeIndex}`);

        // Setup Provider & Signer
        const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org';
        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) throw new Error('Server wallet not configured');

        const chainId = Number(process.env.CHAIN_ID) || 56;
        const provider = new ethers.JsonRpcProvider(rpcUrl, chainId);
        const signer = new ethers.Wallet(privateKey, provider);

        // Get Contract
        const MARKET_ADDR = process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MARKET_CONTRACT || process.env.MULTI_MARKET_ADDRESS;
        if (!MARKET_ADDR) throw new Error('Market contract address not configured');

        const marketABI = [
            'function resolveMarket(uint256 _marketId, uint256 _outcomeIndex) external',
            'function markets(uint256) view returns (string, string[], uint256[], uint256, uint256, uint256, bool, uint256, uint256)'
        ];

        const contract = new ethers.Contract(MARKET_ADDR, marketABI, signer);

        // Call resolveMarket
        const tx = await contract.resolveMarket(marketId, outcomeIndex);
        console.log(`[Admin] Resolution TX Sent: ${tx.hash}`);

        const receipt = await tx.wait();
        console.log(`[Admin] Resolution Confirmed: ${receipt.hash}`);

        return res.json({
            success: true,
            transactionHash: receipt.hash,
            marketId,
            resolvedOutcome: outcomeIndex
        });

    } catch (error: any) {
        console.error('[Admin] Resolution Error:', error);
        return res.status(500).json({ success: false, error: error.message || 'Resolution failed' });
    }
});

// GET /markets - List ALL markets (including deleted ones) for Admin
router.get('/markets', checkAdminAuth, async (req, res) => {
    try {
        console.log(`[Admin API] Fetching markets from DB (source of truth)...`);

        // 1. Fetch ALL markets from DATABASE (source of truth)
        const dbResult = await query('SELECT * FROM markets ORDER BY market_id DESC');
        const dbCount = dbResult.rows.length;

        console.log(`[Admin API] Found ${dbCount} markets in database`);

        if (dbCount === 0) {
            return res.json({
                success: true,
                markets: [],
                dbCount: 0,
                dbError: null
            });
        }

        // 2. Enrich with on-chain data where available
        const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-rpc.publicnode.com';
        const chainId = Number(process.env.CHAIN_ID) || 56;
        const provider = new ethers.JsonRpcProvider(rpcUrl, chainId);

        const MARKET_ADDR = process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MARKET_ADDRESS || process.env.MARKET_CONTRACT;
        console.log('👮 [ADMIN API] Using contract address:', MARKET_ADDR);

        if (!MARKET_ADDR) throw new Error("Missing MARKET_ADDRESS env var");

        const marketABI = [
            'function getMarketBasicInfo(uint256) view returns (string question, string image, string description, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome)',
            'function getMarketOutcomes(uint256) view returns (string[])',
            'function getAllPrices(uint256) view returns (uint256[])'
        ];

        const marketContract = new ethers.Contract(MARKET_ADDR, marketABI, provider);

        // 3. Process each DB market and try to enrich with on-chain data
        const markets: any[] = [];
        let onChainSuccessCount = 0;
        let onChainFailCount = 0;

        // Process in batches to avoid rate limits
        const BATCH_SIZE = 5;
        const rows = dbResult.rows;

        for (let i = 0; i < rows.length; i += BATCH_SIZE) {
            const batchRows = rows.slice(i, i + BATCH_SIZE);
            const batchPromises = batchRows.map(async (dbMarket: any) => {
                const marketId = Number(dbMarket.market_id);

                try {
                    // Try to fetch on-chain data
                    const [basicInfo, outcomes, prices] = await Promise.all([
                        marketContract.getMarketBasicInfo(marketId),
                        marketContract.getMarketOutcomes(marketId),
                        marketContract.getAllPrices(marketId)
                    ]);

                    onChainSuccessCount++;

                    return {
                        market_id: marketId,
                        question: dbMarket.question || basicInfo.question,
                        description: dbMarket.description || '',
                        image: dbMarket.image || '',
                        category: dbMarket.category || '',
                        outcomes: outcomes,
                        prices: prices.map((p: bigint) => Number(p) / 100),
                        endTime: Number(basicInfo.endTime),
                        resolved: basicInfo.resolved,
                        winningOutcome: Number(basicInfo.winningOutcome),
                        isHidden: false,
                        volume: dbMarket.volume || '0',
                        status: dbMarket.resolved ? 'RESOLVED' : (Date.now() / 1000 > Number(basicInfo.endTime) ? 'ENDED' : 'ACTIVE')
                    };
                } catch (error: any) {
                    onChainFailCount++;
                    console.log(`[Admin API] ⚠️ Market #${marketId} exists in DB but not on-chain: ${error.message}`);

                    // Fallback to DB data
                    let prices = [50, 50];
                    try {
                        if (dbMarket.prices) {
                            if (Array.isArray(dbMarket.prices)) prices = dbMarket.prices;
                            else prices = JSON.parse(dbMarket.prices);
                        }
                    } catch (e) { }

                    let outcomes = ["YES", "NO"];
                    if (dbMarket.outcome_names) {
                        if (Array.isArray(dbMarket.outcome_names)) outcomes = dbMarket.outcome_names;
                        else {
                            try { outcomes = JSON.parse(dbMarket.outcome_names); }
                            catch (e) { outcomes = String(dbMarket.outcome_names).split(',').map(s => s.trim()); }
                        }
                    }

                    return {
                        market_id: marketId,
                        question: dbMarket.question || 'Unknown Market',
                        description: dbMarket.description || '',
                        image: dbMarket.image || '',
                        category: dbMarket.category || '',
                        outcomes: outcomes,
                        prices: prices,
                        endTime: dbMarket.end_time ? Math.floor(new Date(dbMarket.end_time).getTime() / 1000) : 0,
                        resolved: dbMarket.resolved || false,
                        winningOutcome: dbMarket.winning_outcome || 0,
                        isHidden: true, // Mark as hidden/error since not on-chain
                        volume: dbMarket.volume || '0',
                        status: 'DELETED'
                    };
                }
            });

            const batchResults = await Promise.all(batchPromises);
            markets.push(...batchResults);

            // Small delay between batches
            if (i + BATCH_SIZE < rows.length) await new Promise(r => setTimeout(r, 100));
        }

        console.log(`[Admin API] 📊 Enrichment: ${onChainSuccessCount} on-chain, ${onChainFailCount} DB-only out of ${dbCount} total`);

        return res.json({
            success: true,
            markets,
            dbCount,
            dbError: null,
            fetchStats: {
                total: dbCount,
                onChain: onChainSuccessCount,
                dbOnly: onChainFailCount
            }
        });

    } catch (error: any) {
        console.error('[Admin] Get Markets Error:', error);
        return res.status(500).json({
            success: false,
            error: error.message,
            dbError: error.message
        });
    }
});

router.post('/delete-market', checkAdminAuth, async (req, res) => {
    try {
        const { marketId } = req.body;

        if (marketId === undefined) {
            return res.status(400).json({ success: false, error: 'Missing marketId' });
        }

        console.log(`[Admin] Deleting Market ID ${marketId}`);

        // Delete from DB
        // Note: This only removes it from the off-chain database logic.
        // It does NOT remove it from the blockchain (blockchains are immutable).
        // It just hides it from the UI.
        const result = await query('DELETE FROM markets WHERE market_id = $1', [marketId]);

        if (result.rowCount === 0) {
            return res.status(404).json({ success: false, error: 'Market not found in database' });
        }

        console.log(`[Admin] Market ${marketId} deleted from DB`);

        // Invalidate public API cache immediately
        // @ts-ignore
        if (global.marketsCache) {
            // @ts-ignore
            global.marketsCache = null;
            console.log('[Admin] Invalidated markets cache');
        }

        return res.json({
            success: true,
            marketId,
            message: 'Market deleted from database'
        });

    } catch (error: any) {
        console.error('[Admin] Delete Error:', error);
        return res.status(500).json({ success: false, error: error.message || 'Delete failed' });
    }
});

// Sync/Repair Markets - Import missing chain markets into DB
router.post('/sync-markets', checkAdminAuth, async (req, res) => {
    try {
        console.log('[Admin] Starting Market Sync (via Indexer Service)...');

        // Use the centralized market indexer service
        const { syncAllMarkets } = await import('../services/marketIndexer');
        await syncAllMarkets();

        // Invalidate cache
        // @ts-ignore
        if (global.marketsCache) global.marketsCache = null;

        return res.json({
            success: true,
            message: `Full market sync completed successfully`
        });

    } catch (error: any) {
        console.error('[Admin] Sync Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// GET /stats - Dashboard Statistics
router.get('/stats', checkAdminAuth, async (req, res) => {
    try {
        // 1. Get Market Stats
        // Active markets: not resolved and end_time > now
        const activeMarketsRes = await query(`
            SELECT COUNT(*) FROM markets 
            WHERE resolved = FALSE 
            AND (end_time IS NULL OR end_time > NOW())
        `);

        // Expiring soon: ending in next 7 days
        const expiringRes = await query(`
            SELECT COUNT(*) FROM markets 
            WHERE resolved = FALSE 
            AND end_time > NOW() 
            AND end_time < NOW() + INTERVAL '7 days'
        `);

        // 2. Get User Stats
        const webUsersRes = await query('SELECT COUNT(*) FROM users');
        const waUsersRes = await query('SELECT COUNT(*) FROM whatsapp_users');
        const tgUsersRes = await query('SELECT COUNT(*) FROM telegram_users');

        const totalUsers =
            parseInt(webUsersRes.rows[0].count) +
            parseInt(waUsersRes.rows[0].count) +
            parseInt(tgUsersRes.rows[0].count);

        // New users (last 24h)
        const newWebRes = await query("SELECT COUNT(*) FROM users WHERE created_at > NOW() - INTERVAL '24 hours'");
        const newWaRes = await query("SELECT COUNT(*) FROM whatsapp_users WHERE created_at > NOW() - INTERVAL '24 hours'");
        const newTgRes = await query("SELECT COUNT(*) FROM telegram_users WHERE created_at > NOW() - INTERVAL '24 hours'");

        const newUsers =
            parseInt(newWebRes.rows[0].count) +
            parseInt(newWaRes.rows[0].count) +
            parseInt(newTgRes.rows[0].count);

        // 3. Calculate Total Volume (Sum from DB)
        // volume in DB is stored as formatted string (e.g. "123.45")
        // We handle nulls and empty strings
        const volumeRes = await query(`
            SELECT SUM(CAST(NULLIF(volume, '') AS NUMERIC)) as total_volume 
            FROM markets
        `);
        const totalVolumeNum = volumeRes.rows[0].total_volume || 0;

        // Format with commas and 2 decimals
        const totalVolume = new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2
        }).format(totalVolumeNum);


        // 4. Calculate Total Liquidity (USDC Balance of Market Contract)
        let totalLiquidity = "$0.00";
        try {
            const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org';
            const chainId = Number(process.env.CHAIN_ID) || 56;
            const provider = new ethers.JsonRpcProvider(rpcUrl, chainId);

            const MARKET_ADDR = process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MARKET_CONTRACT || process.env.MULTI_MARKET_ADDRESS;
            const USDC_ADDR = process.env.NEXT_PUBLIC_USDC_CONTRACT || process.env.USDC_CONTRACT;

            if (MARKET_ADDR && USDC_ADDR) {
                const erc20ABI = [
                    "function balanceOf(address) view returns (uint256)",
                    "function decimals() view returns (uint8)"
                ];
                const usdcContract = new ethers.Contract(USDC_ADDR, erc20ABI, provider);

                const [balanceWei, decimals] = await Promise.all([
                    usdcContract.balanceOf(MARKET_ADDR),
                    usdcContract.decimals()
                ]);

                // Format using dynamic decimals
                const balanceNum = parseFloat(ethers.formatUnits(balanceWei, decimals));

                totalLiquidity = new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: 'USD',
                    minimumFractionDigits: 2
                }).format(balanceNum);
            } else {
                console.warn("[Admin Stats] Missing MARKET_ADDR or USDC_ADDR for liquidity check");
            }
        } catch (err: any) {
            console.error("[Admin Stats] Failed to fetch liquidity:", err.message);
            // Keep default $0.00 on error
        }

        return res.json({
            success: true,
            stats: {
                totalLiquidity: totalLiquidity,
                totalVolume: totalVolume,
                activeMarkets: Number(activeMarketsRes.rows[0].count),
                totalUsers: totalUsers,
                volumeTrend: "Stable", // You could calculate this by comparing to yesterday if needed
                liquidityTrend: "Stable",
                expiringMarkets: Number(expiringRes.rows[0].count),
                newUsersToday: newUsers
            }
        });

    } catch (error: any) {
        console.error('[Admin] Stats Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// GET /users - List all users with balances
router.get('/users', checkAdminAuth, async (req, res) => {
    try {
        // 1. Fetch from DB (WhatsApp + Telegram + Web)
        const waResult = await query('SELECT * FROM whatsapp_users ORDER BY created_at DESC');
        const tgResult = await query('SELECT * FROM telegram_users ORDER BY created_at DESC');
        const webResult = await query('SELECT * FROM users ORDER BY created_at DESC');

        // Normalize Users
        const waUsers = waResult.rows.map((u: any) => ({
            ...u,
            source: 'whatsapp',
            display_name: u.phone_number,
            id_val: u.phone_number
        }));

        const tgUsers = tgResult.rows.map((u: any) => ({
            ...u,
            source: 'telegram',
            display_name: u.username ? `@${u.username}` : `TG:${u.telegram_id}`,
            id_val: u.telegram_id
        }));

        const webUsers = webResult.rows.map((u: any) => ({
            ...u,
            source: 'web',
            display_name: u.display_name || u.wallet_address?.substring(0, 8) || 'Web User',
            id_val: u.wallet_address
        }));

        const allUsers = [...waUsers, ...tgUsers, ...webUsers];

        // 2. Fetch on-chain balances
        const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org';
        const chainId = Number(process.env.CHAIN_ID) || 56;
        const provider = new ethers.JsonRpcProvider(rpcUrl, chainId);
        const MARKET_ADDR = process.env.NEXT_PUBLIC_MARKET_ADDRESS || process.env.MARKET_CONTRACT || process.env.MULTI_MARKET_ADDRESS;

        if (MARKET_ADDR) {
            const marketABI = ['function userBalances(address) view returns (uint256)'];
            const contract = new ethers.Contract(MARKET_ADDR, marketABI, provider);

            // Enhance users with balance (parallel)
            const enhancedUsers = await Promise.all(allUsers.map(async (u: any) => {
                try {
                    const balWei = await contract.userBalances(u.wallet_address);
                    const bal = ethers.formatUnits(balWei, 6);
                    return { ...u, balance: parseFloat(bal) };
                } catch (e) {
                    return { ...u, balance: 0, error: 'Failed to fetch balance' };
                }
            }));

            return res.json({ success: true, users: enhancedUsers });
        }

        return res.json({ success: true, users: allUsers });
    } catch (error: any) {
        console.error('[Admin] Get Users Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// GET /health - System Health Check
router.get('/health', checkAdminAuth, async (req, res) => {
    try {
        const rpcUrl = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org';
        const chainId = Number(process.env.CHAIN_ID) || 56;
        let provider;

        // 1. Check RPC
        let rpcStatus = 'UNKNOWN';
        let blockNumber = 0;
        let rpcError = null;
        try {
            provider = new ethers.JsonRpcProvider(rpcUrl, chainId);
            blockNumber = await provider.getBlockNumber();
            rpcStatus = 'OK';
        } catch (e: any) {
            rpcStatus = 'ERROR';
            rpcError = e.message;
            console.error('Health Check RPC Error:', e);
        }

        // 2. Check Relayer Wallet
        const privateKey = process.env.PRIVATE_KEY;
        let walletStatus: any = { address: '', bnb: '0', usdc: '0', status: 'UNKNOWN' };

        if (privateKey && provider && rpcStatus === 'OK') {
            try {
                const wallet = new ethers.Wallet(privateKey, provider);
                const bnbBal = await provider.getBalance(wallet.address);

                // USDC check
                let usdcBal = BigInt(0);
                const USDC_ADDR = process.env.USDC_CONTRACT;
                if (USDC_ADDR) {
                    try {
                        const erc20ABI = ['function balanceOf(address) view returns (uint256)'];
                        const usdc = new ethers.Contract(USDC_ADDR, erc20ABI, provider);
                        usdcBal = await usdc.balanceOf(wallet.address);
                    } catch (e) {
                        console.error('USDC fetch failed', e);
                        walletStatus.usdcError = 'Contract call failed';
                    }
                }

                walletStatus = {
                    address: wallet.address,
                    bnb: ethers.formatEther(bnbBal),
                    usdc: ethers.formatUnits(usdcBal, 6),
                    status: 'OK'
                };
            } catch (e: any) {
                walletStatus.status = 'ERROR';
                walletStatus.error = e.message;
            }
        } else {
            walletStatus.status = 'SKIPPED_OR_NO_KEY';
        }

        // 3. Check DB
        let dbStatus = 'UNKNOWN';
        let dbError = null;
        try {
            await query('SELECT 1');
            dbStatus = 'OK';
        } catch (e: any) {
            dbStatus = 'ERROR';
            dbError = e.message;
        }

        return res.json({
            success: true,
            health: {
                rpc: rpcStatus,
                rpcError,
                blockNumber,
                database: dbStatus,
                dbError,
                wallet: walletStatus,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error: any) {
        console.error('Critical Health Check Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
});

// Debug route to check contract state directly
router.get('/debug-market/:id', checkAdminAuth, async (req: express.Request, res: express.Response) => {
    try {
        const marketId = req.params.id;
        console.log(`[Debug] Checking market ${marketId}...`);

        const provider = getProvider();
        const marketContract = new ethers.Contract(CONFIG.MARKET_CONTRACT, MARKET_ABI, provider);

        const [basic, outcomes, prices, shares] = await Promise.all([
            marketContract.getMarketBasicInfo(marketId),
            marketContract.getMarketOutcomes(marketId),
            marketContract.getAllPrices(marketId),
            marketContract.getMarketShares(marketId)
        ]);

        const data = {
            id: marketId,
            question: basic.question,
            liquidityParam: basic.liquidityParam.toString(),
            outcomes: outcomes,
            pricesRaw: prices.map((p: bigint) => p.toString()),
            pricesFormatted: prices.map((p: bigint) => ethers.formatUnits(p, 18)),
            sharesRaw: shares.map((s: bigint) => s.toString()),
            sharesFormatted: shares.map((s: bigint) => ethers.formatUnits(s, 18))
        };

        res.json({ success: true, data });
    } catch (error: any) {
        console.error(`[Debug] Failed:`, error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Backfill Volume Data
router.post('/backfill-volume', checkAdminAuth, async (req, res) => {
    try {
        console.log('[Admin] Starting volume backfill...');

        const provider = getProvider();
        const marketContract = new ethers.Contract(CONFIG.MARKET_CONTRACT, MARKET_ABI, provider);

        const marketCount = Number(await marketContract.marketCount());
        const currentBlock = await provider.getBlockNumber();

        // Scan back 580k blocks (~20 days on BSC)
        const startBlock = Math.max(0, currentBlock - 580000);

        console.log(`[Admin] Scanning ${marketCount} markets from block ${startBlock} to ${currentBlock}`);

        const CHUNK_SIZE = 5000;
        const volumes = new Map<number, bigint>();

        // Initialize all markets to 0
        for (let i = 0; i < marketCount; i++) {
            volumes.set(i, BigInt(0));
        }

        let totalTrades = 0;

        // Scan blockchain in chunks
        for (let from = startBlock; from <= currentBlock; from += CHUNK_SIZE) {
            const to = Math.min(from + CHUNK_SIZE - 1, currentBlock);

            try {
                const filter = marketContract.filters.SharesPurchased();
                const logs = await marketContract.queryFilter(filter, from, to);

                totalTrades += logs.length;

                for (const log of logs) {
                    // @ts-ignore
                    const marketId = Number(log.args[0]);
                    // @ts-ignore
                    const cost = BigInt(log.args[4]);

                    const currentVol = volumes.get(marketId) || BigInt(0);
                    volumes.set(marketId, currentVol + cost);
                }
            } catch (e: any) {
                console.error(`[Admin] Chunk error ${from}-${to}:`, e.message);
            }
        }

        console.log(`[Admin] Found ${totalTrades} total trades`);

        // Update database
        const results: any[] = [];
        for (let marketId = 0; marketId < marketCount; marketId++) {
            const volume = volumes.get(marketId) || BigInt(0);
            const volumeFormatted = ethers.formatUnits(volume, 18);

            if (volume > 0n) {
                await query(
                    `UPDATE markets SET volume = $1 WHERE market_id = $2`,
                    [volumeFormatted, marketId]
                );
                results.push({ marketId, volume: volumeFormatted });
                console.log(`[Admin] Market ${marketId}: $${volumeFormatted}`);
            }
        }

        res.json({
            success: true,
            blocksScanned: currentBlock - startBlock,
            totalTrades,
            marketsUpdated: results
        });
    } catch (error: any) {
        console.error('[Admin] Backfill failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// Check volume in database
router.get('/check-volume/:marketId', checkAdminAuth, async (req, res) => {
    try {
        const marketId = parseInt(req.params.marketId);
        const result = await query(
            'SELECT market_id, liquidity_param, volume FROM markets WHERE market_id = $1',
            [marketId]
        );

        if (result.rows.length === 0) {
            return res.json({ success: false, error: 'Market not found' });
        }

        res.json({ success: true, data: result.rows[0] });
    } catch (error: any) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// Set volume directly
router.post('/set-volume', checkAdminAuth, async (req, res) => {
    try {
        const { marketId, volume } = req.body;

        if (marketId === undefined || volume === undefined) {
            return res.status(400).json({ success: false, error: 'Missing marketId or volume' });
        }

        console.log(`[Admin] Setting Market ${marketId} volume to ${volume}`);

        const result = await query(
            `UPDATE markets SET volume = $1 WHERE market_id = $2 RETURNING market_id, volume`,
            [volume.toString(), marketId]
        );

        if (result.rows.length === 0) {
            return res.json({ success: false, error: 'Market not found or update failed' });
        }

        console.log(`[Admin] ✅ Updated:`, result.rows[0]);
        res.json({ success: true, data: result.rows[0] });
    } catch (error: any) {
        console.error('[Admin] Set volume failed:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
