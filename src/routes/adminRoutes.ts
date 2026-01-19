import express from 'express';
import { ethers } from 'ethers';
import { query } from '../config/database';

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
        const MARKET_ADDR = process.env.MARKET_CONTRACT || process.env.MULTI_MARKET_ADDRESS;
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
        const MARKET_ADDR = process.env.MARKET_CONTRACT || process.env.MULTI_MARKET_ADDRESS;

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
        const provider = new ethers.JsonRpcProvider(rpcUrl, chainId);
        const privateKey = process.env.PRIVATE_KEY;

        // 1. Check RPC
        const blockNumber = await provider.getBlockNumber();
        const rpcStatus = blockNumber > 0 ? 'OK' : 'ERROR';

        // 2. Check Relayer Wallet
        let walletStatus = { address: '', bnb: '0', usdc: '0' };
        if (privateKey) {
            const wallet = new ethers.Wallet(privateKey, provider);
            const bnbBal = await provider.getBalance(wallet.address);

            // USDC check
            let usdcBal = BigInt(0);
            const USDC_ADDR = process.env.USDC_CONTRACT;
            if (USDC_ADDR) {
                const erc20ABI = ['function balanceOf(address) view returns (uint256)'];
                const usdc = new ethers.Contract(USDC_ADDR, erc20ABI, provider);
                try {
                    usdcBal = await usdc.balanceOf(wallet.address);
                } catch (e) { console.error('USDC fetch failed', e); }
            }

            walletStatus = {
                address: wallet.address,
                bnb: ethers.formatEther(bnbBal),
                usdc: ethers.formatUnits(usdcBal, 6)
            };
        }

        // 3. Check DB
        let dbStatus = 'UNKNOWN';
        try {
            await query('SELECT 1');
            dbStatus = 'OK';
        } catch (e) { dbStatus = 'ERROR'; }

        return res.json({
            success: true,
            health: {
                rpc: rpcStatus,
                blockNumber,
                database: dbStatus,
                wallet: walletStatus,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error: any) {
        return res.status(500).json({ success: false, error: error.message });
    }
});

export default router;
