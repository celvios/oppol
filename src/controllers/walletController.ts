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

        // 2. Check Gas (BNB)
        // We need gas to Approve + Deposit. ~0.001 BNB is safe.
        const bal = await provider.getBalance(custodialAddress);
        const minGas = ethers.parseEther("0.002");

        if (bal < minGas) {
            console.log(`[Deposit] Low BNB (${ethers.formatEther(bal)}). Funding gas from Relayer...`);
            const tx = await relayer.sendTransaction({
                to: custodialAddress,
                value: minGas - bal + ethers.parseEther("0.0005") // Top up to ~0.0025
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
        const usdc = new ethers.Contract(USDC_ADDR, usdcAbi, provider);
        const [rawBal, decimals] = await Promise.all([
            usdc.balanceOf(custodialAddress),
            usdc.decimals().catch(() => 6)
        ]);

        const usdcBalance = parseFloat(ethers.formatUnits(rawBal, decimals));
        console.log(`[TriggerDeposit] Custodial ${custodialAddress} has ${usdcBalance} USDC`);

        if (usdcBalance < 0.01) {
            return res.json({ success: false, error: 'No USDC balance to deposit', balance: usdcBalance });
        }

        // Format with correct decimals
        const amountStr = ethers.formatUnits(rawBal, decimals);

        // Trigger the deposit synchronously to return result to user
        try {
            await processCustodialDeposit(userId, amountStr, 'manual-trigger');
            return res.json({
                success: true,
                message: `Successfully deposited ${usdcBalance.toFixed(6)} USDC into market contract`,
                amount: usdcBalance,
                custodialAddress
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
