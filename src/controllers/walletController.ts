import { Request, Response } from 'express';
import { query } from '../config/database';
import { createRandomWallet } from '../services/web3';
import { EncryptionService } from '../services/encryption';
import { CONFIG } from '../config/contracts';
import { ethers } from 'ethers';
import {
    createPublicClient,
    createWalletClient,
    http,
    encodeFunctionData,
    parseAbi,
    type Address,
    custom
} from 'viem';
import { bsc } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { createSmartAccountClient } from 'permissionless';
import { createPimlicoClient } from 'permissionless/clients/pimlico';
import { toSimpleSmartAccount } from 'permissionless/accounts';
import { entryPoint07Address } from 'viem/account-abstraction';

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

// Export helper to get Smart Account address from a private key (used in authController)
export const getSmartAccountAddressForKey = async (privateKeyHex: string): Promise<string> => {
    const rpcUrl = CONFIG.RPC_URL || 'https://bsc-dataseed.binance.org';
    const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });
    const formattedKey = privateKeyHex.startsWith('0x') ? privateKeyHex as `0x${string}` : `0x${privateKeyHex}` as `0x${string}`;
    const ownerAccount = privateKeyToAccount(formattedKey);
    const smartAccount = await toSimpleSmartAccount({
        client: publicClient,
        owner: ownerAccount,
        entryPoint: { address: entryPoint07Address, version: "0.7" },
    });
    return smartAccount.address;
};

