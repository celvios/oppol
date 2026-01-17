import { Request, Response } from 'express';
import pool from '../config/database';
import { CustodialWalletService } from '../services/custodialWallet';
import { ethers } from 'ethers';
import { EncryptionService } from '../services/encryption';

// Use correct environment variables matching .env
const MARKET_CONTRACT_ADDRESS = process.env.MULTI_MARKET_ADDRESS || process.env.MARKET_CONTRACT || '0xB6a211822649a61163b94cf46e6fCE46119D3E1b';
const USDC_ADDRESS = process.env.USDC_CONTRACT || '0x16E4A3d9697D47c61De3bDD1DdDa4148aA09D634';
const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';

// ABI for PredictionMarketMulti contract
const PREDICTION_MARKET_ABI = [
    'function buyShares(uint256 marketId, uint256 outcomeIndex, uint256 shares, uint256 maxCost) external',
    'function userBalances(address) view returns (uint256)',
    'function deposit(uint256 amount) external',
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

            let userResult = await pool.query(
                'SELECT * FROM telegram_users WHERE telegram_id = $1',
                [telegramId]
            );

            // Auto-create user if not found (mock DB loses data on restart)
            if (userResult.rows.length === 0) {
                console.log('[Telegram Bet] User not found, auto-creating...');
                try {
                    const wallet = await CustodialWalletService.createWallet(telegramId.toString());
                    userResult = await pool.query(
                        'INSERT INTO telegram_users (telegram_id, username, wallet_address, encrypted_private_key) VALUES ($1, $2, $3, $4) RETURNING *',
                        [telegramId, 'telegram_user', wallet.address, wallet.encryptedPrivateKey]
                    );
                    console.log('[Telegram Bet] User auto-created with wallet:', wallet.address);
                } catch (createError: any) {
                    console.error('[Telegram Bet] Failed to create user:', createError);
                    throw new Error('Failed to create user wallet');
                }
            }

            const user = userResult.rows[0];
            const provider = new ethers.JsonRpcProvider(RPC_URL);

            // Decrypt private key with better error handling
            let privateKey: string;
            try {
                privateKey = EncryptionService.decrypt(user.encrypted_private_key);
            } catch (decryptError: any) {
                console.error('[Telegram Bet] Decryption failed:', decryptError);

                // === SELF-HEALING WALLET LOGIC ===
                console.log('[Auto-Heal] Attempting to heal wallet for user:', telegramId);

                try {
                    // 1. Check if old wallet has funds (using public address from DB)
                    // If DB address is missing, we must reset anyway.
                    if (user.wallet_address) {
                        const usdcCheckProvider = new ethers.JsonRpcProvider(RPC_URL);
                        const usdcCheckContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, usdcCheckProvider);
                        const userBalance = await usdcCheckContract.balanceOf(user.wallet_address);

                        // If balance is meaningful (> 0.1 USDC), we cannot safely reset without manual intervention
                        if (userBalance > BigInt(100000)) { // 0.1 USDC
                            console.error(`[Auto-Heal] Cannot reset wallet! Has funds: ${ethers.formatUnits(userBalance, 6)} USDC`);
                            throw new Error('Wallet authentication failed. Please contact support (Code: HAS_FUNDS).');
                        }
                    }

                    // 2. Wallet needs reset (Empty or corrupted)
                    console.log('[Auto-Heal] Wallet is empty or corrupted. Regenerating...');
                    const newWallet = await CustodialWalletService.createWallet(telegramId.toString());

                    // 3. Update DB
                    await pool.query(
                        'UPDATE telegram_users SET wallet_address = $1, encrypted_private_key = $2 WHERE telegram_id = $3',
                        [newWallet.address, newWallet.encryptedPrivateKey, telegramId]
                    );

                    console.log(`[Auto-Heal] Success! New Wallet: ${newWallet.address}`);

                    // 4. Update 'user' object so execution can continue
                    user.wallet_address = newWallet.address;
                    user.encrypted_private_key = newWallet.encryptedPrivateKey;
                    privateKey = EncryptionService.decrypt(newWallet.encryptedPrivateKey); // Should work now

                } catch (healError: any) {
                    console.error('[Auto-Heal] Failed:', healError);
                    throw new Error('Unable to authenticate wallet data. Please contact support.');
                }
            }

            const wallet = new ethers.Wallet(privateKey, provider);

            // Convert amount to wei (USDC has 6 decimals)
            const amountInWei = ethers.parseUnits(amount.toString(), 6);

            console.log('[Telegram Bet Debug]', {
                USDC_ADDRESS,
                MARKET_CONTRACT_ADDRESS,
                RPC_URL,
                userWallet: wallet.address,
                amount: amountInWei.toString()
            });

            // === GASLESS IMPLEMENTATION ===

            const serverPrivateKey = process.env.PRIVATE_KEY;
            if (!serverPrivateKey) throw new Error('Server wallet not configured');
            const operatorWallet = new ethers.Wallet(serverPrivateKey, provider);

            console.log('[Telegram Bet Debug]', {
                USDC_ADDRESS,
                MARKET_CONTRACT_ADDRESS,
                RPC_URL,
                userWallet: wallet.address,
                amount: amountInWei.toString(),
                operator: operatorWallet.address
            });

            // CHECK SERVER BNB (GAS)
            const operatorBalance = await provider.getBalance(operatorWallet.address);
            console.log(`[Gasless Bet] Operator BNB: ${ethers.formatEther(operatorBalance)}`);
            if (operatorBalance < ethers.parseEther('0.005')) {
                throw new Error('Server busy (Low Gas). Please try again later.');
            }

            // 1. Check Internal Contract Balance (Has user deposited?)
            const marketContractUser = new ethers.Contract(MARKET_CONTRACT_ADDRESS, PREDICTION_MARKET_ABI, wallet);
            const internalBalance = await marketContractUser.userBalances(wallet.address);
            console.log(`[Gasless Bet] Internal Balance: ${ethers.formatUnits(internalBalance, 6)} USDC`);

            const neededDeposit = amountInWei > internalBalance ? amountInWei - internalBalance : BigInt(0);

            if (neededDeposit > BigInt(0)) {
                console.log(`[Gasless Bet] Need to deposit: ${ethers.formatUnits(neededDeposit, 6)} USDC`);

                // Check User Wallet USDC
                const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, wallet);
                const userUsdcBalance = await usdcContract.balanceOf(wallet.address);
                if (userUsdcBalance < neededDeposit) {
                    const missing = ethers.formatUnits(neededDeposit - userUsdcBalance, 6);
                    throw new Error(`Insufficient funds. You need ${missing} more USDC.`);
                }

                // Check Allowance
                const allowance = await usdcContract.allowance(wallet.address, MARKET_CONTRACT_ADDRESS);
                if (allowance < neededDeposit) {
                    console.log(`[Gasless Bet] Insufficient allowance. Funding user ${wallet.address} for approve...`);
                    const userBalance = await provider.getBalance(wallet.address);
                    const requiredGas = ethers.parseEther('0.0005');

                    if (userBalance < requiredGas) {
                        await CustodialWalletService.fundWallet(wallet.address, '0.0005', provider);
                    }

                    const approveTx = await usdcContract.approve(MARKET_CONTRACT_ADDRESS, ethers.MaxUint256);
                    await approveTx.wait();
                    console.log('[Gasless Bet] Approve complete');
                }

                // Execute Deposit
                console.log('[Gasless Bet] Executing Deposit...');
                const userBalanceForDeposit = await provider.getBalance(wallet.address);
                const depositGas = ethers.parseEther('0.0008'); // Deposit cost

                if (userBalanceForDeposit < depositGas) {
                    console.log('[Gasless Bet] Funding user for deposit gas...');
                    await CustodialWalletService.fundWallet(wallet.address, '0.001', provider);
                }

                const depositTx = await marketContractUser.deposit(neededDeposit);
                await depositTx.wait();
                console.log('[Gasless Bet] Deposit complete');
            }

            // 2. Server Executes Trade (buySharesFor)
            // Operator calls the contract, paying the gas.
            const marketContractOperator = new ethers.Contract(MARKET_CONTRACT_ADDRESS, [
                'function buySharesFor(address _user, uint256 _marketId, uint256 _outcomeIndex, uint256 _shares, uint256 _maxCost) external'
            ], operatorWallet);

            const maxCost = amountInWei * BigInt(11) / BigInt(10); // 10% slippage

            console.log(`[Gasless Bet] Operator buying shares for ${wallet.address}...`);
            const betTx = await marketContractOperator.buySharesFor(
                wallet.address,
                marketId,
                outcome,
                amountInWei,
                maxCost
            );
            const receipt = await betTx.wait();
            console.log(`[Gasless Bet] Success! TX: ${receipt.hash}`);

            // Store transaction
            await pool.query(
                'INSERT INTO telegram_transactions (telegram_id, type, market_id, outcome, amount, tx_hash, status) VALUES ($1, $2, $3, $4, $5, $6, $7)',
                [telegramId, 'BET', marketId, outcome, amount, receipt.hash, 'CONFIRMED']
            );

            res.json({
                success: true,
                message: 'Bet placed successfully',
                transactionHash: receipt.hash
            });
        } catch (error: any) {
            console.error('Place bet error:', error);
            res.status(400).json({ success: false, message: error.message });
        }
    }

    static async getBalance(req: Request, res: Response) {
        // ... (keep existing implementation)
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
            const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);

            const balance = await usdcContract.balanceOf(walletAddress);
            const balanceFormatted = ethers.formatUnits(balance, 6);

            res.json({ success: true, balance: parseFloat(balanceFormatted) });
        } catch (error: any) {
            console.error('Get balance error:', error);
            res.status(500).json({ success: false, message: error.message || 'Server error' });
        }
    }

    static async withdraw(req: Request, res: Response) {
        try {
            const { telegramId, toAddress, amount } = req.body;

            const userResult = await pool.query(
                'SELECT * FROM telegram_users WHERE telegram_id = $1',
                [telegramId]
            );

            if (userResult.rows.length === 0) {
                return res.status(404).json({ success: false, message: 'User not found' });
            }

            const user = userResult.rows[0];
            const provider = new ethers.JsonRpcProvider(RPC_URL);
            const privateKey = EncryptionService.decrypt(user.encrypted_private_key);
            const wallet = new ethers.Wallet(privateKey, provider);
            const amountInWei = ethers.parseUnits(amount.toString(), 6);

            // GASLESS WITHDRAWAL LOGIC
            // 1. Calculate needed gas for transfer
            const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, wallet);

            // Estimate gas
            let gasLimit;
            try {
                gasLimit = await usdcContract.transfer.estimateGas(toAddress, amountInWei);
            } catch (e) {
                gasLimit = BigInt(100000); // Fallback safe limit
            }

            const feeData = await provider.getFeeData();
            const gasPrice = feeData.gasPrice || ethers.parseUnits('3', 'gwei'); // Min 3 gwei on BSC
            const costOfGas = gasLimit * gasPrice; // Total Wei needed

            // Add a buffer (10%)
            const totalFundingNeeded = costOfGas * BigInt(110) / BigInt(100);

            console.log(`[Gasless Withdraw] Gas needed: ${ethers.formatEther(totalFundingNeeded)} BNB`);

            // 2. Check user BNB balance
            const userBal = await provider.getBalance(wallet.address);

            if (userBal < totalFundingNeeded) {
                const amountToFund = totalFundingNeeded - userBal;
                console.log(`[Gasless Withdraw] Funding user with additional ${ethers.formatEther(amountToFund)} BNB...`);
                await CustodialWalletService.fundWallet(wallet.address, ethers.formatEther(amountToFund), provider);
            }

            // 3. User executes transfer (paying with the funded BNB)
            const tx = await usdcContract.transfer(toAddress, amountInWei);
            const receipt = await tx.wait();

            await pool.query(
                'INSERT INTO telegram_transactions (telegram_id, type, amount, tx_hash, status) VALUES ($1, $2, $3, $4, $5)',
                [telegramId, 'WITHDRAW', amount, receipt.hash, 'CONFIRMED']
            );

            res.json({ success: true, message: 'Withdrawal successful', transactionHash: receipt.hash });
        } catch (error: any) {
            console.error('Withdraw error:', error);
            res.status(500).json({ success: false, message: error.message || 'Server error' });
        }
    }
}
