import { Request, Response } from 'express';
import { ethers } from 'ethers';
import { query } from '../config/database';

// Contract addresses
const MARKET_CONTRACT = process.env.MARKET_CONTRACT || '0xe3Eb84D7e271A5C44B27578547f69C80c497355B';
const RPC_URL = process.env.RPC_URL || 'https://bsc-rpc.publicnode.com';

// Market contract ABI — includes V4's sweepGasFeeFor for universal gas recovery
const MARKET_ABI = [
    'function buySharesFor(address user, uint256 marketId, uint256 outcomeIndex, uint256 shares, uint256 maxCost)',
    'function userBalances(address) view returns (uint256)',
    'function calculateCost(uint256 _marketId, uint256 _outcomeIndex, uint256 _shares) view returns (uint256)',
    'function getPrice(uint256 _marketId, uint256 _outcomeIndex) view returns (uint256)',
    // V4: operator deducts gas fee from any user's deposited balance — no private key needed
    'function sweepGasFeeFor(address user, uint256 amount)',
];

const USDC_DECIMALS = 18;

/**
 * Resolve the on-chain address that actually holds a user's deposited balance.
 * - For custodial (Google/email) users: re-derive the Pimlico SA from the stored private key.
 * - For MetaMask users: the wallet address passed in IS the SA (Pimlico SA derived client-side).
 */
async function resolveTradeAddress(walletAddress: string, privyUserId?: string): Promise<string> {
    if (!privyUserId) return walletAddress.toLowerCase();

    try {
        // Look up user by Privy ID
        const userRes = await query('SELECT id FROM users WHERE privy_user_id = $1', [privyUserId]);
        if (userRes.rows.length === 0) return walletAddress.toLowerCase();

        const userId = userRes.rows[0].id;
        const walletRes = await query('SELECT encrypted_private_key FROM wallets WHERE user_id = $1', [userId]);
        if (walletRes.rows.length === 0) return walletAddress.toLowerCase();

        // Re-derive the Pimlico Simple Smart Account address from the stored private key
        const { EncryptionService } = require('../services/encryption');
        const { getSmartAccountAddressForKey } = require('./walletController');
        const pk = EncryptionService.decrypt(walletRes.rows[0].encrypted_private_key);
        const saAddr = await getSmartAccountAddressForKey(pk);
        console.log(`[Bet] Resolved custodial SA for ${privyUserId}: ${saAddr}`);
        return saAddr.toLowerCase();
    } catch (e: any) {
        console.error('[Bet] Failed to resolve custodial SA, using walletAddress:', e.message);
        return walletAddress.toLowerCase();
    }
}

/**
 * Place a bet for a user (custodial/relayer trading)
 * POST /api/bet
 *
 * Fee model (ALL user types — email/Google AND MetaMask):
 *   net trade amount = requestedAmount - gasFeeUSDC
 *   Protocol fee (~5-10%) is applied ON-CHAIN by the contract inside buySharesFor.
 *   Gas fee is recovered AFTER the trade via sweepGasFeeFor(), which works for
 *   any user type without needing to store their private key.
 */
