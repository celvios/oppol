import { Request, Response } from 'express';
import { ethers } from 'ethers';
import { CONFIG } from '../config/contracts';

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || '';
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET || '';
const RPC_URL = process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org/';
const PRIVATE_KEY = process.env.PRIVATE_KEY || '';
const USDC_ADDRESS = CONFIG.USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';

const USDC_ABI = [
    'function transfer(address to, uint256 amount) returns (bool)',
    'function balanceOf(address) view returns (uint256)'
];

/**
 * Server-side fund migration endpoint.
 * Uses Privy REST API to sign and send USDC transfer from embedded wallet.
 * This bypasses the broken client-side key recovery.
 */
export const migrateUserFunds = async (req: Request, res: Response) => {
    const { privyUserId, legacyAddress, custodialAddress } = req.body;

    console.log(`[Migrate] Request: ${privyUserId} | ${legacyAddress} -> ${custodialAddress}`);

    try {
        // Validate inputs
        if (!privyUserId || !legacyAddress || !custodialAddress) {
            return res.status(400).json({ success: false, error: 'Missing required fields: privyUserId, legacyAddress, custodialAddress' });
        }

        if (!ethers.isAddress(legacyAddress) || !ethers.isAddress(custodialAddress)) {
            return res.status(400).json({ success: false, error: 'Invalid wallet address' });
        }

        if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
            console.error(`[Migrate] Missing Privy credentials. App ID: ${!!PRIVY_APP_ID}, Secret: ${!!PRIVY_APP_SECRET}`);
            return res.status(500).json({
                success: false,
                error: `Server not configured. Missing: ${!PRIVY_APP_ID ? 'App ID' : ''} ${!PRIVY_APP_SECRET ? 'App Secret' : ''}`
            });
        }

        // 1. Get user's embedded wallets from Privy API
        console.log('[Migrate] Fetching user wallets from Privy...');
        const authHeader = Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString('base64');

        const userRes = await fetch(`https://api.privy.io/v1/users/${privyUserId}`, {
            method: 'GET',
            headers: {
                'Authorization': `Basic ${authHeader}`,
                'privy-app-id': PRIVY_APP_ID,
                'Content-Type': 'application/json'
            }
        });

        if (!userRes.ok) {
            const errText = await userRes.text();
            console.error('[Migrate] Privy user fetch failed:', userRes.status, errText);
            return res.status(500).json({ success: false, error: `Failed to fetch user from Privy: ${userRes.status}` });
        }

        const userData = await userRes.json();
        console.log('[Migrate] User data received. Looking for embedded wallet...');

        // Find the embedded wallet matching the legacy address
        const linkedAccounts = userData.linked_accounts || [];
        const embeddedWallet = linkedAccounts.find((acc: any) =>
            acc.type === 'wallet' &&
            acc.wallet_client_type === 'privy' &&
            acc.address?.toLowerCase() === legacyAddress.toLowerCase()
        );

        if (!embeddedWallet) {
            console.error('[Migrate] No matching embedded wallet found in Privy user data');
            console.log('[Migrate] Linked accounts:', JSON.stringify(linkedAccounts.map((a: any) => ({
                type: a.type,
                wallet_client_type: a.wallet_client_type,
                address: a.address
            }))));
            return res.status(404).json({ success: false, error: 'Embedded wallet not found for this user' });
        }

        // Log wallet details for debugging
        console.log('[Migrate] Embedded Wallet Details:', JSON.stringify({
            id: embeddedWallet.id,
            address: embeddedWallet.address,
            recovery_method: embeddedWallet.recovery_method,
            chain_type: embeddedWallet.chain_type
        }));

        // The wallet ID might be different from the address
        // Privy uses either wallet address or a specific ID
        const walletId = embeddedWallet.id || embeddedWallet.address;
        console.log(`[Migrate] Found embedded wallet: ${walletId}`);

        // 2. Check USDC balance
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const usdcContract = new ethers.Contract(USDC_ADDRESS, USDC_ABI, provider);
        const balance = await usdcContract.balanceOf(legacyAddress);

        if (balance === 0n) {
            return res.status(400).json({ success: false, error: 'No USDC balance to migrate' });
        }

        console.log(`[Migrate] USDC Balance: ${ethers.formatUnits(balance, 18)}`);

        // 3. Ensure legacy wallet has BNB for gas
        const bnbBalance = await provider.getBalance(legacyAddress);
        console.log(`[Migrate] BNB Balance: ${ethers.formatEther(bnbBalance)}`);

        if (bnbBalance < ethers.parseEther('0.001')) {
            console.log('[Migrate] Sending BNB for gas...');

            if (!PRIVATE_KEY) {
                return res.status(500).json({ success: false, error: 'Admin wallet not configured for gas funding' });
            }

            const adminWallet = new ethers.Wallet(PRIVATE_KEY, provider);
            const gasTx = await adminWallet.sendTransaction({
                to: legacyAddress,
                value: ethers.parseEther('0.002')
            });
            await gasTx.wait();
            console.log(`[Migrate] Gas sent! TX: ${gasTx.hash}`);

            // Wait for propagation
            await new Promise(r => setTimeout(r, 2000));
        }

        // 4. Encode the USDC transfer
        const iface = new ethers.Interface(USDC_ABI);
        const transferData = iface.encodeFunctionData('transfer', [custodialAddress, balance]);

        // 5. Estimate gas (Just for logging, Privy handles it usually or we can pass it if we want strict control)
        const gasEstimate = await provider.estimateGas({
            from: legacyAddress,
            to: USDC_ADDRESS,
            data: transferData
        });

        const feeData = await provider.getFeeData();
        const gasPrice = feeData.gasPrice || ethers.parseUnits('3', 'gwei');
        const nonce = await provider.getTransactionCount(legacyAddress);

        console.log(`[Migrate] Gas estimate: ${gasEstimate}, Gas price: ${gasPrice}, Nonce: ${nonce}`);

        // 6. Sign and send via Privy REST API
        console.log('[Migrate] Sending transaction via Privy API (eth_sendTransaction)...');

        // FIXED PAYLOAD: Using Array for params (Standard JSON-RPC)
        // No top-level caip2. No gasLimit keys.

        const rpcPayload = {
            method: 'eth_sendTransaction',
            params: [
                {
                    to: USDC_ADDRESS,
                    data: transferData,
                    value: '0x0', // Hex string
                    from: legacyAddress
                }
            ]
        };

        const rpcRes = await fetch(`https://api.privy.io/v1/wallets/${walletId}/rpc`, {
            method: 'POST',
            headers: {
                'Authorization': `Basic ${authHeader}`,
                'privy-app-id': PRIVY_APP_ID,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(rpcPayload)
        });

        const rpcData = await rpcRes.json();

        if (!rpcRes.ok) {
            console.error('[Migrate] Privy RPC error:', rpcRes.status, JSON.stringify(rpcData));
            return res.status(500).json({
                success: false,
                error: rpcData.message || rpcData.error || `Privy RPC failed: ${rpcRes.status}`,
                details: rpcData
            });
        }

        console.log('[Migrate] Transaction sent!', rpcData);

        const txHash = rpcData.data?.hash || rpcData.hash || rpcData.data?.transaction_hash || rpcData.result;

        return res.json({
            success: true,
            txHash,
            amount: ethers.formatUnits(balance, 18),
            from: legacyAddress,
            to: custodialAddress,
            message: 'Migration transaction sent successfully!'
        });

    } catch (error: any) {
        console.error('[Migrate] Error:', error);
        return res.status(500).json({ success: false, error: error.message || 'Migration failed' });
    }
};
