import { Request, Response } from 'express';
import { ethers } from 'ethers';
import { CONFIG } from '../config/contracts';

// Rate limiting: Map<address, timestamp>
const lastClaim: Map<string, number> = new Map();
const CLAIM_COOLDOWN = 5 * 60 * 1000; // 5 minutes (Reduced from 24h)
const CLAIM_AMOUNT = '0.002'; // BNB (Enough for ~5-10 transactions)

// Admin Wallet
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://1rpc.io/bnb';
const PRIVATE_KEY = process.env.PRIVATE_KEY;

export const claimFaucet = async (req: Request, res: Response) => {
    const { address } = req.body;
    console.log(`[Faucet] Request received for: ${address}`);

    try {
        if (!address || !ethers.isAddress(address)) {
            console.warn(`[Faucet] Invalid address: ${address}`);
            return res.status(400).json({ success: false, error: 'Invalid wallet address' });
        }

        const userAddress = address.toLowerCase();

        // 1. Check Rate Limit
        const lastTime = lastClaim.get(userAddress);
        if (lastTime) {
            const timeDiff = Date.now() - lastTime;
            const minutesLeft = Math.ceil((CLAIM_COOLDOWN - timeDiff) / 60000);
            if (timeDiff < CLAIM_COOLDOWN) {
                console.warn(`[Faucet] Rate limit hit for ${userAddress}. Wait ${minutesLeft}m.`);
                return res.status(429).json({ success: false, error: `Cooldown active. Try again in ${minutesLeft} minutes.` });
            }
        }

        if (!PRIVATE_KEY) {
            console.error('[Faucet] No PRIVATE_KEY configured');
            return res.status(500).json({ success: false, error: 'Faucet not configured (No Private Key)' });
        }

        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const wallet = new ethers.Wallet(PRIVATE_KEY, provider);

        // Check Admin Balance
        const adminBalance = await provider.getBalance(wallet.address);
        console.log(`[Faucet] Admin balance: ${ethers.formatEther(adminBalance)} BNB`);

        if (adminBalance < ethers.parseEther(CLAIM_AMOUNT)) {
            console.error('[Faucet] Admin wallet empty!');
            return res.status(500).json({ success: false, error: 'Faucet empty. Contact support.' });
        }

        // 2. Check User's USDC/USDT Balance (Anti-Abuse)
        // Only give gas if they have assets to deposit
        // We check USDC (0x8AC...) or USDT (0x55d...)
        const usdcAddress = CONFIG.USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
        const usdcAbi = ['function balanceOf(address) view returns (uint256)'];
        const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, provider);

        // We assume 6 decimals for native USDC, or 18 for binance-peg.
        // Let's just check raw balance > 0
        const usdcBal = await usdcContract.balanceOf(address);

        // Also check USDT just in case
        const usdtAddress = '0x55d398326f99059fF775485246999027B3197955';
        const usdtContract = new ethers.Contract(usdtAddress, usdcAbi, provider);
        const usdtBal = await usdtContract.balanceOf(address);

        console.log(`[Faucet] User Balances - USDC: ${usdcBal.toString()}, USDT: ${usdtBal.toString()}`);

        // Minimum 0.50 tokens required to claim gas
        // 0.50 * 10^18 is a safe check (works for 18 decimals)
        // 0.50 * 10^6 (for 6 decimals) -> 500,000
        const MIN_BALANCE = BigInt(500000); // Works for 6 decimals (0.5 USDC)

        if (usdcBal < MIN_BALANCE && usdtBal < MIN_BALANCE) {
            console.warn(`[Faucet] User ${userAddress} has insufficient tokens.`);
            return res.status(400).json({
                success: false,
                error: 'Insufficient token balance. You need at least 0.50 USDC/USDT to claim gas.'
            });
        }

        // 3. Send BNB
        console.log(`[Faucet] Sending ${CLAIM_AMOUNT} BNB to ${address}...`);

        const tx = await wallet.sendTransaction({
            to: address,
            value: ethers.parseEther(CLAIM_AMOUNT)
        });

        // Update rate limit
        lastClaim.set(userAddress, Date.now());

        console.log(`[Faucet] Sent! Tx: ${tx.hash}`);

        return res.json({
            success: true,
            txHash: tx.hash,
            message: `Sent ${CLAIM_AMOUNT} BNB for gas fees`,
            balance: CLAIM_AMOUNT
        });

    } catch (error: any) {
        console.error('[Faucet] Error:', error);
        return res.status(500).json({ success: false, error: error.message || 'Faucet failed' });
    }
};