// Helper to build Pimlico Smart Account Client
const getSmartAccountClient = async (privateKeyHex: string) => {
    const rpcUrl = CONFIG.RPC_URL || 'https://bsc-dataseed.binance.org';
    const pimlicoUrl = `https://api.pimlico.io/v2/${CONFIG.CHAIN_ID}/rpc?apikey=${process.env.NEXT_PUBLIC_PIMLICO_API_KEY || process.env.PIMLICO_API_KEY}`;

    const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });

    // Ensure 0x prefix for viem
    const formattedKey = privateKeyHex.startsWith('0x') ? privateKeyHex as `0x${string}` : `0x${privateKeyHex}` as `0x${string}`;
    const ownerAccount = privateKeyToAccount(formattedKey);

    const pimlicoClient = createPimlicoClient({
        transport: http(pimlicoUrl),
        entryPoint: { address: entryPoint07Address, version: "0.7" },
    });

    const smartAccount = await toSimpleSmartAccount({
        client: publicClient,
        owner: ownerAccount,
        entryPoint: { address: entryPoint07Address, version: "0.7" },
    });

    const smartAccountClient = createSmartAccountClient({
        account: smartAccount,
        chain: bsc,
        bundlerTransport: http(pimlicoUrl),
        paymaster: pimlicoClient,
        userOperation: {
            estimateFeesPerGas: async () => {
                return (await pimlicoClient.getUserOperationGasPrice()).fast;
            },
        },
    });

    return { smartAccountClient, pimlicoClient, smartAccountAddress: smartAccount.address, publicClient };
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
        const privateKey = EncryptionService.decrypt(wallet.encrypted_private_key);

        const { smartAccountClient, pimlicoClient, smartAccountAddress } = await getSmartAccountClient(privateKey);
        console.log(`[Deposit] Custodial Smart Account Wallet: ${smartAccountAddress}`);

        const USDC_DECIMALS = 18;
        const depositAmount = ethers.parseUnits(amountRaw, USDC_DECIMALS);

        const USDC_ADDR = CONFIG.USDC_CONTRACT;
        const MARKET_ADDR = process.env.MARKET_CONTRACT || process.env.MULTI_MARKET_ADDRESS;

        if (!USDC_ADDR || !MARKET_ADDR) throw new Error("Missing USDC or MARKET Address");

        // Deduct platform fee (mirrors withdrawal logic)
        const { gasService } = require('../services/gasService');
        const estGas = 100000n;
        const gasFeeUSDC = await gasService.estimateGasCostInUSDC(estGas);
        console.log(`[Deposit] Estimated Platform Fee: ${ethers.formatUnits(gasFeeUSDC, USDC_DECIMALS)} USDC`);

        let netDepositAmount = depositAmount;
        if (depositAmount > gasFeeUSDC) {
            netDepositAmount = depositAmount - gasFeeUSDC;
            console.log(`[Deposit] Deducting Fee. Net deposit to Market: ${ethers.formatUnits(netDepositAmount, USDC_DECIMALS)} USDC`);
        } else {
            console.warn(`[Deposit] Amount too low to cover fee. Proceeding without deduction (platform absorbs cost).`);
        }

        console.log(`[Deposit] Depositing ${ethers.formatUnits(netDepositAmount, 18)} USDC to Market via Pimlico...`);

        const approveData = encodeFunctionData({
            abi: parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]),
            functionName: "approve",
            args: [MARKET_ADDR as Address, depositAmount], // approve full amount (net + fee)
        });

        const depositData = encodeFunctionData({
            abi: parseAbi(["function deposit(uint256 amount)"]),
            functionName: "deposit",
            args: [netDepositAmount],
        });

        const calls: { to: Address; data: `0x${string}` }[] = [
            { to: USDC_ADDR as Address, data: approveData },
            { to: MARKET_ADDR as Address, data: depositData },
        ];

        // Queue fee transfer to treasury if a fee was deducted
        if (depositAmount > gasFeeUSDC) {
            const treasuryAddress = process.env.ADMIN_WALLET || process.env.NEXT_PUBLIC_ADMIN_WALLET;
            if (treasuryAddress) {
                console.log(`[Deposit] Queuing fee transfer (${ethers.formatUnits(gasFeeUSDC, USDC_DECIMALS)} USDC) to Treasury...`);
                const feeTransferData = encodeFunctionData({
                    abi: parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]),
                    functionName: "transfer",
                    args: [treasuryAddress as Address, gasFeeUSDC],
                });
                calls.push({ to: USDC_ADDR as Address, data: feeTransferData });
            }
        }

        console.log(`[Deposit] Sending batched deposit UserOperation (${calls.length} calls)...`);
        const userOpHash = await smartAccountClient.sendUserOperation({ calls });
        console.log(`[Deposit] UserOperation sent! Waiting for confirmation...`);

        const receipt = await pimlicoClient.waitForUserOperationReceipt({ hash: userOpHash });
        const onChainHash = receipt.receipt.transactionHash;

        console.log(`✅ [Deposit] Sweep complete! User ${userId} now has on-chain balance. Hash: ${onChainHash}`);
        return onChainHash;

    } catch (error: any) {
        console.error(`❌ [Deposit] Sweep failed for ${userId}:`, error);
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

        const { smartAccountClient, pimlicoClient, smartAccountAddress, publicClient } = await getSmartAccountClient(privateKey);

        const usdtAbi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];
        const usdt = new ethers.Contract(USDT_ADDR, usdtAbi, provider);

        // Check Smart Account balance (users should now deposit directly here)
        const bal = await usdt.balanceOf(smartAccountAddress);
        const decimals = await usdt.decimals().catch(() => 18);
        console.log(`[Swap] Checking Smart Account ${smartAccountAddress} for USDT... Raw: ${bal}`);

        // Threshold: 0.1 USDT
        if (bal < ethers.parseUnits("0.1", decimals)) {
            console.log(`[Swap] USDT Balance low (${ethers.formatUnits(bal, decimals)}). Skipping.`);
            return;
        }

        console.log(`[Swap] Found ${ethers.formatUnits(bal, decimals)} USDT in Smart Account. Initiating Swap via Router...`);

        const approveData = encodeFunctionData({
            abi: parseAbi(["function approve(address spender, uint256 amount) returns (bool)"]),
            functionName: "approve",
            args: [ROUTER_ADDR as Address, bal],
        });

        const deadline = BigInt(Math.floor(Date.now() / 1000) + 60 * 10); // 10 minutes
        let finalPath = [USDT_ADDR, USDC_ADDR];

        // Ensure we handle BigInt conversions cleanly
        const swapData = encodeFunctionData({
            abi: parseAbi(["function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)"]),
            functionName: "swapExactTokensForTokens",
            args: [bal, BigInt(0), finalPath as Address[], smartAccountAddress as Address, deadline],
        });

        const calls: { to: Address; data: `0x${string}` }[] = [
            { to: USDT_ADDR as Address, data: approveData },
            { to: ROUTER_ADDR as Address, data: swapData },
        ];

        console.log('[Swap] Sending batched swap UserOperation via Pimlico...');
        const userOpHash = await smartAccountClient.sendUserOperation({ calls });
        console.log(`[Swap] UserOperation sent! Waiting for confirmation...`);

        const receipt = await pimlicoClient.waitForUserOperationReceipt({ hash: userOpHash });
        console.log(`[Swap] ✅ Swap Complete. Tx: ${receipt.receipt.transactionHash}`);

    } catch (e: any) {
        console.error('[Swap] Failed:', e);
        throw e; // We want to surface errors now instead of failing silently
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
        try {
            await processCustodialSwap(userId, custodialAddress, privateKey, provider);
        } catch (e: any) {
            // Note: If swap fails for unpredictable reasons, we just log it and see if they have USDC anyway
            console.error("[TriggerDeposit] Swap failed/skipped:", e?.message || e);
            console.error(e);
        }

        // 2. Proceed with Standard USDC Deposit (Using Smart Account balance!)
        const { smartAccountAddress } = await getSmartAccountClient(privateKey);

        const USDC_ADDR = CONFIG.USDC_CONTRACT;
        if (!USDC_ADDR) return res.status(500).json({ success: false, error: 'USDC contract not configured' });

        const usdcAbi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];
        const usdc = new ethers.Contract(USDC_ADDR, usdcAbi, provider);
        const usdcBalanceWei = await usdc.balanceOf(smartAccountAddress);

        let amountBN: bigint = usdcBalanceWei;
        const USDC_DECIMALS = 18;

        // Check minimum (0.01 USDC)
        if (amountBN < ethers.parseUnits("0.01", 18)) {
            // Return success false but with "Swapped" status if we did a swap? 
            // Or just standard "No Balance" if swap failed or produced dust.
            console.log(`[Deposit] Balance too low (${ethers.formatUnits(amountBN, 18)} USDC). Skipping.`);
            return res.json({ success: false, error: 'No USDC balance to deposit', balance: parseFloat(ethers.formatUnits(amountBN, 18)) });
        }

        console.log(`[Deposit] Processing deposit of ${ethers.formatUnits(amountBN, 18)} USDC for ${userId}`);
        const amountStr = ethers.formatUnits(amountBN, 18);

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

        const { smartAccountClient, pimlicoClient, smartAccountAddress, publicClient } = await getSmartAccountClient(privateKey);

        const MARKET_ADDR = process.env.MARKET_CONTRACT || process.env.MULTI_MARKET_ADDRESS;
        const USDC_ADDR = CONFIG.USDC_CONTRACT;
        if (!MARKET_ADDR || !USDC_ADDR) throw new Error("Missing Contract Config");

        const rpcUrl = CONFIG.RPC_URL || 'https://bsc-dataseed.binance.org';
        const provider = new ethers.JsonRpcProvider(rpcUrl);

        const usdcAbi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)'];
        const usdc = new ethers.Contract(USDC_ADDR, usdcAbi, provider);

        const decimals = await usdc.decimals().catch(() => 18n); // Default to 18 if call fails
        console.log(`[Withdraw] USDC Decimals: ${decimals}`);

        const amountUSDC = ethers.parseUnits(amount, Number(decimals)); // Use actual decimals

        // Check Smart Account Wallet Balance
        const walletBalance = await usdc.balanceOf(smartAccountAddress);

        let neededFromGame = 0n;
        if (walletBalance < amountUSDC) {
            neededFromGame = amountUSDC - walletBalance;
        }

        const calls: { to: Address; data: `0x${string}` }[] = [];

        if (neededFromGame > 0n) {
            console.log(`[Withdraw] Queuing withdrawal of ${ethers.formatUnits(neededFromGame, decimals)} USDC from Market...`);

            const withdrawData = encodeFunctionData({
                abi: parseAbi(["function withdraw(uint256 amount)"]),
                functionName: "withdraw",
                args: [neededFromGame],
            });
            calls.push({ to: MARKET_ADDR as Address, data: withdrawData });
        }

        // Calculate backend fee to deduct from the withdrawal
        const { gasService } = require('../services/gasService');
        // We use a flat estimate since Pimlico abstracts the gas, but we still want to charge the user a small fee if we are sponsoring the paymaster.
        const estGas = 100000n;
        const gasFeeUSDC = await gasService.estimateGasCostInUSDC(estGas);
        console.log(`[Withdraw] Estimated Platform Fee: ${ethers.formatUnits(gasFeeUSDC, Number(decimals))} USDC`);

        let netTransferAmount = amountUSDC;
        if (amountUSDC > gasFeeUSDC) {
            netTransferAmount = amountUSDC - gasFeeUSDC;
            console.log(`[Withdraw] Deducting Fee. Net Transfer to User: ${ethers.formatUnits(netTransferAmount, Number(decimals))} USDC`);
        } else {
            console.warn(`[Withdraw] Amount too low to cover fee. Proceeding without deduction (platform absorbs cost).`);
        }

        // Add Transfer call to Destination
        let finalTx = '';
        if (destinationAddress) {
            // We'll calculate the actual required transfer amount based on what they will have vs what they asked for.
            // Assuming the `withdraw` call succeeds, they will have `walletBalance + neededFromGame = amountUSDC`.
            // So we transfer `netTransferAmount`.

            if (netTransferAmount > 0n) {
                console.log(`[Withdraw] Queuing transfer of ${ethers.formatUnits(netTransferAmount, decimals)} USDC to ${destinationAddress}...`);
                const transferData = encodeFunctionData({
                    abi: parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]),
                    functionName: "transfer",
                    args: [destinationAddress as Address, netTransferAmount],
                });
                calls.push({ to: USDC_ADDR as Address, data: transferData });

                // If a fee was deducted, queue a transfer of the fee to the treasury/relayer address
                if (amountUSDC > gasFeeUSDC) {
                    const treasuryAddress = process.env.ADMIN_WALLET || process.env.NEXT_PUBLIC_ADMIN_WALLET;
                    if (treasuryAddress) {
                        console.log(`[Withdraw] Queuing Fee transfer (${ethers.formatUnits(gasFeeUSDC, decimals)} USDC) to Treasury...`);
                        const feeTransferData = encodeFunctionData({
                            abi: parseAbi(["function transfer(address to, uint256 amount) returns (bool)"]),
                            functionName: "transfer",
                            args: [treasuryAddress as Address, gasFeeUSDC],
                        });
                        calls.push({ to: USDC_ADDR as Address, data: feeTransferData });
                    }
                }
            } else {
                console.warn('[Withdraw] No funds to transfer after fees.');
            }
        }

        if (calls.length > 0) {
            console.log(`[Withdraw] Sending batched UserOperation (${calls.length} calls) via Pimlico...`);
            const userOpHash = await smartAccountClient.sendUserOperation({ calls });
            console.log(`[Withdraw] UserOperation sent! Waiting for confirmation...`);

            const receipt = await pimlicoClient.waitForUserOperationReceipt({ hash: userOpHash });
            finalTx = receipt.receipt.transactionHash;
            console.log(`✅ [Withdraw] Complete. Tx: ${finalTx}`);
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

/**
 * POST /api/wallet/claim-custodial
 * Calls claimWinnings(marketId) on-chain from the user's Pimlico Smart Account.
 * Used for Google/Email (custodial) users who cannot sign wallet transactions directly.
 * Body: { privyUserId: string, marketId: number }
 */
export const claimCustodialWinnings = async (req: Request, res: Response) => {
    try {
        const { privyUserId, marketId } = req.body;

        if (!privyUserId || marketId === undefined) {
            return res.status(400).json({ success: false, error: 'privyUserId and marketId are required' });
        }

        console.log(`[CustodialClaim] User ${privyUserId} claiming winnings for market ${marketId}`);

        // 1. Look up user
        const userResult = await query('SELECT id FROM users WHERE privy_user_id = $1', [privyUserId]);
        if (userResult.rows.length === 0) return res.status(404).json({ success: false, error: 'User not found' });
        const userId = userResult.rows[0].id;

        // 2. Get custodial wallet
        const walletResult = await query(
            'SELECT public_address, encrypted_private_key FROM wallets WHERE user_id = $1',
            [userId]
        );
        if (walletResult.rows.length === 0) return res.status(404).json({ success: false, error: 'Custodial wallet not found' });

        const privateKey = EncryptionService.decrypt(walletResult.rows[0].encrypted_private_key);

        // 3. Build Pimlico Smart Account client
        const { smartAccountClient, pimlicoClient, smartAccountAddress } = await getSmartAccountClient(privateKey);

        console.log(`[CustodialClaim] Calling claimWinnings(${marketId}) from Smart Account ${smartAccountAddress}`);

        const MARKET_ADDR = process.env.MARKET_CONTRACT || process.env.MULTI_MARKET_ADDRESS || process.env.NEXT_PUBLIC_MARKET_ADDRESS;
        if (!MARKET_ADDR) throw new Error('Market contract address not configured');

        // 4. Encode claimWinnings call
        const claimData = encodeFunctionData({
            abi: parseAbi(['function claimWinnings(uint256 marketId)']),
            functionName: 'claimWinnings',
            args: [BigInt(marketId)],
        });

        // 5. Send gasless UserOperation via Pimlico
        const userOpHash = await smartAccountClient.sendUserOperation({
            calls: [{ to: MARKET_ADDR as Address, data: claimData }],
        });

        console.log(`[CustodialClaim] UserOperation sent: ${userOpHash}. Waiting for confirmation...`);
        const receipt = await pimlicoClient.waitForUserOperationReceipt({ hash: userOpHash });
        const txHash = receipt.receipt.transactionHash;

        console.log(`✅ [CustodialClaim] Winnings claimed. Tx: ${txHash}`);

        return res.json({
            success: true,
            message: `Winnings claimed for market ${marketId}`,
            txHash,
            marketId,
        });

    } catch (error: any) {
        console.error('[CustodialClaim] Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};
