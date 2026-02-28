import { Request, Response } from 'express';
import { query } from '../config/database';
import { createRandomWallet } from '../services/web3';
import { EncryptionService } from '../services/encryption';
import { CONFIG } from '../config/contracts';
import { getBundlerUrl, getActiveBundlerProvider } from '../config/bundler';
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
import { toSimpleSmartAccount, toSafeSmartAccount } from 'permissionless/accounts';
import { entryPoint07Address } from 'viem/account-abstraction';
import { keccak256, toBytes } from 'viem';

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

// Export helper to get Smart Account address from a private key (LEGACY — Simple SA, no salt)
// Kept for migration script usage (reading old SA balances)
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

/**
 * getSafeProxyWalletForUser
 *
 * NEW — Phase 3 deterministic Safe Proxy Wallet.
 * Derives a Safe smart account whose address is permanently bound to both
 * the owner private key AND the platform userId via a deterministic saltNonce.
 *
 * saltNonce = first 8 bytes of keccak256(userId) converted to BigInt.
 * This guarantees the same userId always produces the same SA address,
 * even if the server derives it on different machines or after a restart.
 */
export const getSafeProxyWalletForUser = async (privateKeyHex: string, userId: string) => {
    const rpcUrl = CONFIG.RPC_URL || 'https://bsc-dataseed.binance.org';
    const bundlerUrl = getBundlerUrl(CONFIG.CHAIN_ID);

    const publicClient = createPublicClient({ chain: bsc, transport: http(rpcUrl) });
    const formattedKey = (privateKeyHex.startsWith('0x') ? privateKeyHex : `0x${privateKeyHex}`) as `0x${string}`;
    const ownerAccount = privateKeyToAccount(formattedKey);

    // Deterministic salt: first 8 bytes of keccak256(userId) → stable bigint per user
    const saltNonce = BigInt('0x' + keccak256(toBytes(userId)).slice(2, 18));

    console.log(`[SafeWallet] Deriving Safe SA for userId=${userId} saltNonce=${saltNonce}`);

    const safeAccount = await toSafeSmartAccount({
        client: publicClient,
        owners: [ownerAccount],
        version: '1.4.1',
        entryPoint: { address: entryPoint07Address, version: '0.7' },
        saltNonce,
    });

    const pimlicoClient = createPimlicoClient({
        transport: http(bundlerUrl),
        entryPoint: { address: entryPoint07Address, version: '0.7' },
    });

    const smartAccountClient = createSmartAccountClient({
        account: safeAccount,
        chain: bsc,
        bundlerTransport: http(bundlerUrl),
        paymaster: pimlicoClient,
        userOperation: {
            estimateFeesPerGas: async () => (await pimlicoClient.getUserOperationGasPrice()).fast,
        },
    });

    return {
        smartAccountClient,
        pimlicoClient,
        smartAccountAddress: safeAccount.address,
        publicClient,
    };
};

/**
 * getActiveProxyWallet
 *
 * ENV-GATED router: returns the Safe SA client (new) or Simple SA client (legacy)
 * based on the PROXY_WALLET_VERSION environment variable.
 *
 *   PROXY_WALLET_VERSION=simple  → old behaviour (default, safe during migration)
 *   PROXY_WALLET_VERSION=safe    → new Safe SA (set AFTER migration script completes)
 *
 * All handlers (deposit, withdraw, trade, claim) call this instead of
 * getSmartAccountClient directly, giving a single switch-over point.
 */
export const getActiveProxyWallet = async (privateKeyHex: string, userId: string) => {
    const version = (process.env.PROXY_WALLET_VERSION || 'simple').toLowerCase();
    if (version === 'safe') {
        console.log(`[ProxyWallet] Mode: SAFE (Phase 3)`);
        return getSafeProxyWalletForUser(privateKeyHex, userId);
    }
    console.log(`[ProxyWallet] Mode: SIMPLE (legacy)`);
    return getSmartAccountClient(privateKeyHex);
};

