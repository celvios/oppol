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
// Helper to swap USDT to USDC via PancakeSwap Router
const processCustodialSwap = async (userId: string, custodialAddress: string, privateKey: string, provider: ethers.JsonRpcProvider) => {
    try {
        console.log(`[Swap] Checking for USDT balance to swap...`);
        const USDT_ADDR = CONFIG.USDT_CONTRACT;
        // PancakeSwap Router v2
        const ROUTER_ADDR = '0x10ED43C718714eb63d5aA57B78B54704E256024E';
        const USDC_ADDR = CONFIG.USDC_CONTRACT;

        if (!USDT_ADDR || !USDC_ADDR) {
            console.log('[Swap] Missing USDT or USDC address config. Skipping swap.');
            return;
        }

        const usdtAbi = ['function balanceOf(address) view returns (uint256)', 'function approve(address, uint256) returns (bool)', 'function decimals() view returns (uint8)', 'function allowance(address, address) view returns (uint256)'];
        const usdt = new ethers.Contract(USDT_ADDR, usdtAbi, provider);
        const bal = await usdt.balanceOf(custodialAddress);
        const decimals = await usdt.decimals().catch(() => 18);

        // Threshold: 0.1 USDT
        if (bal < ethers.parseUnits("0.1", decimals)) {
            console.log(`[Swap] USDT Balance low (${ethers.formatUnits(bal, decimals)}). Skipping.`);
            return;
        }

        console.log(`[Swap] Found ${ethers.formatUnits(bal, decimals)} USDT. Initiating Swap via Router...`);

        // Need Signer
        const signer = new ethers.Wallet(privateKey, provider);
        const usdtSigner = new ethers.Contract(USDT_ADDR, usdtAbi, signer);

        // Check Gas
        const ethBal = await provider.getBalance(custodialAddress);
        const minGas = ethers.parseEther("0.001"); // Swap needs gas
        if (ethBal < minGas) {
            console.log('[Swap] Low Gas for Swap. Funding...');
            const relayerKey = process.env.PRIVATE_KEY;
            if (relayerKey) {
                const relayer = new ethers.Wallet(relayerKey, provider);
                const tx = await relayer.sendTransaction({
                    to: custodialAddress,
                    value: minGas - ethBal + ethers.parseEther("0.002")
                });
                await tx.wait();
            }
        }

        // Approve Router
        const allowance = await usdt.allowance(custodialAddress, ROUTER_ADDR);
        if (allowance < bal) {
            console.log('[Swap] Approving Router...');
            const txApprove = await usdtSigner.approve(ROUTER_ADDR, ethers.MaxUint256);
            await txApprove.wait();
        }

        // Swap
        const routerAbi = ['function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)'];
        const router = new ethers.Contract(ROUTER_ADDR, routerAbi, signer);

        console.log('[Swap] Swapping USDT -> USDC...');
        const path = [USDT_ADDR, USDC_ADDR]; // Try direct first
        const deadline = Math.floor(Date.now() / 1000) + 60 * 10; // 10 mins

        // Estimate Gas to ensure path works (or try WBNB path)
        let finalPath = path;
        try {
            await router.swapExactTokensForTokens.estimateGas(bal, 0, path, custodialAddress, deadline);
        } catch (e) {
            console.log('[Swap] Direct path failed/gas-error. Trying via WBNB...');
            const WBNB_ADDR = '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c'; // BSC WBNB
            finalPath = [USDT_ADDR, WBNB_ADDR, USDC_ADDR];
        }

        const txSwap = await router.swapExactTokensForTokens(
            bal,
            0, // Accept any amount (slippage handled by arb bots usually, for small amounts its fine)
            finalPath,
            custodialAddress,
            deadline
        );
        console.log(`[Swap] Swap Tx: ${txSwap.hash}`);
        await txSwap.wait();
        console.log('[Swap] Swap Complete.');

    } catch (e: any) {
        console.error('[Swap] Failed:', e.message);
        // Continue to deposit (maybe they have USDC too)
    }
};

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
        const privateKey = EncryptionService.decrypt(walletResult.rows[0].encrypted_private_key);

        // Setup Provider
        const rpcUrl = CONFIG.RPC_URL || 'https://bsc-dataseed.binance.org';
        const provider = new ethers.JsonRpcProvider(rpcUrl);

        // 1. Attempt Swap if USDT exists
        await processCustodialSwap(userId, custodialAddress, privateKey, provider);

        // 2. Proceed with Standard USDC Deposit
        const USDC_ADDR = CONFIG.USDC_CONTRACT;
        if (!USDC_ADDR) return res.status(500).json({ success: false, error: 'USDC contract not configured' });

        const usdcAbi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];
        const usdc = new ethers.Contract(USDC_ADDR, usdcAbi, provider);
        const usdcBalanceWei = await usdc.balanceOf(custodialAddress);

        let amountBN: bigint = usdcBalanceWei;
        const USDC_DECIMALS = 6;

        // Check minimum (0.01 USDC)
        if (amountBN < 10000n) {
            // Return success false but with "Swapped" status if we did a swap? 
            // Or just standard "No Balance" if swap failed or produced dust.
            console.log(`[Deposit] Balance too low (${ethers.formatUnits(amountBN, 6)} USDC). Skipping.`);
            return res.json({ success: false, error: 'No USDC balance to deposit', balance: parseFloat(ethers.formatUnits(amountBN, 6)) });
        }

        console.log(`[Deposit] Processing deposit of ${ethers.formatUnits(amountBN, 6)} USDC for ${userId}`);
        const amountStr = ethers.formatUnits(amountBN, 6);

        // Trigger the deposit
        const txHash = await processCustodialDeposit(userId, amountStr, 'manual-trigger');
        return res.json({
            success: true,
            message: `Successfully deposited ${amountStr} USDC into market contract`,
            amount: parseFloat(amountStr),
            custodialAddress,
            txHash
        });

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
        console.log(`[Withdraw] Request: user=${privyUserId}, amount=${amount}, dest=${destinationAddress}`);

        if (!privyUserId || !amount) {
            return res.status(400).json({ success: false, error: 'Missing parameters' });
        }

        if (!destinationAddress) {
            return res.status(400).json({ success: false, error: 'Destination address required' });
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
                try {
                    const tx = await relayer.sendTransaction({
                        to: custodialAddress,
                        value: minGas - bal + ethers.parseEther("0.0002")
                    });
                    await tx.wait();
                } catch (e: any) {
                    console.error('[Withdraw] Failed to fund gas:', e.message);
                    // Continue anyway, maybe it has enough
                }
            }
        }

        const MARKET_ADDR = process.env.MARKET_CONTRACT || process.env.MULTI_MARKET_ADDRESS;
        const USDC_ADDR = CONFIG.USDC_CONTRACT;
        if (!MARKET_ADDR || !USDC_ADDR) throw new Error("Missing Contract Config");

        const usdcAbi = ['function balanceOf(address) view returns (uint256)', 'function transfer(address, uint256) returns (bool)', 'function decimals() view returns (uint8)'];
        const usdc = new ethers.Contract(USDC_ADDR, usdcAbi, custodialSigner);

        const decimals = await usdc.decimals().catch(() => 18n); // Default to 18 if call fails
        const decimalsBi = BigInt(decimals);
        console.log(`[Withdraw] USDC Decimals: ${decimals}`);

        const amountUSDC = ethers.parseUnits(amount, Number(decimals)); // Use actual decimals

        // Check Wallet Balance
        const walletBalance = await usdc.balanceOf(custodialAddress);

        let neededFromGame = 0n;
        if (walletBalance < amountUSDC) {
            neededFromGame = amountUSDC - walletBalance;
        }

        if (neededFromGame > 0n) {
            const marketAbi = ['function withdraw(uint256 amount)'];
            const market = new ethers.Contract(MARKET_ADDR, marketAbi, custodialSigner);

            // Conversion: neededFromGame is in USDC decimals.
            // Market 'withdraw' uses 18 decimals (Shares).
            // Scale up: neededShares = neededFromGame * 10^(18 - decimals)
            // If decimals is 18, factor is 1. If 6, factor is 1e12.
            // Note: If decimals > 18 (rare), this would fail. Assuming <= 18.
            let scaleFactor = 1n;
            if (18n > decimalsBi) {
                scaleFactor = BigInt(10) ** (18n - decimalsBi);
            }
            const neededShares = neededFromGame * scaleFactor;

            console.log(`[Withdraw] Withdrawing ${ethers.formatUnits(neededFromGame, decimals)} USDC (${ethers.formatUnits(neededShares, 18)} Shares) from Market...`);
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
