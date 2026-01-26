import { Request, Response } from 'express';
import { query } from '../config/database';
import { ethers } from 'ethers';

const RPC_URL = process.env.BNB_RPC_URL || 'https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/';
const MARKET_CONTRACT = process.env.MARKET_CONTRACT || '0xe3Eb84D7e271A5C44B27578547f69C80c497355B';
const USDC_ADDRESS = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'; // BSC mainnet USDC

// Contract ABIs
const MARKET_ABI = [
    'function userBalances(address) view returns (uint256)',
];

const ERC20_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function decimals() view returns (uint8)',
];

/**
 * Get comprehensive balance information for a user
 * GET /api/balance/:walletAddress
 */
export const getBalance = async (req: Request, res: Response) => {
    try {
        const { walletAddress } = req.params;
        
        if (!walletAddress) {
            return res.status(400).json({ error: 'Wallet address required' });
        }

        // Look up user by wallet address
        const userResult = await query(
            'SELECT id FROM users WHERE LOWER(wallet_address) = $1',
            [walletAddress.toLowerCase()]
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const userId = userResult.rows[0].id;

        // Get custodial wallet info
        const walletResult = await query(
            'SELECT public_address, balance FROM wallets WHERE user_id = $1',
            [userId]
        );

        if (walletResult.rows.length === 0) {
            return res.status(404).json({ error: 'Custodial wallet not found' });
        }

        const custodialWallet = walletResult.rows[0];

        // Connect to blockchain
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        
        // Get balances from blockchain
        const marketContract = new ethers.Contract(MARKET_CONTRACT, MARKET_ABI, provider);
        const usdcContract = new ethers.Contract(USDC_ADDRESS, ERC20_ABI, provider);

        const [
            depositedBalance,
            walletUsdcBalance,
            connectedWalletUsdcBalance
        ] = await Promise.all([
            marketContract.userBalances(custodialWallet.public_address),
            usdcContract.balanceOf(custodialWallet.public_address),
            usdcContract.balanceOf(walletAddress)
        ]);

        // Format balances
        const depositedFormatted = parseFloat(ethers.formatUnits(depositedBalance, 6));
        const custodialUsdcFormatted = parseFloat(ethers.formatUnits(walletUsdcBalance, 6));
        const connectedUsdcFormatted = parseFloat(ethers.formatUnits(connectedWalletUsdcBalance, 6));
        const dbBalance = parseFloat(custodialWallet.balance || '0');

        return res.json({
            success: true,
            balances: {
                // What user sees in frontend (connected wallet USDC)
                connectedWallet: {
                    address: walletAddress,
                    usdcBalance: connectedUsdcFormatted
                },
                // Custodial wallet balances
                custodialWallet: {
                    address: custodialWallet.public_address,
                    usdcBalance: custodialUsdcFormatted,
                    depositedInContract: depositedFormatted,
                    databaseBalance: dbBalance
                },
                // Summary
                totalAvailableForTrading: depositedFormatted,
                discrepancy: {
                    exists: Math.abs(connectedUsdcFormatted - depositedFormatted) > 0.01,
                    difference: connectedUsdcFormatted - depositedFormatted
                }
            }
        });

    } catch (error: any) {
        console.error('Balance check error:', error);
        return res.status(500).json({
            success: false,
            error: error.message || 'Failed to get balance'
        });
    }
};