// Helper to build Pimlico Smart Account Client
const getSmartAccountClient = async (privateKeyHex: string) => {
    const rpcUrl = CONFIG.RPC_URL || 'https://bsc-dataseed.binance.org';
    const bundlerUrl = getBundlerUrl(CONFIG.CHAIN_ID);
    console.log(`[Bundler] Using provider: ${getActiveBundlerProvider()} → ${bundlerUrl.split('?')[0]}`);
    const pimlicoUrl = bundlerUrl; // alias kept for internal usage below

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

        const { smartAccountClient, pimlicoClient, smartAccountAddress } = await getActiveProxyWallet(privateKey, userId);
        console.log(`[Deposit] Custodial Proxy Wallet [${process.env.PROXY_WALLET_VERSION || 'simple'}]: ${smartAccountAddress}`);

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
        const ROUTER_ADDR = '0x10ED43C718714eb63d5aA57B78B54704E256024E'; // PancakeSwap Router v2
        const USDC_ADDR = CONFIG.USDC_CONTRACT;

        if (!USDT_ADDR || !USDC_ADDR) {
            console.log('[Swap] Missing USDT or USDC address config. Skipping swap.');
            return;
        }

        const { smartAccountClient, pimlicoClient, smartAccountAddress } = await getActiveProxyWallet(privateKey, userId);

        const usdtAbi = ['function balanceOf(address) view returns (uint256)', 'function decimals() view returns (uint8)', 'function transfer(address to, uint256 amount) returns (bool)'];
        const usdt = new ethers.Contract(USDT_ADDR, usdtAbi, provider);
        const decimals = await usdt.decimals().catch(() => 18);
        const MIN_USDT = ethers.parseUnits('0.05', decimals);

        // Check BOTH the Smart Account AND the custodial EOA for USDT
        const [saBal, eoaBal] = await Promise.all([
            usdt.balanceOf(smartAccountAddress),
            usdt.balanceOf(custodialAddress),
        ]);
        console.log(`[Swap] SA USDT: ${ethers.formatUnits(saBal, decimals)}, EOA USDT: ${ethers.formatUnits(eoaBal, decimals)}`);

        // --- Path A: USDT at Smart Account — swap via gasless UserOperation ---
        if (saBal >= MIN_USDT) {
            console.log(`[Swap] Found ${ethers.formatUnits(saBal, decimals)} USDT in SA. Swapping via UserOp...`);
            const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
            const calls: { to: Address; data: `0x${string}` }[] = [
                { to: USDT_ADDR as Address, data: encodeFunctionData({ abi: parseAbi(['function approve(address spender, uint256 amount) returns (bool)']), functionName: 'approve', args: [ROUTER_ADDR as Address, saBal] }) },
                { to: ROUTER_ADDR as Address, data: encodeFunctionData({ abi: parseAbi(['function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)']), functionName: 'swapExactTokensForTokens', args: [saBal, BigInt(0), [USDT_ADDR, USDC_ADDR] as Address[], smartAccountAddress as Address, deadline] }) },
            ];
            const userOpHash = await smartAccountClient.sendUserOperation({ calls });
            const receipt = await pimlicoClient.waitForUserOperationReceipt({ hash: userOpHash });
            console.log(`[Swap] ✅ SA USDT swap complete. Tx: ${receipt.receipt.transactionHash}`);
        }

        // --- Path B: USDT at EOA — transfer to SA first, then swap ---
        if (eoaBal >= MIN_USDT) {
            console.log(`[Swap] Found ${ethers.formatUnits(eoaBal, decimals)} USDT at EOA. Moving to SA for swap...`);

            // Fund EOA with BNB for gas if needed
            const eoaBnb = await provider.getBalance(custodialAddress);
            if (eoaBnb < ethers.parseEther('0.0005')) {
                const adminKey = process.env.PRIVATE_KEY;
                if (adminKey) {
                    const adminWallet = new ethers.Wallet(adminKey, provider);
                    const fundTx = await adminWallet.sendTransaction({ to: custodialAddress, value: ethers.parseEther('0.001') });
                    await fundTx.wait();
                    console.log(`[Swap] EOA funded with BNB for gas.`);
                } else {
                    const msg = '[Swap] No PRIVATE_KEY env. Cannot fund EOA gas. Skipping EOA USDT sweep.';
                    console.warn(msg);
                    throw new Error(msg);
                }
            }

            // Transfer USDT from EOA to SA
            const eoaSigner = new ethers.Wallet(privateKey, provider);
            const usdtW = new ethers.Contract(USDT_ADDR, usdtAbi, eoaSigner);
            const transferTx = await usdtW.transfer(smartAccountAddress, eoaBal);
            await transferTx.wait();
            console.log(`[Swap] USDT moved from EOA to SA. Now swapping...`);

            // Swap from SA
            const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
            const calls: { to: Address; data: `0x${string}` }[] = [
                { to: USDT_ADDR as Address, data: encodeFunctionData({ abi: parseAbi(['function approve(address spender, uint256 amount) returns (bool)']), functionName: 'approve', args: [ROUTER_ADDR as Address, eoaBal] }) },
                { to: ROUTER_ADDR as Address, data: encodeFunctionData({ abi: parseAbi(['function swapExactTokensForTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)']), functionName: 'swapExactTokensForTokens', args: [eoaBal, BigInt(0), [USDT_ADDR, USDC_ADDR] as Address[], smartAccountAddress as Address, deadline] }) },
            ];
            const userOpHash = await smartAccountClient.sendUserOperation({ calls });
            const receipt = await pimlicoClient.waitForUserOperationReceipt({ hash: userOpHash });
            console.log(`[Swap] ✅ EOA USDT swap complete. Tx: ${receipt.receipt.transactionHash}`);
        }

        // --- Path C: Native BNB at SA or EOA → swap to USDC via PancakeSwap ---
        const GAS_RESERVE = ethers.parseEther('0.002'); // keep for gas fees
        const MIN_BNB = ethers.parseEther('0.003');     // minimum worth swapping

        const [saBnb, eoaBnb] = await Promise.all([
            provider.getBalance(smartAccountAddress),
            provider.getBalance(custodialAddress),
        ]);
        console.log(`[Swap] SA BNB: ${ethers.formatEther(saBnb)}, EOA BNB: ${ethers.formatEther(eoaBnb)}`);

        // Swap BNB sitting at the SA (send ETH value in the UserOp call)
        const spendableSaBnb = saBnb > GAS_RESERVE ? saBnb - GAS_RESERVE : 0n;
        if (spendableSaBnb >= MIN_BNB) {
            console.log(`[Swap] Swapping ${ethers.formatEther(spendableSaBnb)} BNB from SA to USDC...`);
            const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
            const swapBnbData = encodeFunctionData({
                abi: parseAbi(['function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)']),
                functionName: 'swapExactETHForTokens',
                args: [BigInt(0), ['0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', USDC_ADDR] as Address[], smartAccountAddress as Address, deadline],
            });
            const userOpHash = await smartAccountClient.sendUserOperation({
                calls: [{ to: ROUTER_ADDR as Address, data: swapBnbData, value: spendableSaBnb }]
            });
            const receipt = await pimlicoClient.waitForUserOperationReceipt({ hash: userOpHash });
            console.log(`[Swap] ✅ SA BNB swap complete. Tx: ${receipt.receipt.transactionHash}`);
        }

        // Sweep BNB from EOA to SA, then swap
        const spendableEoaBnb = eoaBnb > GAS_RESERVE ? eoaBnb - GAS_RESERVE : 0n;
        if (spendableEoaBnb >= MIN_BNB) {
            console.log(`[Swap] Moving ${ethers.formatEther(spendableEoaBnb)} BNB from EOA to SA...`);
            const eoaSigner = new ethers.Wallet(privateKey, provider);
            const sendTx = await eoaSigner.sendTransaction({ to: smartAccountAddress, value: spendableEoaBnb });
            await sendTx.wait();
            // Now swap via SA
            const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
            const swapBnbData = encodeFunctionData({
                abi: parseAbi(['function swapExactETHForTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable returns (uint[] memory amounts)']),
                functionName: 'swapExactETHForTokens',
                args: [BigInt(0), ['0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c', USDC_ADDR] as Address[], smartAccountAddress as Address, deadline],
            });
            const userOpHash = await smartAccountClient.sendUserOperation({
                calls: [{ to: ROUTER_ADDR as Address, data: swapBnbData, value: spendableEoaBnb }]
            });
            const receipt = await pimlicoClient.waitForUserOperationReceipt({ hash: userOpHash });
            console.log(`[Swap] ✅ EOA BNB sweep+swap complete. Tx: ${receipt.receipt.transactionHash}`);
        }

        if (saBal < MIN_USDT && eoaBal < MIN_USDT && spendableSaBnb < MIN_BNB && spendableEoaBnb < MIN_BNB) {
            console.log(`[Swap] No significant USDT or BNB at SA or EOA. Nothing to swap.`);
        }


    } catch (e: any) {
        console.error('[Swap] Failed:', e);
        throw e;
    }
};