export const placeBet = async (req: Request, res: Response) => {
    try {
        const { walletAddress, privyUserId, marketId, outcomeIndex, side, amount } = req.body;

        // ====== 🔍 DIAGNOSTIC LOG: Issue 1 & 2 - Bet Entry ======
        console.log('🔍 [BetController] [ISSUE-1/2] Incoming bet request:', {
            walletAddress,
            privyUserId: privyUserId ? `${privyUserId.substring(0, 12)}...` : undefined,
            marketId,
            outcomeIndex,
            side,
            amount,
            timestamp: new Date().toISOString(),
        });
        // =========================================================

        if (!walletAddress) {
            return res.status(400).json({ success: false, error: 'Wallet address required' });
        }

        if (marketId === undefined || (!side && outcomeIndex === undefined) || !amount) {
            return res.status(400).json({ success: false, error: 'Missing marketId, side/outcomeIndex, or amount' });
        }

        // Resolve the correct on-chain address where funds live.
        // For custodial users the Pimlico SA is re-derived from the stored private key.
        const normalizedAddress = await resolveTradeAddress(walletAddress, privyUserId);

        // ====== 🔍 DIAGNOSTIC LOG: Issue 1 - Address Resolution ======
        console.log('🔍 [BetController] [ISSUE-1] Address resolution result:', {
            original_walletAddress: walletAddress,
            resolved_normalizedAddress: normalizedAddress,
            addressChanged: walletAddress.toLowerCase() !== normalizedAddress,
            hasCustodialUser: !!privyUserId,
        });
        // =============================================================


        // Determine outcome index
        let targetOutcome = 0;
        if (outcomeIndex !== undefined) {
            targetOutcome = parseInt(outcomeIndex);
        } else if (side) {
            targetOutcome = side.toUpperCase() === 'YES' ? 0 : 1;
        }

        // Server wallet (operator/relayer) — signs all on-chain calls
        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            return res.status(500).json({ success: false, error: 'Server wallet not configured' });
        }

        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const signer = new ethers.Wallet(privateKey, provider);
        const marketContract = new ethers.Contract(MARKET_CONTRACT, MARKET_ABI, signer);

        // --- GAS FEE CALCULATION (applied to ALL user types) ---
        // Estimate: buySharesFor ~150k + sweepGasFeeFor ~60k = ~210k gas. Use 250k as safety margin.
        const { gasService } = require('../services/gasService');
        const estGas = 250000n;
        const gasFeeUSDC: bigint = await gasService.estimateGasCostInUSDC(estGas); // bigint, 18-dec USDC

        console.log(`[Bet] Est. Gas Fee: ${ethers.formatUnits(gasFeeUSDC, USDC_DECIMALS)} USDC`);

        const amountBN = ethers.parseUnits(String(amount), USDC_DECIMALS);
        let tradeAmount = parseFloat(String(amount));
        let feesToSweep = 0n;

        if (amountBN > gasFeeUSDC) {
            const netAmount = amountBN - gasFeeUSDC;
            tradeAmount = parseFloat(ethers.formatUnits(netAmount, USDC_DECIMALS));
            feesToSweep = gasFeeUSDC;
            console.log(`[Bet] Net Trade Amount: ${tradeAmount} USDC | Gas Fee: ${ethers.formatUnits(feesToSweep, USDC_DECIMALS)} USDC`);
        } else {
            console.warn('[Bet] Amount too low to cover gas — trading full amount, relayer absorbs gas cost.');
        }
        // --- END GAS FEE CALCULATION ---

        const maxCostInUnits = ethers.parseUnits(tradeAmount.toFixed(18), USDC_DECIMALS);

        // Check deposited balance: user must have enough for trade + gas fee
        const userBalance: bigint = await marketContract.userBalances(normalizedAddress);
        const totalRequired = maxCostInUnits + feesToSweep;

        // ====== 🔍 DIAGNOSTIC LOG: Issue 1 - On-Chain Balance Check ======
        console.log('🔍 [BetController] [ISSUE-1] On-chain balance check:', {
            address: normalizedAddress,
            userBalance_raw: userBalance.toString(),
            userBalance_formatted: ethers.formatUnits(userBalance, USDC_DECIMALS),
            requiredAmount: amount,
            maxCostInUnits_formatted: ethers.formatUnits(maxCostInUnits, USDC_DECIMALS),
            feesToSweep_formatted: ethers.formatUnits(feesToSweep, USDC_DECIMALS),
            totalRequired_formatted: ethers.formatUnits(totalRequired, USDC_DECIMALS),
            sufficient: userBalance >= totalRequired,
            marketContract: MARKET_CONTRACT,
        });
        // =================================================================

        if (userBalance < totalRequired) {
            const bal = parseFloat(ethers.formatUnits(userBalance, USDC_DECIMALS)).toFixed(4);
            console.log(`❌ [BetController] [ISSUE-1] Insufficient balance for ${normalizedAddress}. Have: ${bal}, Need: ${amount} (incl. gas)`);
            return res.status(400).json({
                success: false,
                error: `Insufficient balance. Have: $${bal}, Need: $${amount}`
            });
        }

        // Binary search (20 iterations ≈ 0.0001% precision) to find max shares for net trade amount
        let low = BigInt(1);
        let high = maxCostInUnits * BigInt(10); // safe upper bound
        let bestShares = BigInt(0);

        for (let i = 0; i < 20; i++) {
            const mid = (low + high) / BigInt(2);
            if (mid === BigInt(0)) break;

            const cost: bigint = await marketContract.calculateCost(marketId, targetOutcome, mid);

            if (cost <= maxCostInUnits) {
                bestShares = mid;
                low = mid + BigInt(1);
            } else {
                high = mid - BigInt(1);
            }
        }

        if (bestShares === BigInt(0)) {
            return res.status(400).json({ success: false, error: 'Amount too small to buy any shares' });
        }

        // 5% slippage buffer on the exact cost at execution time
        const finalCost: bigint = await marketContract.calculateCost(marketId, targetOutcome, bestShares);
        const maxCostWithBuffer = finalCost * BigInt(105) / BigInt(100);

        console.log(`[Bet] Relayer ${signer.address} buying ${ethers.formatUnits(bestShares, USDC_DECIMALS)} shares for ${normalizedAddress}`);

        const tx = await marketContract.buySharesFor(
            normalizedAddress,
            marketId,
            targetOutcome,
            bestShares,
            maxCostWithBuffer
        );
        const receipt = await tx.wait();

        if (receipt.status !== 1) {
            throw new Error('Transaction reverted on-chain. Database not updated.');
        }

        // --- TRADE RECORDING (FIX ISSUE 2: Empty Portfolio) ---
        // Strictly after on-chain success, insert the trade using the canonical Proxy Wallet / SA address.
        // This makes it instantly visible in the user's portfolio query.
        try {
            await query(`
                INSERT INTO trades (
                    user_address, 
                    market_id, 
                    outcome_index, 
                    shares, 
                    price, 
                    timestamp, 
                    transaction_hash
                ) VALUES ($1, $2, $3, $4, $5, NOW(), $6)
            `, [
                normalizedAddress, // MUST be the proxy wallet address for portfolio matching
                marketId,
                targetOutcome,
                ethers.formatUnits(bestShares, USDC_DECIMALS),
                ethers.formatUnits(finalCost, USDC_DECIMALS),
                receipt.hash
            ]);
            console.log(`[Bet] ✅ Trade securely recorded in DB for ${normalizedAddress}`);
        } catch (dbError: any) {
            console.error(`[Bet] ⚠️ CRITICAL: Blockchain succeeded but DB insert failed!`, dbError);
            // We do not throw here because the user's money was genuinely spent on-chain.
            // The indexer might catch it as a fallback.
        }

        // --- GAS FEE RECOVERY via sweepGasFeeFor (works for ALL user types) ---
        if (feesToSweep > 0n) {
            console.log(`[Bet] Sweeping gas fee: ${ethers.formatUnits(feesToSweep, USDC_DECIMALS)} USDC from ${normalizedAddress} ...`);

            const MAX_SWEEP_ATTEMPTS = 3;
            const SWEEP_RETRY_DELAY_MS = 2000;
            let sweepSuccess = false;

            for (let attempt = 1; attempt <= MAX_SWEEP_ATTEMPTS; attempt++) {
                try {
                    const sweepTx = await marketContract.sweepGasFeeFor(normalizedAddress, feesToSweep);
                    await sweepTx.wait();
                    console.log(`[Bet] ✅ Gas fee recovered (attempt ${attempt}): ${sweepTx.hash}`);
                    sweepSuccess = true;
                    break;
                } catch (e: any) {
                    console.error(`[Bet] ⚠️ Gas sweep attempt ${attempt}/${MAX_SWEEP_ATTEMPTS} failed: ${e.message}`);
                    if (attempt < MAX_SWEEP_ATTEMPTS) {
                        await new Promise(resolve => setTimeout(resolve, SWEEP_RETRY_DELAY_MS));
                    }
                }
            }

            // If all retries exhausted, log to DB for offline reconciliation.
            // The trade succeeded on-chain — we must not lose track of the owed fee.
            if (!sweepSuccess) {
                console.error(`[Bet] 🚨 SWEEP FAILED after ${MAX_SWEEP_ATTEMPTS} attempts. Recording to failed_sweeps for reconciliation.`);
                try {
                    await query(`
                        INSERT INTO failed_sweeps (
                            user_address,
                            amount,
                            trade_tx_hash,
                            created_at
                        ) VALUES ($1, $2, $3, NOW())
                        ON CONFLICT (trade_tx_hash) DO NOTHING
                    `, [
                        normalizedAddress,
                        ethers.formatUnits(feesToSweep, USDC_DECIMALS),
                        receipt.hash
                    ]);
                } catch (dbErr: any) {
                    // Last resort — at minimum ensure it is visible in server logs
                    console.error(`[Bet] 🚨 CRITICAL: failed_sweeps DB insert also failed. Manual recovery needed!`, {
                        user: normalizedAddress,
                        amount: ethers.formatUnits(feesToSweep, USDC_DECIMALS),
                        txHash: receipt.hash,
                        error: dbErr.message,
                    });
                }
            }
        }

        // ====== 🔍 DIAGNOSTIC LOG: Issue 2 - Bet Success ======
        console.log('✅ [BetController] [ISSUE-2] Bet placed successfully:', {
            txHash: receipt.hash,
            marketId,
            outcomeIndex: targetOutcome,
            shares: ethers.formatUnits(bestShares, USDC_DECIMALS),
            user_original: walletAddress,
            user_resolved: normalizedAddress,
            gasDeducted: ethers.formatUnits(feesToSweep, USDC_DECIMALS),
            db_stored: true, // DB is now written to immediately
        });
        // ========================================================

        return res.json({
            success: true,
            transaction: {
                hash: receipt.hash,
                marketId,
                outcomeIndex: targetOutcome,
                shares: ethers.formatUnits(bestShares, USDC_DECIMALS),
                user: walletAddress,
                gasDeducted: ethers.formatUnits(feesToSweep, USDC_DECIMALS),
            }
        });

    } catch (error: any) {
        console.error('Bet error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to place bet'
        });
    }
};

/**
 * Get bet cost estimate — calls contract for real price
 */
export const estimateBetCost = async (req: Request, res: Response) => {
    try {
        const { marketId, outcomeIndex, shares } = req.query;

        if (marketId === undefined || shares === undefined) {
            return res.status(400).json({ success: false, error: 'Missing marketId or shares' });
        }

        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const marketContract = new ethers.Contract(MARKET_CONTRACT, MARKET_ABI, provider);

        const sharesBN = ethers.parseUnits((shares as string) || '1', 18);
        const targetOutcome = parseInt((outcomeIndex as string) || '0');

        // Get real cost from contract (18-dec LMSR output)
        const cost = await marketContract.calculateCost(Number(marketId), targetOutcome, sharesBN);
        // Get real price in basis points (0-10000)
        const priceBP = await marketContract.getPrice(Number(marketId), targetOutcome);

        return res.json({
            success: true,
            estimatedCost: ethers.formatUnits(cost, 18),
            shares: shares,
            pricePerShare: (Number(priceBP) / 10000).toFixed(4),
            pricePercent: (Number(priceBP) / 100).toFixed(2),
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
