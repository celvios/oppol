import { Request, Response } from 'express';
import pool from '../config/database';
import { CustodialWalletService } from '../services/custodialWallet';
import { ethers } from 'ethers';
import { EncryptionService } from '../services/encryption';

// Use strict config
import { CONFIG } from '../config/contracts';

const MARKET_CONTRACT_ADDRESS = CONFIG.MARKET_CONTRACT;
const USDC_ADDRESS = CONFIG.USDC_CONTRACT;
const RPC_URL = CONFIG.RPC_URL;

// ABI for PredictionMarketMulti contract
const PREDICTION_MARKET_ABI = [
    'function buyShares(uint256 marketId, uint256 outcomeIndex, uint256 shares, uint256 maxCost) external',
    'function userBalances(address) view returns (uint256)',
    'function deposit(uint256 amount) external',
    'function withdraw(uint256 amount) external',
    'function calculateCost(uint256 marketId, uint256 outcomeIndex, uint256 shares) view returns (uint256)'
];

const USDC_ABI = [
    'function approve(address spender, uint256 amount) external returns (bool)',
    'function balanceOf(address account) external view returns (uint256)',
    'function transfer(address to, uint256 amount) external returns (bool)',
    'function allowance(address owner, address spender) external view returns (uint256)'
];

export class TelegramController {
    static async getOrCreateUser(req: Request, res: Response) {
        try {
            const { telegramId, username } = req.body;

            let result = await pool.query(
                'SELECT * FROM telegram_users WHERE telegram_id = $1',
                [telegramId]
            );

            if (result.rows.length === 0) {
                const wallet = await CustodialWalletService.createWallet(telegramId.toString());
                result = await pool.query(
                    'INSERT INTO telegram_users (telegram_id, username, wallet_address, encrypted_private_key) VALUES ($1, $2, $3, $4) RETURNING *',
                    [telegramId, username, wallet.address, wallet.encryptedPrivateKey]
                );
            }

            res.json({ success: true, user: result.rows[0] });
        } catch (error) {
            console.error('Get/Create user error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    static async placeBet(req: Request, res: Response) {
        try {
            const { telegramId, marketId, outcome, amount } = req.body;

            console.log('[Telegram Bet] Starting bet placement:', { telegramId, marketId, outcome, amount });

            if (parseFloat(amount) < 1) {
                return res.status(400).json({ success: false, message: 'Minimum bet is 1 USDC' });
            }

            let userResult = await pool.query(
                'SELECT * FROM telegram_users WHERE telegram_id = $1',
                [telegramId]
            );

            // Auto-create user if not found
            if (userResult.rows.length === 0) {
                console.log('[Telegram Bet] User not found, auto-creating...');
                try {
                    const wallet = await CustodialWalletService.createWallet(telegramId.toString());
                    userResult = await pool.query(
                        'INSERT INTO telegram_users (telegram_id, username, wallet_address, encrypted_private_key) VALUES ($1, $2, $3, $4) RETURNING *',
                        [telegramId, 'telegram_user', wallet.address, wallet.encryptedPrivateKey]
                    );
                } catch (createError: any) {
                    throw new Error('Failed to create user wallet');
                }
            }

            const user = userResult.rows[0];
            const provider = new ethers.JsonRpcProvider(RPC_URL);

            // Decrypt private key
            let privateKey: string;
            try {
                console.log(`[Telegram Bet] Attempting to decrypt key for user ${telegramId}`);
                privateKey = EncryptionService.decrypt(user.encrypted_private_key);
            } catch (decryptError: any) {
                console.error(`[Telegram Bet] Decryption failed for user ${telegramId}:`, decryptError.message);

                // Detailed diagnostic log
                const envKey = process.env.ENCRYPTION_KEY || 'DEFAULT';
                console.error(`[Telegram Bet] ENV Key Length: ${envKey.length}`);
                console.error(`[Telegram Bet] Data Length: ${user.encrypted_private_key?.length}`);

                throw new Error('Wallet decryption failed. Please contact support or try /start again to reset.');
            }

            const wallet = new ethers.Wallet(privateKey, provider);

            // Convert amount to wei (USDC 18 decimals)
            const amountInWei = ethers.parseUnits(amount.toString(), 18);

            // GASLESS IMPLEMENTATION
            const serverPrivateKey = process.env.PRIVATE_KEY;
            if (!serverPrivateKey) throw new Error('Server wallet not configured');
            const operatorWallet = new ethers.Wallet(serverPrivateKey, provider);

            // CHECK SERVER BNB (GAS)
            const operatorBalance = await provider.getBalance(operatorWallet.address);
            if (operatorBalance < ethers.parseEther('0.002')) {
                throw new Error('Server busy (Low Gas). Please try again later.');
            }

            // 1. Check Internal Contract Balance (Has user deposited?)
            const marketContractUser = new ethers.Contract(MARKET_CONTRACT_ADDRESS, PREDICTION_MARKET_ABI, wallet);
            const internalBalance = await marketContractUser.userBalances(wallet.address);
            console.log(`[Gasless Bet] Internal Balance: ${ethers.formatUnits(internalBalance, 18)} USDC`);

            const neededDeposit = amountInWei > internalBalance ? amountInWei - internalBalance : BigInt(0);

            if (neededDeposit > BigInt(0)) {
                console.log(`[Gasless Bet] Need to deposit: ${ethers.formatUnits(neededDeposit, 18)} USDC`);

                // Check User Wallet USDC
                const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, wallet);
                const userUsdcBalance = await usdcContract.balanceOf(wallet.address);
                if (userUsdcBalance < neededDeposit) {
                    const missing = ethers.formatUnits(neededDeposit - userUsdcBalance, 18);
                    throw new Error(`Insufficient funds. You need ${missing} more USDC.`);
                }

                // Check Allowance
                const allowance = await usdcContract.allowance(wallet.address, MARKET_CONTRACT_ADDRESS);
                if (allowance < neededDeposit) {
                    console.log(`[Gasless Bet] Insufficient allowance. Funding user for approve...`);
                    const userBalance = await provider.getBalance(wallet.address);
                    if (userBalance < ethers.parseEther('0.0005')) {
                        await CustodialWalletService.fundWallet(wallet.address, '0.0005', provider);
                    }
                    const approveTx = await usdcContract.approve(MARKET_CONTRACT_ADDRESS, ethers.MaxUint256);
                    await approveTx.wait();
                }

                // Execute Deposit
                console.log('[Telegram Bet] Executing deposit...');
                try {
                    const userBalanceForDeposit = await provider.getBalance(wallet.address);
                    if (userBalanceForDeposit < ethers.parseEther('0.0008')) {
                        console.log('[Telegram Bet] Funding user for gas...');
                        await CustodialWalletService.fundWallet(wallet.address, '0.001', provider);
                    }
                    const depositTx = await marketContractUser.deposit(neededDeposit);
                    await depositTx.wait();
                    console.log('[Telegram Bet] Deposit successful');
                } catch (depositError: any) {
                    console.error('[Telegram Bet] Deposit failed:', depositError);
                    throw new Error(`Deposit failed: ${depositError.message || 'Unknown error'}`);
                }
            }

            // 2. Server Executes Trade (buySharesFor)
            const marketContractOperator = new ethers.Contract(MARKET_CONTRACT_ADDRESS, [
                'function buySharesFor(address _user, uint256 _marketId, uint256 _outcomeIndex, uint256 _shares, uint256 _maxCost) external'
            ], operatorWallet);

            // Optimized Estimates to avoid RPC spam (Rate Limit Fix)
            // Assuming Price ~ 0.5 USDC initially.
            // Shares ~ Amount / 0.5 = Amount * 2
            // We'll trust the wrapper or just try to buy "Amount" worth of shares roughly.
            // Better approach: Calculate cost locally if data available, but we don't have LMSR state here easily.
            // We will do a coarse binary search with fewer steps.

            const maxCostInUnits = amountInWei;
            let low = BigInt(1);
            let high = ethers.parseUnits((parseFloat(amount) * 100).toString(), 18); // Max 100x variance (e.g. price 0.01)
            let bestShares = BigInt(0);

            // Reduce to max 8 iterations for speed/rate-limits
            const marketContractReader = new ethers.Contract(MARKET_CONTRACT_ADDRESS, PREDICTION_MARKET_ABI, provider);

            for (let i = 0; i < 8; i++) {
                const mid = (low + high) / BigInt(2);
                try {
                    const cost = await marketContractReader.calculateCost(marketId, outcome, mid);
                    if (cost <= maxCostInUnits) {
                        bestShares = mid;
                        low = mid + BigInt(1);
                    } else {
                        high = mid - BigInt(1);
                    }
                } catch (e) {
                    high = mid - BigInt(1);
                }
                // Small delay to be nice to RPC
                await new Promise(r => setTimeout(r, 50));
            }

            if (bestShares === BigInt(0)) {
                // If search failed, try a conservative fall back: 1:1 shares
                bestShares = ethers.parseUnits((parseFloat(amount) * 0.9).toString(), 18);
            }

            // FIXED: Limit cost must not exceed amountInWei (User's deposit)
            // If we want slippage, we must deposit more or checking balance first.
            // Here we treat amount as "Max Spend".
            const limitCost = maxCostInUnits;

            console.log(`[Gasless Bet] Buying ${ethers.formatUnits(bestShares, 18)} shares...`);
            const betTx = await marketContractOperator.buySharesFor(
                wallet.address,
                marketId,
                outcome,
                bestShares,
                limitCost
            );
            const receipt = await betTx.wait();
            console.log(`[Gasless Bet] Success! TX: ${receipt.hash}`);

            // Store transaction
            await pool.query(
                'INSERT INTO telegram_transactions (telegram_id, type, market_id, outcome, amount, shares, tx_hash, status) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)',
                [telegramId, 'BET', marketId, outcome, amount, ethers.formatUnits(bestShares, 18), receipt.hash, 'CONFIRMED']
            );

            res.json({
                success: true,
                message: 'Bet placed successfully',
                transactionHash: receipt.hash
            });
        } catch (error: any) {
            console.error('[Telegram Bet] CRITICAL ERROR:', error);
            console.error('[Telegram Bet] Stack:', error.stack);

            // Return specific 500 error structure if it's a server/rpc issue
            if (error.message.includes('RPC') || error.message.includes('network') || error.message.includes('connection')) {
                return res.status(503).json({ success: false, message: 'Blockchain network issue, please try again later.' });
            }


            // Try explicit decoding first
            const decodedError = TelegramController.decodeContractError(error);
            if (decodedError) {
                return res.status(400).json({ success: false, message: decodedError });
            }

            res.status(400).json({ success: false, message: error.message });
        }
    }

    private static decodeContractError(error: any): string | null {
        try {
            // 1. Extract error data
            let data = error.data || error.error?.data || error.payload?.data;
            if (!data && error.message) {
                // Try to find hex string in message
                const match = error.message.match(/0x[a-fA-F0-9]{8,}/);
                if (match) data = match[0];
            }

            if (!data || typeof data !== 'string') return null;

            // 2. Check Signatures
            const signatures = {
                '0xdb42144d': 'InsufficientBalance(address,uint256,uint256)',
                '0xe48960f0': 'MarketHasEnded(uint256)',
                '0xe450d38c': 'ERC20InsufficientBalance(address,uint256,uint256)', // ERC20 Standard
                '0x9811e0c7': 'ZeroShares()',
                '0x76c6c93a': 'NotOperator(address)',
                '0x3d0aa6bc': 'MarketAlreadyResolved(uint256)',
                '0xf0a78225': 'CostExceedsMax(uint256,uint256)'
            };

            for (const [sig, abiInfo] of Object.entries(signatures)) {
                if (data.includes(sig)) {
                    // Normalize data (remove selector if needed, or handle full string)
                    // Etherjs abi coder needs the data strictly.
                    // If data is embedded in a larger string, we might need to exact it.
                    // But usually ethers error includes the Revert data.

                    if (sig === '0xf0a78225') { // CostExceedsMax(uint256 cost, uint256 maxCost)
                        try {
                            const selectorIndex = data.indexOf(sig);
                            // Ensure 0x prefix
                            const rawData = '0x' + data.substring(selectorIndex + 10);

                            const abiCoder = new ethers.AbiCoder();
                            const decoded = abiCoder.decode(['uint256', 'uint256'], rawData);

                            const cost = ethers.formatUnits(decoded[0], 18);
                            const max = ethers.formatUnits(decoded[1], 18);

                            return `Slippage Error: Cost (${cost} USDC) exceeds max allowed (${max} USDC). Try increasing the limit or trying again later.`;
                        } catch (e) {
                            return "Cost exceeds max limit (Slippage)";
                        }
                    }

                    if (sig === '0xdb42144d') { // InsufficientBalance
                        try {
                            // Extract args: we need to Slice the selector (4 bytes = 10 chars usually 0x + 8 hex)
                            // But data might vary. Let's assume data starts with selector.
                            const selectorIndex = data.indexOf(sig);
                            const rawData = '0x' + data.substring(selectorIndex + 10);

                            const abiCoder = new ethers.AbiCoder();
                            const decoded = abiCoder.decode(['address', 'uint256', 'uint256'], rawData);

                            const required = ethers.formatUnits(decoded[1], 18);
                            const available = ethers.formatUnits(decoded[2], 18);
                            const missing = (parseFloat(required) - parseFloat(available)).toFixed(4);

                            return `Insufficient Balance. You have ${available} USDC but need ${required} USDC. Please deposit ${missing} more USDC.`;
                        } catch (e) {
                            return "Insufficient Balance (Error decoding details)";
                        }
                    }

                    if (sig === '0xe48960f0') return "Market has ended";
                    if (sig === '0x3d0aa6bc') return "Market already resolved";
                    if (sig === '0x9811e0c7') return "Cannot buy 0 shares";
                }
            }
        } catch (e) {
            console.error('Error decoding failed:', e);
        }
        return null; // Fallback to original message
    }

    static async getPositions(req: Request, res: Response) {
        try {
            const { telegramId } = req.params;

            const result = await pool.query(`
                SELECT 
                    t.market_id, 
                    t.outcome, 
                    SUM(t.shares) as total_shares, 
                    SUM(t.amount) as total_invested,
                    m.question,
                    m.outcome_names
                FROM telegram_transactions t
                LEFT JOIN markets m ON t.market_id = m.market_id
                WHERE t.telegram_id = $1 AND t.type = 'BET' AND t.status = 'CONFIRMED'
                GROUP BY t.market_id, t.outcome, m.question, m.outcome_names
            `, [telegramId]);

            const positions = result.rows.map(row => {
                let outcomeName = 'Unknown';
                // Handle outcome names (JSONB or array)
                const names = row.outcome_names;
                if (names && Array.isArray(names) && names[row.outcome]) {
                    outcomeName = names[row.outcome];
                } else {
                    outcomeName = row.outcome === 0 ? 'YES' : 'NO';
                }

                return {
                    marketId: row.market_id,
                    question: row.question || `Market ${row.market_id}`,
                    outcome: row.outcome,
                    outcomeName,
                    shares: parseFloat(row.total_shares || '0'),
                    totalInvested: parseFloat(row.total_invested || '0')
                };
            });

            res.json({ success: true, positions });
        } catch (error: any) {
            console.error('Get positions error:', error);
            res.status(500).json({ success: false, message: 'Server error' });
        }
    }

    static async getBalance(req: Request, res: Response) {
        try {
            const { telegramId } = req.params;

            const result = await pool.query(
                'SELECT wallet_address FROM telegram_users WHERE telegram_id = $1',
                [telegramId]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            const walletAddress = result.rows[0].wallet_address;
            const provider = new ethers.JsonRpcProvider(RPC_URL);

            // Checks for both Wallet USDC and Internal Contract Balance
            const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
            const marketContract = new ethers.Contract(MARKET_CONTRACT_ADDRESS, PREDICTION_MARKET_ABI, provider);

            const [walletBalance, contractBalance] = await Promise.all([
                usdcContract.balanceOf(walletAddress),
                marketContract.userBalances(walletAddress)
            ]);

            const totalBalance = walletBalance + contractBalance;
            const balanceFormatted = ethers.formatUnits(totalBalance, 18);

            res.json({
                success: true,
                balance: parseFloat(balanceFormatted),
                details: {
                    wallet: ethers.formatUnits(walletBalance, 18),
                    deposited: ethers.formatUnits(contractBalance, 18)
                }
            });
        } catch (error: any) {
            console.error('Get balance error:', error);
            res.status(500).json({ success: false, message: error.message || 'Server error' });
        }
    }

    static async withdraw(req: Request, res: Response) {
        try {
            const { telegramId, toAddress, amount } = req.body;
            console.log(`[Telegram Withdraw] Request: ${amount} USDC to ${toAddress}`);

            const userResult = await pool.query(
                'SELECT * FROM telegram_users WHERE telegram_id = $1',
                [telegramId]
            );

            if (userResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            const user = userResult.rows[0];
            const provider = new ethers.JsonRpcProvider(RPC_URL);

            let privateKey: string;
            try {
                console.log(`[Telegram Withdraw] Decrypting key for ${telegramId}`);
                privateKey = EncryptionService.decrypt(user.encrypted_private_key);
            } catch (decryptError: any) {
                console.error('[Telegram Withdraw] Decryption failed:', decryptError.message);
                return res.status(500).json({ success: false, message: 'Wallet security check failed' });
            }
            const wallet = new ethers.Wallet(privateKey, provider);
            const amountInWei = ethers.parseUnits(amount.toString(), 18);

            // 0. Pre-check Total Balance
            const marketContract = new ethers.Contract(MARKET_CONTRACT_ADDRESS, PREDICTION_MARKET_ABI, wallet);
            const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, wallet);

            const [walletBalance, depositedBalance] = await Promise.all([
                usdcContract.balanceOf(wallet.address),
                marketContract.userBalances(wallet.address)
            ]);

            const totalAvailable = walletBalance + depositedBalance;

            if (totalAvailable < amountInWei) {
                const availableFormatted = ethers.formatUnits(totalAvailable, 18);
                return res.status(400).json({
                    success: false,
                    message: `Insufficient funds. You only have ${availableFormatted} USDC available (Wallet + Deposited).`
                });
            }

            // 1. Withdraw from Market Contract (if funds are there)

            if (depositedBalance > 0) {
                const withdrawAmount = depositedBalance > amountInWei ? amountInWei : depositedBalance;
                console.log(`[Telegram Withdraw] Withdrawing ${ethers.formatUnits(withdrawAmount, 18)} from Contract first...`);

                // Gas for withdraw
                await CustodialWalletService.fundWallet(wallet.address, '0.0008', provider);

                const tx = await marketContract.withdraw(withdrawAmount);
                await tx.wait();
                console.log('[Telegram Withdraw] Contract withdrawal complete');

                // Wait for indexer/RPC to catch up slightly
                await new Promise(r => setTimeout(r, 2000));
            }

            // 2. Transfer from Wallet to Target
            // usdcContract is already instantiated above

            // Gas for transfer
            await CustodialWalletService.fundWallet(wallet.address, '0.0006', provider);

            console.log(`[Telegram Withdraw] Transferring to ${toAddress}...`);

            // Re-check USDC balance before transfer
            const currentUsdcBalance = await usdcContract.balanceOf(wallet.address);
            if (currentUsdcBalance < amountInWei) {
                const have = ethers.formatUnits(currentUsdcBalance, 18);
                // Fallback error if gas/transfer consumed slightly more or sync failed
                return res.status(400).json({
                    success: false,
                    message: `Withdrawal partial failure. Contract withdrawn, but wallet has insufficient USDC (${have}) to send to external address. Please try again or contact support.`
                });
            }

            const tx = await usdcContract.transfer(toAddress, amountInWei);
            const receipt = await tx.wait();

            await pool.query(
                'INSERT INTO telegram_transactions (telegram_id, type, amount, tx_hash, status) VALUES ($1, $2, $3, $4, $5)',
                [telegramId, 'WITHDRAW', amount, receipt.hash, 'CONFIRMED']
            );

            res.json({ success: true, message: 'Withdrawal successful', transactionHash: receipt.hash });
        } catch (error: any) {
            console.error('Withdraw error:', error);

            const decodedError = TelegramController.decodeContractError(error);
            if (decodedError) {
                return res.status(400).json({ success: false, message: decodedError });
            }

            res.status(500).json({ success: false, message: error.message || 'Server error' });
        }
    }
}