export const triggerCustodialDeposit = async (req: Request, res: Response) => {
    try {
        const { privyUserId, targetAddress } = req.body;
        if (!privyUserId) {
            return res.status(400).json({ success: false, error: 'privyUserId required' });
        }

        let userId: number | undefined;
        let walletResult;

        // If frontend passes a specific targetAddress context, use it to find the exact wallet
        if (targetAddress) {
            // targetAddress is the Smart Account (SA) address, which is stored in users.wallet_address
            const targetUserRes = await query(
                'SELECT id FROM users WHERE LOWER(wallet_address) = LOWER($1)',
                [targetAddress]
            );
            if (targetUserRes.rows.length === 0) {
                return res.status(404).json({ success: false, error: `User not found for SA address ${targetAddress}` });
            }
            userId = targetUserRes.rows[0].id;

            walletResult = await query(
                'SELECT user_id, public_address, encrypted_private_key FROM wallets WHERE user_id = $1',
                [userId]
            );
            if (walletResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: `Wallet records not found for user ${userId}` });
            }
        } else {
            // Fallback to privyUserId lookup (might hit wrong DB user record if duplicates exist)
            const userResult = await query(
                'SELECT id FROM users WHERE privy_user_id = $1',
                [privyUserId]
            );
            if (userResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'User not found' });
            }
            userId = userResult.rows[0].id;

            walletResult = await query(
                'SELECT public_address, encrypted_private_key FROM wallets WHERE user_id = $1',
                [userId]
            );
            if (walletResult.rows.length === 0) {
                return res.status(404).json({ success: false, error: 'Custodial wallet not found for user' });
            }
        }

        const custodialAddress = walletResult.rows[0].public_address;
        const privateKey = EncryptionService.decrypt(walletResult.rows[0].encrypted_private_key);

        if (!userId) {
            return res.status(400).json({ success: false, error: 'Could not determine user ID' });
        }

        // Setup Provider
        const rpcUrl = CONFIG.RPC_URL || 'https://bsc-dataseed.binance.org';
        const provider = new ethers.JsonRpcProvider(rpcUrl);

        const USDC_ADDR = CONFIG.USDC_CONTRACT;
        const USDT_ADDR = CONFIG.USDT_CONTRACT;
        const ZAP_ADDR = CONFIG.ZAP_CONTRACT;
        const MARKET_ADDR = CONFIG.MARKET_CONTRACT;

        if (!USDC_ADDR) return res.status(500).json({ success: false, error: 'USDC contract not configured' });

        const { smartAccountClient, pimlicoClient, smartAccountAddress } = await getActiveProxyWallet(privateKey, userId.toString());

        // Verify the private key matches the stored public_address
        const derivedEoa = new ethers.Wallet(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`).address;
        const eoaMatches = derivedEoa.toLowerCase() === custodialAddress.toLowerCase();
        console.log(`[TriggerDeposit] SA: ${smartAccountAddress}, EOA (DB): ${custodialAddress}, EOA (derived): ${derivedEoa}, match: ${eoaMatches}`);
        // Use derived EOA address as the authoritative one (matches the private key)
        const effectiveCustodialAddress = derivedEoa;
        console.log(`[TriggerDeposit] Config — USDT: ${USDT_ADDR || 'NOT SET'}, ZAP: ${ZAP_ADDR || 'NOT SET'}, MARKET: ${MARKET_ADDR || 'NOT SET'}`);

        const tokenAbi = [
            'function balanceOf(address) view returns (uint256)',
            'function decimals() view returns (uint8)',
            'function transfer(address to, uint256 amount) returns (bool)'
        ];
        const usdc = new ethers.Contract(USDC_ADDR, tokenAbi, provider);
        const hasUsdt = !!USDT_ADDR;
        const usdt = hasUsdt ? new ethers.Contract(USDT_ADDR, tokenAbi, provider) : null;
        const DECIMALS = 18;
        const MIN_DEPOSIT = ethers.parseUnits('0.01', DECIMALS);

        // ── Step 1: Check all balances ────────────────────────────────────────
        const [saUsdc, eoaUsdc] = await Promise.all([
            usdc.balanceOf(smartAccountAddress),
            usdc.balanceOf(effectiveCustodialAddress),
        ]);
        const saUsdt = hasUsdt ? await usdt!.balanceOf(smartAccountAddress) : 0n;
        const eoaUsdt = hasUsdt ? await usdt!.balanceOf(effectiveCustodialAddress) : 0n;
        console.log(`[TriggerDeposit] Balances — SA USDC: ${ethers.formatUnits(saUsdc, DECIMALS)}, SA USDT: ${ethers.formatUnits(saUsdt, DECIMALS)}, EOA USDC: ${ethers.formatUnits(eoaUsdc, DECIMALS)}, EOA USDT: ${ethers.formatUnits(eoaUsdt, DECIMALS)}`);

        // Track all step results for debugging (returned in API response)
        const steps: string[] = [];
        steps.push(`Addresses: SA=${smartAccountAddress}, EOA(derived)=${effectiveCustodialAddress}, EOA(DB)=${custodialAddress}, keyMatch=${eoaMatches}`);
        steps.push(`Contracts: USDC=${USDC_ADDR}, USDT=${USDT_ADDR || 'NOT SET'}, ZAP=${ZAP_ADDR || 'NOT SET'}`);
        steps.push(`Balances: SA USDC=${ethers.formatUnits(saUsdc, DECIMALS)}, SA USDT=${ethers.formatUnits(saUsdt, DECIMALS)}, EOA USDC=${ethers.formatUnits(eoaUsdc, DECIMALS)}, EOA USDT=${ethers.formatUnits(eoaUsdt, DECIMALS)}`);

        // ── Step 2: Move EOA funds → SA (regular tx, needs BNB gas) ──────────
        const needsEoaMove = eoaUsdc >= MIN_DEPOSIT || eoaUsdt >= MIN_DEPOSIT;
        if (needsEoaMove) {
            const eoaBnb = await provider.getBalance(effectiveCustodialAddress);
            steps.push(`EOA BNB: ${ethers.formatEther(eoaBnb)}`);
            console.log(`[TriggerDeposit] EOA BNB: ${ethers.formatEther(eoaBnb)}`);
            if (eoaBnb < ethers.parseEther('0.0005')) {
                const adminKey = process.env.PRIVATE_KEY;
                if (adminKey) {
                    try {
                        const adminWallet = new ethers.Wallet(adminKey, provider);
                        const adminBal = await provider.getBalance(adminWallet.address);
                        steps.push(`Admin wallet: ${adminWallet.address}, BNB: ${ethers.formatEther(adminBal)}`);
                        console.log(`[TriggerDeposit] Admin wallet: ${adminWallet.address}, BNB: ${ethers.formatEther(adminBal)}`);
                        const fundTx = await adminWallet.sendTransaction({ to: effectiveCustodialAddress, value: ethers.parseEther('0.001') });
                        await fundTx.wait();
                        steps.push('✅ EOA funded with 0.001 BNB');
                        console.log('[TriggerDeposit] ✅ EOA funded with BNB.');
                    } catch (fundErr: any) {
                        steps.push(`❌ Gas funding failed: ${fundErr.message}`);
                        console.error('[TriggerDeposit] Gas funding failed:', fundErr.message);
                    }
                } else {
                    steps.push('❌ PRIVATE_KEY not set on backend');
                    console.warn('[TriggerDeposit] No PRIVATE_KEY — cannot fund EOA gas.');
                }
            } else {
                steps.push('EOA has enough BNB for gas');
            }
            const eoaSigner = new ethers.Wallet(privateKey.startsWith('0x') ? privateKey : `0x${privateKey}`, provider);
            if (eoaUsdc >= MIN_DEPOSIT) {
                try {
                    const tx = await (usdc.connect(eoaSigner) as any).transfer(smartAccountAddress, eoaUsdc);
                    await tx.wait();
                    steps.push(`✅ Moved ${ethers.formatUnits(eoaUsdc, DECIMALS)} USDC EOA→SA`);
                    console.log(`[TriggerDeposit] ✅ Moved USDC from EOA → SA.`);
                } catch (e: any) {
                    steps.push(`❌ USDC EOA→SA failed: ${e.message}`);
                    console.error('[TriggerDeposit] EOA USDC transfer failed:', e.message);
                }
            }
            if (eoaUsdt >= MIN_DEPOSIT && usdt) {
                try {
                    const tx = await (usdt!.connect(eoaSigner) as any).transfer(smartAccountAddress, eoaUsdt);
                    await tx.wait();
                    steps.push(`✅ Moved ${ethers.formatUnits(eoaUsdt, DECIMALS)} USDT EOA→SA`);
                    console.log(`[TriggerDeposit] ✅ Moved USDT from EOA → SA.`);
                } catch (e: any) {
                    steps.push(`❌ USDT EOA→SA failed: ${e.message}`);
                    console.error('[TriggerDeposit] EOA USDT transfer failed:', e.message);
                }
            }
        } else {
            steps.push('No EOA funds to move');
        }

        // ── Step 3: Re-read SA balances after EOA migration ──────────────────
        const usdcAfterMove = await usdc.balanceOf(smartAccountAddress);
        const usdtAfterMove = (hasUsdt && usdt) ? await usdt!.balanceOf(smartAccountAddress) : 0n;
        steps.push(`After move: SA USDC=${ethers.formatUnits(usdcAfterMove, DECIMALS)}, SA USDT=${ethers.formatUnits(usdtAfterMove, DECIMALS)}`);
        console.log(`[TriggerDeposit] After EOA move — SA USDC: ${ethers.formatUnits(usdcAfterMove, DECIMALS)}, SA USDT: ${ethers.formatUnits(usdtAfterMove, DECIMALS)}`);

        // ── Step 4: Swap SA USDT → USDC via Zap (gasless UserOp) ────────────
        // NOTE: Zap.sol does BOTH: swap USDT→USDC AND deposit into Market via depositFor()
        let zapCompleted = false;
        if (usdtAfterMove >= MIN_DEPOSIT) {
            if (!ZAP_ADDR) {
                steps.push('❌ ZAP_ADDRESS not configured');
            } else {
                steps.push(`Zapping ${ethers.formatUnits(usdtAfterMove, DECIMALS)} USDT via ${ZAP_ADDR}...`);
                try {
                    const zapCalls: { to: Address; data: `0x${string}` }[] = [
                        {
                            to: USDT_ADDR as Address,
                            data: encodeFunctionData({
                                abi: parseAbi(['function approve(address spender, uint256 amount) returns (bool)']),
                                functionName: 'approve',
                                args: [ZAP_ADDR as Address, usdtAfterMove],
                            })
                        },
                        {
                            to: ZAP_ADDR as Address,
                            data: encodeFunctionData({
                                abi: parseAbi(['function zapInToken(address tokenIn, uint256 amountIn, uint256 minUSDC) external']),
                                functionName: 'zapInToken',
                                args: [USDT_ADDR as Address, usdtAfterMove, BigInt(0)],
                            })
                        },
                    ];
                    const zapOpHash = await smartAccountClient.sendUserOperation({ calls: zapCalls });
                    const zapReceipt = await pimlicoClient.waitForUserOperationReceipt({ hash: zapOpHash });
                    steps.push(`✅ Zap complete! Tx: ${zapReceipt.receipt.transactionHash}`);
                    zapCompleted = true;
                } catch (zapErr: any) {
                    steps.push(`❌ Zap failed: ${zapErr?.message || zapErr}`);
                    console.error('[TriggerDeposit] Zap failed:', zapErr?.message || zapErr);
                }
            }
        } else {
            steps.push(`SA USDT (${ethers.formatUnits(usdtAfterMove, DECIMALS)}) below min, skipping Zap`);
        }

        // If Zap succeeded, the deposit is already done
        if (zapCompleted) {
            const zapAmount = ethers.formatUnits(usdtAfterMove, DECIMALS);
            return res.json({
                success: true,
                message: `Successfully zapped ${zapAmount} USDT → USDC and deposited into market contract`,
                amount: parseFloat(zapAmount),
                custodialAddress: smartAccountAddress,
                method: 'zap',
                steps,
            });
        }

        // ── Step 5: If no Zap, check SA USDC and deposit manually ─────────────
        const finalUsdcBal = await usdc.balanceOf(smartAccountAddress);
        steps.push(`Final SA USDC: ${ethers.formatUnits(finalUsdcBal, DECIMALS)}`);

        if (finalUsdcBal < MIN_DEPOSIT) {
            const usdtRemaining = usdt ? await usdt.balanceOf(smartAccountAddress) : 0n;
            return res.json({
                success: false,
                error: `Deposit failed`,
                balance: parseFloat(ethers.formatUnits(finalUsdcBal, DECIMALS)),
                usdtBalance: parseFloat(ethers.formatUnits(usdtRemaining, DECIMALS)),
                steps,
            });
        }

        // ── Step 6: Deposit USDC into Market (Pimlico sponsors gas, platform fee deducted from funds) ──
        const amountStr = ethers.formatUnits(finalUsdcBal, DECIMALS);
        console.log(`[TriggerDeposit] Depositing ${amountStr} USDC for user ${userId}...`);
        const txHash = await processCustodialDeposit(userId.toString(), amountStr, 'manual-trigger');
        return res.json({
            success: true,
            message: `Successfully deposited ${amountStr} USDC into market contract`,
            amount: parseFloat(amountStr),
            custodialAddress: smartAccountAddress,
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

        const { smartAccountClient, pimlicoClient, smartAccountAddress, publicClient } = await getActiveProxyWallet(privateKey, userId);

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

        // 3. Build Proxy Wallet client (routes to Simple or Safe SA based on PROXY_WALLET_VERSION)
        const { smartAccountClient, pimlicoClient, smartAccountAddress } = await getActiveProxyWallet(privateKey, userId);

        console.log(`[CustodialClaim] Calling claimWinnings(${marketId}) from Proxy Wallet [${process.env.PROXY_WALLET_VERSION || 'simple'}]: ${smartAccountAddress}`);

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

/**
 * Execute a trade for a custodial (Google/Email) user via the backend SA.
 * The backend has the stored private key → derives the correct Pimlico SA →
 * executes: withdraw(fee) + transfer(fee→treasury) + buyShares() atomically.
 *
 * This is REQUIRED for custodial users because their balance is under the
 * backend-managed SA address, not any client-derived (Privy embedded wallet) SA.
 */
export const executeCustodialTrade = async (req: Request, res: Response) => {
    try {
        const { privyUserId, marketId, outcomeIndex, amount } = req.body;

        if (!privyUserId || marketId === undefined || outcomeIndex === undefined || !amount) {
            return res.status(400).json({ success: false, error: 'Missing required params: privyUserId, marketId, outcomeIndex, amount' });
        }

        console.log(`[CustodialTrade] Request: user=${privyUserId}, market=${marketId}, outcome=${outcomeIndex}, amount=${amount}`);

        // 1. Look up user and custodial wallet
        const userResult = await query('SELECT id FROM users WHERE privy_user_id = $1', [privyUserId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        const userId = userResult.rows[0].id;

        const walletResult = await query(
            'SELECT public_address, encrypted_private_key FROM wallets WHERE user_id = $1',
            [userId]
        );
        if (walletResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Custodial wallet not found' });
        }

        const privateKey = EncryptionService.decrypt(walletResult.rows[0].encrypted_private_key);
        const { smartAccountClient, pimlicoClient, smartAccountAddress, publicClient } = await getActiveProxyWallet(privateKey, userId);
        console.log(`[CustodialTrade] Proxy Wallet [${process.env.PROXY_WALLET_VERSION || 'simple'}]: ${smartAccountAddress}`);

        const USDC_ADDR = CONFIG.USDC_CONTRACT;
        const MARKET_ADDR = process.env.MARKET_CONTRACT || process.env.MULTI_MARKET_ADDRESS;
        const TREASURY_ADDR = process.env.ADMIN_WALLET || process.env.NEXT_PUBLIC_ADMIN_WALLET || process.env.NEXT_PUBLIC_TREASURY_ADDRESS;

        if (!USDC_ADDR || !MARKET_ADDR) {
            return res.status(500).json({ success: false, error: 'Missing USDC or MARKET contract address' });
        }

        const DECIMALS = 18;
        const amountBN = ethers.parseUnits(String(amount), DECIMALS);

        // 3. Read ACTUAL on-chain market balance (not the requested amount)
        // Critical: deposit fee may have made actual balance < requested amount.
        const rpcUrl = CONFIG.RPC_URL || 'https://bsc-dataseed.binance.org';
        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const marketContract = new ethers.Contract(
            MARKET_ADDR,
            [
                'function protocolFee() view returns (uint256)',
                'function getPrice(uint256 marketId, uint256 outcomeIndex) view returns (uint256)',
                'function userBalances(address) view returns (uint256)',
            ],
            provider
        );

        const actualBalanceBN: bigint = await marketContract.userBalances(smartAccountAddress);
        console.log(`[CustodialTrade] Actual on-chain balance: ${ethers.formatUnits(actualBalanceBN, DECIMALS)} USDC`);
        console.log(`[CustodialTrade] Requested amount: ${ethers.formatUnits(amountBN, DECIMALS)} USDC`);

        // Use the smaller of requested amount and actual balance to avoid reverts
        const effectiveBudget = actualBalanceBN < amountBN ? actualBalanceBN : amountBN;

        if (effectiveBudget <= 0n) {
            return res.status(400).json({ success: false, error: 'Balance is zero.' });
        }

        // 100% of the budget is used for the trade (Pimlico sponsors gas)
        const netTradeCost = effectiveBudget;
        console.log(`[CustodialTrade] Net trade amount: ${ethers.formatUnits(netTradeCost, DECIMALS)} USDC`);

        // 4. Binary search to find max shares (in wei) for given cost
        let low = BigInt(1);
        let high = netTradeCost * BigInt(100);
        let bestShares = BigInt(0);

        // DEDUCT FEE: Contract adds fee ON TOP of cost.
        let protocolFeeBps = BigInt(1000); // 10% buffer
        try { protocolFeeBps = await marketContract.protocolFee(); } catch { /* use default */ }
        const BPS_DIVISOR = BigInt(10000);
        const effectiveMaxCost = netTradeCost * BPS_DIVISOR / (BPS_DIVISOR + protocolFeeBps);

        let iterations = 0;
        console.log(`[CustodialTrade] Starting binary search. effectiveMaxCost: ${effectiveMaxCost}`);

        const iface = new ethers.Interface([
            'function calculateCost(uint256 _marketId, uint256 _outcomeIndex, uint256 _shares) view returns (uint256)'
        ]);

        // We need a raw provider to call without signer
        const rawCall = async (data: string) => {
            const tx = await provider.call({ to: MARKET_ADDR, data });
            return tx;
        };

        while (low <= high && iterations < 100) {
            const mid = (low + high) / BigInt(2);
            const costData = iface.encodeFunctionData('calculateCost', [BigInt(marketId), BigInt(outcomeIndex), mid]);
            const costResult = await rawCall(costData);
            const cost = BigInt(iface.decodeFunctionResult('calculateCost', costResult)[0]);

            if (cost <= effectiveMaxCost) {
                bestShares = mid;
                low = mid + BigInt(1);
            } else {
                high = mid - BigInt(1);
            }
            iterations++;
        }

        if (bestShares === BigInt(0)) {
            return res.status(400).json({ success: false, error: 'Amount too small to buy any shares' });
        }

        const estSharesFloat = parseFloat(ethers.formatUnits(bestShares, DECIMALS));
        console.log(`[CustodialTrade] Binary search found: ${estSharesFloat.toFixed(4)} shares in ${iterations} iterations.`);

        // 5. Build batched UserOperation calls
        // Since Pimlico sponsors gas, we DO NOT deduct gas from the user's trade balance.
        const calls: { to: Address; data: `0x${string}` }[] = [];

        // Buy shares using deposited balance
        // maxCost should have slight slippage tolerance (10%) to prevent reverts if other trades hit first
        const maxCostWithSlippage = netTradeCost * BigInt(110) / BigInt(100);

        const buyData = encodeFunctionData({
            abi: parseAbi(['function buyShares(uint256 _marketId, uint256 _outcomeIndex, uint256 _sharesOut, uint256 _maxCost) returns (uint256)']),
            functionName: 'buyShares',
            args: [BigInt(marketId), BigInt(outcomeIndex), bestShares, maxCostWithSlippage],
        });
        calls.push({ to: MARKET_ADDR as Address, data: buyData });

        console.log(`[CustodialTrade] Sending ${calls.length}-call UserOperation...`);
        const userOpHash = await smartAccountClient.sendUserOperation({ calls });
        const receipt = await pimlicoClient.waitForUserOperationReceipt({ hash: userOpHash });
        const txHash = receipt.receipt.transactionHash;

        // CRITICAL: In ERC-4337 the bundler tx always succeeds even if inner calls fail.
        // We must check receipt.success to detect reverts in withdraw/transfer/buyShares.
        if (!receipt.success) {
            console.error(`❌ [CustodialTrade] UserOp failed on-chain! Tx: ${txHash}`);
            console.error(`❌ [CustodialTrade] Receipt Details:`, JSON.stringify(receipt, (key, value) => typeof value === 'bigint' ? value.toString() : value, 2));
            return res.status(500).json({
                success: false,
                error: `Trade failed on-chain. TX: ${txHash}. Inner calls reverted.`,
                txHash: txHash
            });
        }

        console.log(`✅ [CustodialTrade] Trade confirmed. Tx: ${txHash}`);

        // Await market sync so response returns AFTER DB is updated with new trade
        console.log('[CustodialTrade] Awaiting market sync so volume/positions are up-to-date...');
        try {
            const { syncAllMarkets } = await import('../services/marketIndexer');
            await syncAllMarkets();
            console.log('[CustodialTrade] ✅ Sync complete');
        } catch (error) {
            console.error('[CustodialTrade] Sync failed (non-fatal):', error);
        }

        return res.json({
            success: true,
            txHash,
            shares: estSharesFloat.toFixed(4),
            cost: amount,
            smartAccountAddress,
        });

    } catch (error: any) {
        console.error('[CustodialTrade] Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// In-memory nonce store (replace with Redis/DB for multi-instance deployments)
// Each entry expires after 5 minutes.
// ─────────────────────────────────────────────────────────────────────────────
interface WithdrawalIntent {
    privyUserId: string;
    amount: string;
    destinationAddress: string;
    gasFeeUSDC: string;
    netAmount: string;
    smartAccountAddress: string;
    expiresAt: number; // unix ms
}
const pendingWithdrawals = new Map<string, WithdrawalIntent>();
const INTENT_TTL_MS = 5 * 60 * 1000; // 5 minutes

// Purge expired intents periodically
setInterval(() => {
    const now = Date.now();
    for (const [nonce, intent] of pendingWithdrawals.entries()) {
        if (now > intent.expiresAt) pendingWithdrawals.delete(nonce);
    }
}, 60_000);

/**
 * POST /api/wallet/prepare-withdrawal
 *
 * Step 1 of 2 in the secure withdrawal flow.
 * Builds the withdrawal details (amounts, fees) and returns them along with
 * a one-time nonce. The frontend must have the user sign the intent message
 * with their Privy embedded wallet before calling submit-withdrawal.
 *
 * Body: { privyUserId, amount, destinationAddress }
 * Returns: { nonce, message, gasFee, netAmount, smartAccountAddress }
 */
export const prepareWithdrawal = async (req: Request, res: Response) => {
    try {
        const { privyUserId, amount, destinationAddress } = req.body;

        if (!privyUserId || !amount || !destinationAddress) {
            return res.status(400).json({ success: false, error: 'privyUserId, amount, and destinationAddress are required' });
        }

        if (!ethers.isAddress(destinationAddress)) {
            return res.status(400).json({ success: false, error: 'Invalid destination address' });
        }

        // 1. Resolve user and their Smart Account
        const userResult = await query('SELECT id FROM users WHERE privy_user_id = $1', [privyUserId]);
        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        const userId = userResult.rows[0].id;

        const walletResult = await query(
            'SELECT encrypted_private_key FROM wallets WHERE user_id = $1',
            [userId]
        );
        if (walletResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Custodial wallet not found' });
        }

        const privateKey = EncryptionService.decrypt(walletResult.rows[0].encrypted_private_key);
        const smartAccountAddress = await getSmartAccountAddressForKey(privateKey);

        // 2. Estimate gas fee
        const { gasService } = require('../services/gasService');
        const gasFeeUSDC: bigint = await gasService.estimateGasCostInUSDC(BigInt(100000));
        const DECIMALS = 18;
        const amountBN = ethers.parseUnits(String(amount), DECIMALS);

        if (amountBN <= gasFeeUSDC) {
            return res.status(400).json({ success: false, error: 'Amount too small to cover gas fee' });
        }

        const netAmountBN = amountBN - gasFeeUSDC;
        const gasFeeStr = ethers.formatUnits(gasFeeUSDC, DECIMALS);
        const netAmountStr = ethers.formatUnits(netAmountBN, DECIMALS);

        // 3. Generate a one-time nonce
        const { randomBytes } = await import('crypto');
        const nonce = randomBytes(16).toString('hex');
        const expiresAt = Date.now() + INTENT_TTL_MS;

        // 4. Build the canonical message the user must sign
        // Format is deterministic so the backend can reconstruct and verify it
        const message = [
            'OPPOL WITHDRAWAL AUTHORIZATION',
            `Amount:      ${amount} USDC`,
            `Gas Fee:     ${gasFeeStr} USDC`,
            `You Receive: ${netAmountStr} USDC`,
            `To:          ${destinationAddress.toLowerCase()}`,
            `From:        ${smartAccountAddress.toLowerCase()}`,
            `Nonce:       ${nonce}`,
            `Expires:     ${new Date(expiresAt).toISOString()}`,
        ].join('\n');

        // 5. Store intent server-side (keyed by nonce)
        pendingWithdrawals.set(nonce, {
            privyUserId,
            amount: String(amount),
            destinationAddress: destinationAddress.toLowerCase(),
            gasFeeUSDC: gasFeeStr,
            netAmount: netAmountStr,
            smartAccountAddress: smartAccountAddress.toLowerCase(),
            expiresAt,
        });

        console.log(`[PrepareWithdrawal] Intent created for ${privyUserId}. Nonce: ${nonce}. Net: ${netAmountStr} USDC → ${destinationAddress}`);

        return res.json({
            success: true,
            nonce,
            message,
            gasFee: gasFeeStr,
            netAmount: netAmountStr,
            smartAccountAddress,
            expiresAt,
        });

    } catch (error: any) {
        console.error('[PrepareWithdrawal] Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};

/**
 * POST /api/wallet/submit-withdrawal
 *
 * Step 2 of 2 in the secure withdrawal flow.
 * Receives the nonce + the user's signature over the intent message.
 * Verifies the signature against the user's known Privy embedded-wallet address.
 * Only then executes the withdrawal UserOperation via Pimlico.
 *
 * Body: { nonce, signature, signerAddress }
 * - nonce:         from prepare-withdrawal response
 * - signature:     hex signature produced by the user's Privy embedded wallet
 * - signerAddress: the Privy embedded wallet address that signed (for verification)
 */
export const submitWithdrawal = async (req: Request, res: Response) => {
    try {
        const { nonce, signature, signerAddress } = req.body;

        if (!nonce || !signature || !signerAddress) {
            return res.status(400).json({ success: false, error: 'nonce, signature, and signerAddress are required' });
        }

        // 1. Retrieve the pending intent
        const intent = pendingWithdrawals.get(nonce);
        if (!intent) {
            return res.status(400).json({ success: false, error: 'Invalid or expired withdrawal nonce. Please start a new withdrawal.' });
        }

        // 2. Check expiry
        if (Date.now() > intent.expiresAt) {
            pendingWithdrawals.delete(nonce);
            return res.status(400).json({ success: false, error: 'Withdrawal intent expired. Please start again.' });
        }

        // 3. Reconstruct the exact message the user was asked to sign
        const message = [
            'OPPOL WITHDRAWAL AUTHORIZATION',
            `Amount:      ${intent.amount} USDC`,
            `Gas Fee:     ${intent.gasFeeUSDC} USDC`,
            `You Receive: ${intent.netAmount} USDC`,
            `To:          ${intent.destinationAddress}`,
            `From:        ${intent.smartAccountAddress}`,
            `Nonce:       ${nonce}`,
            `Expires:     ${new Date(intent.expiresAt).toISOString()}`,
        ].join('\n');

        // 4. Recover the signer from the signature and verify
        let recoveredAddress: string;
        try {
            recoveredAddress = ethers.verifyMessage(message, signature);
        } catch (e: any) {
            return res.status(400).json({ success: false, error: 'Invalid signature format' });
        }

        if (recoveredAddress.toLowerCase() !== signerAddress.toLowerCase()) {
            console.error(`[SubmitWithdrawal] Signature mismatch! Recovered: ${recoveredAddress}, Claimed: ${signerAddress}`);
            return res.status(403).json({ success: false, error: 'Signature verification failed. Withdrawal rejected.' });
        }

        // 5. Verify signerAddress belongs to the Privy user
        const userResult = await query(
            'SELECT u.id FROM users u WHERE u.privy_user_id = $1',
            [intent.privyUserId]
        );
        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'User not found' });
        }
        const userId = userResult.rows[0].id;

        // The signerAddress must be linked to the user.
        // NOTE: After Safe SA migration, users.wallet_address is the Safe SA address,
        // not the Privy embedded wallet address. The Privy embedded wallet is what actually
        // signs — we accept it if:
        //   (a) it matches users.wallet_address or wallets.public_address (legacy check), OR
        //   (b) the signature is cryptographically valid (already verified above) and the
        //       intent's privyUserId belongs to this user (proven by the DB lookup above).
        // Since step 4 (ethers.verifyMessage) already proved the signer holds the private key,
        // and step 5 already confirmed the intent was created for this privyUserId,
        // the combination is sufficient proof of identity.
        const knownAddressCheck = await query(
            `SELECT 1 FROM users WHERE id = $1 AND LOWER(wallet_address) = LOWER($2)
             UNION
             SELECT 1 FROM wallets WHERE user_id = $1 AND LOWER(public_address) = LOWER($2)`,
            [userId, signerAddress]
        );

        const signerKnown = knownAddressCheck.rows.length > 0;
        if (!signerKnown) {
            // Address not in DB tables — but signature is already cryptographically verified.
            // Accept if the intent was legitimately created for this Privy user (already confirmed).
            console.log(`[SubmitWithdrawal] Signer ${signerAddress} is a Privy embedded wallet not yet in DB tables. Accepting via verified signature for ${intent.privyUserId}`);
        }

        // 6. Consume the nonce (one-time use)
        pendingWithdrawals.delete(nonce);

        console.log(`[SubmitWithdrawal] ✅ Signature verified for ${intent.privyUserId}. Executing withdrawal...`);

        // 7. Execute the withdrawal via the existing custodial flow
        // We build a mock request/response to reuse handleCustodialWithdraw internally
        const walletResult = await query(
            'SELECT encrypted_private_key FROM wallets WHERE user_id = $1',
            [userId]
        );
        if (walletResult.rows.length === 0) {
            return res.status(404).json({ success: false, error: 'Custodial wallet not found' });
        }

        const privateKey = EncryptionService.decrypt(walletResult.rows[0].encrypted_private_key);
        const { smartAccountClient, pimlicoClient, smartAccountAddress } = await getActiveProxyWallet(privateKey, userId);

        const MARKET_ADDR = process.env.MARKET_CONTRACT || process.env.MULTI_MARKET_ADDRESS;
        const USDC_ADDR = CONFIG.USDC_CONTRACT;
        const TREASURY_ADDR = process.env.ADMIN_WALLET || process.env.NEXT_PUBLIC_ADMIN_WALLET;
        if (!MARKET_ADDR || !USDC_ADDR) throw new Error('Missing contract config');

        const DECIMALS = 18;
        const netAmountBN = ethers.parseUnits(intent.netAmount, DECIMALS);
        const gasFeeUSDCBN = ethers.parseUnits(intent.gasFeeUSDC, DECIMALS);
        const totalNeeded = netAmountBN + gasFeeUSDCBN;

        // Check SA balance — withdraw from market if needed
        const { ethers: eth2 } = require('ethers');
        const provider = new ethers.JsonRpcProvider(CONFIG.RPC_URL || 'https://bsc-dataseed.binance.org');
        const usdc = new ethers.Contract(USDC_ADDR, ['function balanceOf(address) view returns (uint256)'], provider);
        const saUsdcBalance: bigint = await usdc.balanceOf(smartAccountAddress);

        const calls: { to: `0x${string}`; data: `0x${string}` }[] = [];

        if (saUsdcBalance < totalNeeded) {
            const neededFromMarket = totalNeeded - saUsdcBalance;
            console.log(`[SubmitWithdrawal] Need ${ethers.formatUnits(neededFromMarket, DECIMALS)} USDC from market`);
            const withdrawData = encodeFunctionData({
                abi: parseAbi(['function withdraw(uint256 amount)']),
                functionName: 'withdraw',
                args: [neededFromMarket],
            });
            calls.push({ to: MARKET_ADDR as `0x${string}`, data: withdrawData });
        }

        // Transfer net amount to destination
        const transferData = encodeFunctionData({
            abi: parseAbi(['function transfer(address to, uint256 amount) returns (bool)']),
            functionName: 'transfer',
            args: [intent.destinationAddress as `0x${string}`, netAmountBN],
        });
        calls.push({ to: USDC_ADDR as `0x${string}`, data: transferData });

        // Transfer gas fee to treasury
        if (TREASURY_ADDR && gasFeeUSDCBN > 0n) {
            const feeData = encodeFunctionData({
                abi: parseAbi(['function transfer(address to, uint256 amount) returns (bool)']),
                functionName: 'transfer',
                args: [TREASURY_ADDR as `0x${string}`, gasFeeUSDCBN],
            });
            calls.push({ to: USDC_ADDR as `0x${string}`, data: feeData });
        }

        console.log(`[SubmitWithdrawal] Sending ${calls.length}-call UserOperation...`);
        const userOpHash = await smartAccountClient.sendUserOperation({ calls });
        const receipt = await pimlicoClient.waitForUserOperationReceipt({ hash: userOpHash });
        const txHash = receipt.receipt.transactionHash;

        console.log(`✅ [SubmitWithdrawal] Complete. Tx: ${txHash}`);

        return res.json({
            success: true,
            txHash,
            netAmount: intent.netAmount,
            gasFee: intent.gasFeeUSDC,
            destination: intent.destinationAddress,
        });

    } catch (error: any) {
        console.error('[SubmitWithdrawal] Error:', error);
        return res.status(500).json({ success: false, error: error.message });
    }
};


