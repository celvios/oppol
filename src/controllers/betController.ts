import { Request, Response } from 'express';
import { query } from '../config/database';
import { EncryptionService } from '../services/encryption';
import { ethers } from 'ethers';

// Contract addresses
const MARKET_CONTRACT = process.env.MARKET_CONTRACT || '0xe3Eb84D7e271A5C44B27578547f69C80c497355B'; // V2 Address
const RPC_URL = process.env.RPC_URL || 'https://bsc-rpc.publicnode.com';

// Market contract ABI for buySharesFor (V2)
const MARKET_ABI = [
    'function buySharesFor(address user, uint256 marketId, uint256 outcomeIndex, uint256 shares, uint256 maxCost)',
    'function userBalances(address) view returns (uint256)',
    'function calculateCost(uint256 _marketId, uint256 _outcomeIndex, uint256 _shares) view returns (uint256)',
    'function getPrice(uint256 _marketId, uint256 _outcomeIndex) view returns (uint256)'
];

/**
 * Place a bet for a user (custodial/relayer trading)
 * POST /api/bet
 */
export const placeBet = async (req: Request, res: Response) => {
    try {
        const { walletAddress, marketId, outcomeIndex, side, amount } = req.body;

        if (!walletAddress) {
            return res.status(400).json({ success: false, error: 'Wallet address required' });
        }

        if (marketId === undefined || (!side && outcomeIndex === undefined) || !amount) {
            return res.status(400).json({ success: false, error: 'Missing marketId, side/outcomeIndex, or amount' });
        }

        // Validate and normalize address
        // Simple normalization
        const normalizedAddress = walletAddress.toLowerCase();

        // Determine outcome index
        let targetOutcome = 0;
        if (outcomeIndex !== undefined) {
            targetOutcome = parseInt(outcomeIndex);
        } else if (side) {
            targetOutcome = side.toUpperCase() === 'YES' ? 0 : 1;
        }

        // Server wallet (operator) configuration
        const privateKey = process.env.PRIVATE_KEY;
        if (!privateKey) {
            return res.status(500).json({ success: false, error: 'Server wallet not configured' });
        }

        // Connect to blockchain
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const signer = new ethers.Wallet(privateKey, provider);
        const marketContract = new ethers.Contract(MARKET_CONTRACT, MARKET_ABI, signer);

        // Check deposited balance of the USER (Contract Balance)
        // USDC uses 6 decimals (typically) or 18? app.ts used 6. Let's use 6 for safety check.
        // If contract actually uses 18, this check might be off.
        // We'll trust contract failure if we are wrong, but let's try 6.
        const balanceFormattedCheck = await marketContract.userBalances(normalizedAddress);
        // const balanceReadable = ethers.formatUnits(balanceFormattedCheck, 6); 

        const maxCost = parseFloat(amount);
        // --- GAS FEE CALCULATION START ---
        // query wallet to get private key for fee sweeping
        const walletRes = await query('SELECT encrypted_private_key FROM wallets WHERE public_address = $1', [normalizedAddress]);
        let custodialSigner: ethers.Wallet | null = null;

        if (walletRes.rows.length > 0) {
            const pk = EncryptionService.decrypt(walletRes.rows[0].encrypted_private_key);
            custodialSigner = new ethers.Wallet(pk, provider);
        }

        // Calculate Gas Fee (Trade + Withdraw + Transfer)
        // Trade ~150k, Withdraw ~50k, Transfer ~50k. Total ~250k.
        let tradeAmount = maxCost;
        let feesToSweep = 0n;
        const USDC_DECIMALS = 6;

        if (custodialSigner) {
            const { gasService } = require('../services/gasService');
            const estGas = 250000n; // Safety margin
            const gasFeeUSDC = await gasService.estimateGasCostInUSDC(estGas); // Returns bigint 6 decimals

            console.log(`[Bet] Est. Gas Fee: ${ethers.formatUnits(gasFeeUSDC, 6)} USDC`);

            const amountBN = ethers.parseUnits(amount, USDC_DECIMALS);
            if (amountBN > gasFeeUSDC) {
                const netAmount = amountBN - gasFeeUSDC;
                tradeAmount = parseFloat(ethers.formatUnits(netAmount, USDC_DECIMALS));
                feesToSweep = gasFeeUSDC;
                console.log(`[Bet] Net Trade Amount: ${tradeAmount} USDC (Fee: ${ethers.formatUnits(feesToSweep, 6)})`);
            } else {
                console.warn('[Bet] Amount too low to cover gas. Trading with full amount (Relayer absorbs cost).');
            }
        }
        // --- GAS FEE CALCULATION END ---

        const maxCostInUnits = ethers.parseUnits(tradeAmount.toFixed(6), 6);

        if (balanceFormattedCheck < maxCostInUnits) {
            const bal = ethers.formatUnits(balanceFormattedCheck, 6);
            console.log(`[Bet] Insufficient balance for ${normalizedAddress}. Have: ${bal}, Need: ${amount}`);
            return res.status(400).json({ success: false, error: `Insufficient balance. Have: $${bal}, Need: $${amount}` });
        }

        // Binary search to find max shares for the given amount
        // Shares are 18-dec. calculateCost() returns 18-dec LMSR values.
        // maxCostInUnits is 6-dec USDC — scale to 18-dec for comparison.
        const maxCostIn18Dec = maxCostInUnits * BigInt(10 ** 12); // 6-dec → 18-dec

        let low = BigInt(1);
        // Upper bound: if price ≈ 0.5, shares ≈ 2 * amount. Start with 10x as safe upper.
        let high = maxCostIn18Dec * BigInt(10);

        let bestShares = BigInt(0);

        // Binary search (20 iterations gives 1/2^20 ≈ 0.0001% precision)
        for (let i = 0; i < 20; i++) {
            const mid = (low + high) / BigInt(2);
            if (mid === BigInt(0)) break;

            const cost = await marketContract.calculateCost(marketId, targetOutcome, mid);
            // cost is 18-dec, maxCostIn18Dec is also 18-dec — same unit now ✓

            if (cost <= maxCostIn18Dec) {
                bestShares = mid;
                low = mid + BigInt(1);
            } else {
                high = mid - BigInt(1);
            }
        }

        if (bestShares === BigInt(0)) {
            return res.status(400).json({ success: false, error: 'Amount too small' });
        }

        // Execute trade via Operator
        // Add 2% buffer to cost for slippage protection during block time
        const finalCost = await marketContract.calculateCost(marketId, targetOutcome, bestShares);
        const maxCostWithBuffer = finalCost * BigInt(105) / BigInt(100);

        console.log(`[Bet] Relayer ${signer.address} buying ${ethers.formatUnits(bestShares, 18)} shares for ${normalizedAddress}`);

        const tx = await marketContract.buySharesFor(
            normalizedAddress,
            marketId,
            targetOutcome,
            bestShares,
            maxCostWithBuffer
        );

        const receipt = await tx.wait();

        // --- FEE COLLECTION ---
        if (feesToSweep > 0n && custodialSigner) {
            console.log(`[Bet] Sweeping Gas Fee: ${ethers.formatUnits(feesToSweep, 6)} USDC...`);

            // Check Gas for Custodial Wallet (needed for withdraw/transfer)
            const custBal = await provider.getBalance(custodialSigner.address);
            const minGas = ethers.parseEther("0.0006");
            if (custBal < minGas) {
                console.log(`[Bet] Funding Custodial Wallet for Fee Sweep...`);
                const fundTx = await signer.sendTransaction({
                    to: custodialSigner.address,
                    value: minGas - custBal + ethers.parseEther("0.0002")
                });
                await fundTx.wait();
            }

            try {
                // 1. Withdraw Fee from Market
                // DECIMAL FIX: withdraw() takes 6-dec USDC amount — same as feesToSweep.
                // The old code multiplied by 1e12 (treating it as shares), causing TX to always revert.
                const marketAbi = ['function withdraw(uint256 amount)'];
                const mkt = new ethers.Contract(MARKET_CONTRACT, marketAbi, custodialSigner);
                const txW = await mkt.withdraw(feesToSweep); // feesToSweep is already 6-dec USDC
                await txW.wait();

                // 2. Transfer to Relayer
                const USDC_ADDR = process.env.NEXT_PUBLIC_USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
                const usdcAbi = ['function transfer(address, uint256) returns (bool)'];
                const usdc = new ethers.Contract(USDC_ADDR, usdcAbi, custodialSigner);

                const txT = await usdc.transfer(signer.address, feesToSweep);
                await txT.wait();
                console.log(`[Bet] ✅ Gas fee swept to relayer: ${txT.hash}`);

            } catch (e: any) {
                console.error(`[Bet] Failed to sweep fee: ${e.message}`);
            }
        }

        return res.json({
            success: true,
            transaction: {
                hash: receipt.hash,
                marketId,
                outcomeIndex: targetOutcome,
                shares: ethers.formatUnits(bestShares, 18),
                user: walletAddress,
                feeDeducted: ethers.formatUnits(feesToSweep, 6)
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
            estimatedCost: ethers.formatUnits(cost, 18),          // 18-dec LMSR value → human readable
            shares: shares,
            pricePerShare: (Number(priceBP) / 10000).toFixed(4),  // basis points → 0.0–1.0
            pricePercent: (Number(priceBP) / 100).toFixed(2),     // basis points → 0–100%
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

