import { Request, Response } from 'express';
import { query } from '../config/database';
import { createRandomWallet } from '../services/web3';
import { EncryptionService } from '../services/encryption';
import { CONFIG } from '../config/contracts';
import { ethers } from 'ethers';

// Get user's wallet
export const getWallet = async (req: Request, res: Response) => {
    try {
        const { userId } = req.params; // In real app, get from Auth Middleware
        if (!userId) {
            res.status(400).json({ error: 'User ID required' });
            return;
        }

        const result = await query('SELECT id, public_address, balance FROM wallets WHERE user_id = $1', [userId]);

        if (result.rows.length === 0) {
            res.status(404).json({ error: 'Wallet not found' });
            return;
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal Server Error' });
    }
};

// Internal function to create wallet for a user
export const createWalletInternal = async (userId: string) => {
    const { address, privateKey } = createRandomWallet();
    const encryptedKey = EncryptionService.encrypt(privateKey);

    const result = await query(
        'INSERT INTO wallets (user_id, public_address, encrypted_private_key) VALUES ($1, $2, $3) RETURNING id, public_address',
        [userId, address, encryptedKey]
    );
    return result.rows[0];
};

/**
 * Link a WalletConnect address to a custodial wallet
 * DEPRECATED: Web and Mobile Auth are distinct
 */
export const linkWallet = async (req: Request, res: Response) => {
    res.status(410).json({ error: 'Wallet linking is deprecated. Web and Mobile Auth are distinct.' });
};

// Helper function to process custodial deposits (Sweep funds to Contract)
export const processCustodialDeposit = async (userId: string, amountRaw: string, txHash: string) => {
    try {
        console.log(`[Deposit] Processing custodial sweep for user ${userId}, Amount: ${amountRaw}`);

        // 1. Get Custodial Wallet
        const walletResult = await query(
            'SELECT public_address, encrypted_private_key FROM wallets WHERE user_id = $1',
            [userId]
        );

        if (walletResult.rows.length === 0) {
            console.log(`[Deposit] No custodial wallet found for user ${userId}. Skipping sweep.`);
            return;
        }

        const wallet = walletResult.rows[0];
        const custodialAddress = wallet.public_address;
        const privateKey = EncryptionService.decrypt(wallet.encrypted_private_key);

        console.log(`[Deposit] Custodial Wallet: ${custodialAddress}`);

        // Setup Providers
        const rpcUrl = CONFIG.RPC_URL || 'https://bsc-dataseed.binance.org';
        const provider = new ethers.JsonRpcProvider(rpcUrl);

        // Global Relayer (Funder)
        const relayerKey = process.env.PRIVATE_KEY;
        if (!relayerKey) throw new Error("Missing PRIVATE_KEY for Relayer");
        const relayer = new ethers.Wallet(relayerKey, provider);

        // Custodial Signer
        const custodialSigner = new ethers.Wallet(privateKey, provider);

        // We need gas to Approve + Deposit. ~0.001 BNB is ideal, but for low-balance relayers:
        // Approve ~45k gas. Deposit ~100k gas. Total ~150k gas.
        // @ 3 Gwei = 0.00045 BNB. So 0.0006 is safe minimum.
        const bal = await provider.getBalance(custodialAddress);
        const minGas = ethers.parseEther("0.0006");

        if (bal < minGas) {
            // Check Relayer Balance first
            const relayerBal = await provider.getBalance(relayer.address);
            const neededForRelay = minGas - bal + ethers.parseEther("0.0002");

            if (relayerBal < neededForRelay) {
                console.error(`❌ [Deposit] CRITICAL: Relayer Wallet (${relayer.address}) is Empty! Balance: ${ethers.formatEther(relayerBal)} BNB`);
                throw new Error("Relayer System Out of Gas - Please contact support.");
            }

            console.log(`[Deposit] Low BNB (${ethers.formatEther(bal)}). Funding gas from Relayer...`);
            const tx = await relayer.sendTransaction({
                to: custodialAddress,
                value: neededForRelay
            });
            await tx.wait();
            console.log(`[Deposit] Gas funded: ${tx.hash}`);
        }

        // 3. Approve USDC
        const USDC_ADDR = CONFIG.USDC_CONTRACT;
        const MARKET_ADDR = process.env.MARKET_CONTRACT || process.env.MULTI_MARKET_ADDRESS;

        if (!USDC_ADDR || !MARKET_ADDR) throw new Error("Missing USDC or MARKET Address");

        const usdcAbi = [
            'function approve(address spender, uint256 amount) returns (bool)',
            'function allowance(address owner, address spender) view returns (uint256)'
        ];
        const usdc = new ethers.Contract(USDC_ADDR, usdcAbi, custodialSigner);

        // Convert amount
        // USDC on BSC has 6 decimals
        const USDC_DECIMALS = 6;
        const amountBN = ethers.parseUnits(amountRaw, USDC_DECIMALS);

        const allowance = await usdc.allowance(custodialAddress, MARKET_ADDR);
        if (allowance < amountBN) {
            console.log(`[Deposit] Approving USDC for Market...`);
            const txApprove = await usdc.approve(MARKET_ADDR, ethers.MaxUint256);
            await txApprove.wait();
            console.log(`[Deposit] Approved: ${txApprove.hash}`);
        }

        // 4. Deposit to Market
        const marketAbi = ['function deposit(uint256 amount)'];
        const market = new ethers.Contract(MARKET_ADDR, marketAbi, custodialSigner);

        console.log(`[Deposit] Depositing ${amountRaw} USDC to Market...`);
        // Check balance again just in case (USDC balance)
        // We assume watcher was triggered by transfer, so balance is there.

        const txDeposit = await market.deposit(amountBN);
        console.log(`[Deposit] Deposit TX Sent: ${txDeposit.hash}`);
        const receipt = await txDeposit.wait();

        console.log(`✅ [Deposit] Sweep complete! User ${userId} now has on-chain balance.`);
        return txDeposit.hash;

    } catch (error: any) {
        console.error(`❌ [Deposit] Sweep failed for ${userId}:`, error.message);
        throw error;
    }
};

/**
 * HTTP handler: POST /api/wallet/deposit-custodial
 * Reads the actual USDC balance from the user's custodial wallet and deposits it into the market contract.
 * Body: { privyUserId: string }
 */
export const triggerCustodialDeposit = async (req: Request, res: Response) => {
    try {
        const { privyUserId } = req.body;
        if (!privyUserId) {
            return res.status(400).json({ success: false, error: 'privyUserId required' });
        }

        // Look up user by privy_user_id
        const userResult = await query(
            'SELECT id FROM users WHERE privy_user_id = $1',
            [privyUserId]
        );
        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        const userId = userResult.rows[0].id;

        // Get custodial wallet
        const walletResult = await query(
            'SELECT public_address, encrypted_private_key FROM wallets WHERE user_id = $1',
            [userId]
        );
        if (walletResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Custodial wallet not found' });
        }
        const custodialAddress = walletResult.rows[0].public_address;

        // Check actual USDC balance on-chain
        const rpcUrl = CONFIG.RPC_URL || 'https://bsc-dataseed.binance.org';
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const USDC_ADDR = CONFIG.USDC_CONTRACT;
        if (!USDC_ADDR) return res.status(500).json({ success: false, error: 'USDC contract not configured' });

        const usdcAbi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];
        // 3. Get USDC Balance
        const usdc = new ethers.Contract(USDC_ADDR, usdcAbi, provider);
        const usdcBalanceWei = await usdc.balanceOf(custodialAddress);

        // Use BigInt directly to avoid floating point errors
        let amountBN: bigint;

        // The original `amountStr` was derived from `rawBal` and `decimals`.
        // We need to decide if `amountStr` should be passed to `processCustodialDeposit`
        // or if `processCustodialDeposit` should calculate it from `amountBN`.
        // For now, let's assume `amountStr` is still needed for `processCustodialDeposit`
        // and derive it from `amountBN`.
        const USDC_DECIMALS = 6; // Assuming USDC has 6 decimals as per processCustodialDeposit
        const amountStr = ethers.formatUnits(usdcBalanceWei, USDC_DECIMALS); // Derive amountStr from usdcBalanceWei

        if (amountStr) {
            // If amount provided manually, parse it (assuming 6 decimals)
            amountBN = ethers.parseUnits(amountStr, USDC_DECIMALS);
        } else {
            // Sweep entire balance
            amountBN = usdcBalanceWei;
        }

        // Check minimum (0.01 USDC = 10000 units)
        if (amountBN < 10000n) {
            console.log(`[Deposit] Balance too low (${ethers.formatUnits(amountBN, 6)} USDC). Skipping.`);
            return res.json({ success: false, error: 'No USDC balance to deposit', balance: parseFloat(ethers.formatUnits(amountBN, 6)) });
        }

        console.log(`[Deposit] Processing deposit of ${ethers.formatUnits(amountBN, 6)} USDC for ${userId}`);

        // Trigger the deposit synchronously to return result to user
        try {
            const txHash = await processCustodialDeposit(userId, amountStr, 'manual-trigger');
            return res.json({
                success: true,
                message: `Successfully deposited ${ethers.formatUnits(amountBN, 6)} USDC into market contract`,
                amount: parseFloat(ethers.formatUnits(amountBN, 6)),
                custodialAddress,
                txHash
            });
        } catch (err: any) {
            console.error('[TriggerDeposit] Deposit process failed:', err);
            return res.status(500).json({
                success: false,
                error: `Deposit failed: ${err.message || 'Unknown error during processing'}`
            });
        }

    } catch (error: any) {
        console.error('[TriggerDeposit] Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * Handle Custodial Withdrawal
 * 1. Withdraw from Market (if shares provided)
 * 2. Transfer USDC to External Address (if destination provided)
 */
export const handleCustodialWithdraw = async (req: Request, res: Response) => {
    try {
        const { privyUserId, amount, destinationAddress } = req.body;
        // amount is string (USDC amount, e.g. "10.5")

        if (!privyUserId || !amount) {
            return res.status(400).json({ success: false, error: 'Missing parameters' });
        }

        console.log(`[Withdraw] Processing custodial withdraw for ${privyUserId}, Amount: ${amount}`);

        // 1. Get User
        const userResult = await query('SELECT id FROM users WHERE privy_user_id = $1', [privyUserId]);
        if (userResult.rows.length === 0) return res.status(404).json({ success: false, error: 'User not found' });
        const userId = userResult.rows[0].id;

        // 2. Get Wallet
        const walletResult = await query('SELECT public_address, encrypted_private_key FROM wallets WHERE user_id = $1', [userId]);
        if (walletResult.rows.length === 0) return res.status(404).json({ success: false, error: 'Custodial wallet not found' });

        const wallet = walletResult.rows[0];
        const custodialAddress = wallet.public_address;
        const privateKey = EncryptionService.decrypt(wallet.encrypted_private_key);

        // 3. Setup Providers
        const rpcUrl = CONFIG.RPC_URL || 'https://bsc-dataseed.binance.org';
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const custodialSigner = new ethers.Wallet(privateKey, provider);

        // Check GAS
        const bal = await provider.getBalance(custodialAddress);
        const minGas = ethers.parseEther("0.0006");
        if (bal < minGas) {
            // Fund from Relayer
            const relayerKey = process.env.PRIVATE_KEY;
            if (relayerKey) {
                const relayer = new ethers.Wallet(relayerKey, provider);
                console.log(`[Withdraw] Funding gas for withdrawal...`);
                const tx = await relayer.sendTransaction({
                    to: custodialAddress,
                    value: minGas - bal + ethers.parseEther("0.0002")
                });
                await tx.wait();
            }
        }

        const MARKET_ADDR = process.env.MARKET_CONTRACT || process.env.MULTI_MARKET_ADDRESS;
        const USDC_ADDR = CONFIG.USDC_CONTRACT;
        if (!MARKET_ADDR || !USDC_ADDR) throw new Error("Missing Contract Config");

        const amountUSDC = ethers.parseUnits(amount, 6); // 6 decimals
        const amountShares = ethers.parseUnits(amount, 18); // 18 decimals

        // Step A: Withdraw from Market (if funds are in market)
        // We assume user wants to withdraw user-specified amount.
        // But for "Cash Out", logic in frontend checks breakdown.
        // Simplification: Always try to withdraw requested amount from Market FIRST?
        // OR: Frontend should specify if it wants "withdraw" or "transfer".
        // Let's support a flag or inferred logic.
        // For now, let's assume we withdraw the FULL amount from Market, THEN transfer.
        // Wait, if user already has USDC in wallet, we shouldn't fail market withdraw.

        // Let's implement robust "Cash Out":
        // 1. Check Wallet USDC Balance.
        // 2. If Wallet USDC < Amount, withdraw difference from Market.
        // 3. Transfer Total Amount to Destination.

        const usdcAbi = ['function balanceOf(address) view returns (uint256)', 'function transfer(address, uint256) returns (bool)'];
        const usdc = new ethers.Contract(USDC_ADDR, usdcAbi, custodialSigner);
        const walletBalance = await usdc.balanceOf(custodialAddress);

        let neededFromGame = 0n;
        if (walletBalance < amountUSDC) {
            neededFromGame = amountUSDC - walletBalance;
        }

        if (neededFromGame > 0n) {
            const marketAbi = ['function withdraw(uint256 amount)'];
            const market = new ethers.Contract(MARKET_ADDR, marketAbi, custodialSigner);

            // Convert USDC needed to Shares
            const neededUSDCStr = ethers.formatUnits(neededFromGame, 6);
            const neededShares = ethers.parseUnits(neededUSDCStr, 18);

            console.log(`[Withdraw] Withdrawing ${neededUSDCStr} from Market...`);
            const txWithdraw = await market.withdraw(neededShares);
            await txWithdraw.wait();
        }

        // Step B: Transfer to Destination (if provided)
        let finalTx = '';
        if (destinationAddress) {
            console.log(`[Withdraw] Transferring ${amount} USDC to ${destinationAddress}...`);
            const txTransfer = await usdc.transfer(destinationAddress, amountUSDC);
            await txTransfer.wait();
            finalTx = txTransfer.hash;
        }

        return res.json({
            success: true,
            message: 'Withdrawal successful',
            txHash: finalTx
        });

    } catch (error: any) {
        console.error('[CustodialWithdraw] Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};
