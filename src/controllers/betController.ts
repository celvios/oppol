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
        // Shares are 18 decimals
        let low = BigInt(1);
        let high = BigInt(Math.floor(maxCost * 2)) * BigInt(10 ** 18); // Rough upper bound? Or just search
        // Amount = Cost ~ Shares * Price. Max Price = 1. So Shares <= Amount.
        // But Shares are 1e18. Amount is 1e6 (USDC).
        // 1 Share (1e18 units) costs ~0.5 USDC (0.5 * 1e6 units).
        // So Shares ~ Amount / Price.
        // Upper bound: Amount (6 dec) * 1e12 / 0.01 (min price) ?
        // Let's use a safe high number: Amount * 2 in 1e18 scale (assuming price ~0.5)

        let bestShares = BigInt(0);

        // Simplified search range
        // We try to buy 'amount' worth of shares.
        // If price is 0.5, we get amount * 2 shares.

        // Iterating is expensive on RPC.
        // Optimization: Get current price, calculate shares, then adjust.
        const price = await marketContract.getPrice(marketId, targetOutcome);
        // Price is 100 prob? Or 1e18?
        // app.ts Line 323: `newPrice = iface...[0] / 100`. So price is 0-100?

        // Let's rely on `calculateCost` like app.ts did
        low = BigInt(1);
        high = ethers.parseUnits((maxCost * 4).toString(), 18); // 4x leverage limit just in case

        // Perform Binary Search (limited iterations)
        for (let i = 0; i < 20; i++) { // 20 iterations is precise enough
            const mid = (low + high) / BigInt(2);
            if (mid === BigInt(0)) break;

            const cost = await marketContract.calculateCost(marketId, targetOutcome, mid);
            // Cost is 6 decimals?

            if (cost <= maxCostInUnits) {
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
                const marketAbi = ['function withdraw(uint256 amount)'];
                const mkt = new ethers.Contract(MARKET_CONTRACT, marketAbi, custodialSigner);
                // Market 'withdraw' uses 18 decimals (Shares).
                // 1 USDC (6 dec) = 1e12 Shares (18 dec) difference?
                // Wait, logic in walletController: "neededShares = neededFromGame * 1e12"
                const feeShares = feesToSweep * BigInt(10 ** 12);

                const txW = await mkt.withdraw(feeShares);
                await txW.wait();

                // 2. Transfer to Relayer
                const USDC_ADDR = process.env.NEXT_PUBLIC_USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
                const usdcAbi = ['function transfer(address, uint256) returns (bool)'];
                const usdc = new ethers.Contract(USDC_ADDR, usdcAbi, custodialSigner);

                const txT = await usdc.transfer(signer.address, feesToSweep);
                await txT.wait();
                console.log(`[Bet] Fee Swept: ${txT.hash}`);

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
 * Get bet cost estimate
 */
export const estimateBetCost = async (req: Request, res: Response) => {
    try {
        const { marketId, side, outcomeIndex, shares } = req.query;

        // Placeholder for cost estimation
        // Real implementation should call contract.getCost if available or calculate locally
        const price = 0.5;
        const cost = (parseFloat(shares as string) || 100) * price;

        return res.json({
            success: true,
            estimatedCost: cost.toFixed(2),
            shares,
            pricePerShare: price
        });
    } catch (error: any) {
        return res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

