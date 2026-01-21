/**
 * Deposit Watcher Service
 * Monitors blockchain for USDC transfers and credits user balances instantly
 */

import { ethers } from 'ethers';

// Configuration
const BNB_WSS_URL = process.env.BNB_WSS_URL || 'wss://bsc-mainnet.blastapi.io/ws'; // For mainnet
const BNB_TESTNET_WSS = 'wss://bsc-testnet.publicnode.com'; // For testnet
import { CONFIG } from '../config/contracts';

const LOCAL_WSS = 'ws://127.0.0.1:8545'; // For local hardhat

// USDC Contract
const USDC_ADDRESS = CONFIG.USDC_CONTRACT;

// ERC20 Transfer event signature
const TRANSFER_TOPIC = ethers.id('Transfer(address,address,uint256)');

// In-memory store for watched addresses (in production, use database)
const watchedAddresses: Map<string, { userId: string; phoneNumber: string }> = new Map();

// Callback for when deposit is detected
type DepositCallback = (userId: string, phoneNumber: string, amount: string, txHash: string) => Promise<void>;
let onDepositDetected: DepositCallback | null = null;

let provider: ethers.WebSocketProvider | null = null;
let isRunning = false;

/**
 * Add an address to watch for deposits
 */
export function watchAddress(address: string, userId: string, phoneNumber: string) {
    watchedAddresses.set(address.toLowerCase(), { userId, phoneNumber });
    console.log(`👁️ Now watching: ${address} for user ${userId}`);
}

/**
 * Remove an address from watch list
 */
export function unwatchAddress(address: string) {
    watchedAddresses.delete(address.toLowerCase());
}

/**
 * Set callback for deposit detection
 */
export function setDepositCallback(callback: DepositCallback) {
    onDepositDetected = callback;
}

/**
 * Start the deposit watcher
 */
export async function startDepositWatcher(wssUrl: string = LOCAL_WSS) {
    if (isRunning) {
        console.log('⚠️ Deposit watcher already running');
        return;
    }

    console.log('🚀 Starting deposit watcher...');
    console.log(`📡 Connecting to: ${wssUrl}`);

    try {
        provider = new ethers.WebSocketProvider(wssUrl);

        // Wait for connection with timeout
        try {
            await Promise.race([
                provider.getNetwork(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 10000))
            ]);
            console.log('✅ Connected to blockchain');
        } catch (networkError: any) {
            // Check if it's an RPC limit error
            if (networkError?.error?.message?.includes('daily request limit') || 
                networkError?.error?.message?.includes('upgrade your account')) {
                console.error('❌ RPC provider limit reached. Deposit watcher disabled.');
                console.error('   Consider upgrading your RPC plan or using a fallback provider.');
                isRunning = false;
                if (provider) {
                    provider.destroy();
                    provider = null;
                }
                return;
            }
            throw networkError;
        }

        // Create filter for USDC Transfer events
        const filter = {
            address: USDC_ADDRESS,
            topics: [TRANSFER_TOPIC]
        };

        // Subscribe to Transfer events
        provider.on(filter, async (log) => {
            try {
                // Decode the transfer event
                const iface = new ethers.Interface([
                    'event Transfer(address indexed from, address indexed to, uint256 value)'
                ]);
                const decoded = iface.parseLog({
                    topics: log.topics as string[],
                    data: log.data
                });

                if (!decoded) return;

                const to = decoded.args.to.toLowerCase();
                const amount = ethers.formatUnits(decoded.args.value, 6); // USDC has 6 decimals

                // Check if recipient is a watched address
                const userInfo = watchedAddresses.get(to);
                if (userInfo) {
                    console.log(`💰 Deposit detected!`);
                    console.log(`   Amount: $${amount} USDC`);
                    console.log(`   To: ${to}`);
                    console.log(`   User: ${userInfo.userId}`);
                    console.log(`   TX: ${log.transactionHash}`);

                    // Trigger callback
                    if (onDepositDetected) {
                        await onDepositDetected(
                            userInfo.userId,
                            userInfo.phoneNumber,
                            amount,
                            log.transactionHash
                        );
                    }
                }
            } catch (error) {
                console.error('Error processing transfer event:', error);
            }
        });

        isRunning = true;
        console.log('✅ Deposit watcher running');
        console.log(`👁️ Watching USDC at: ${USDC_ADDRESS}`);

        // Handle disconnection using provider error event
        provider.on('error', (error) => {
            console.log('⚠️ WebSocket error, reconnecting...', error);
            isRunning = false;
            setTimeout(() => startDepositWatcher(wssUrl), 5000);
        });

        // Alternative: check websocket and add listener with type assertion
        const ws = provider.websocket as any;
        if (ws && typeof ws.addEventListener === 'function') {
            ws.addEventListener('close', () => {
                console.log('⚠️ WebSocket disconnected, reconnecting...');
                isRunning = false;
                setTimeout(() => startDepositWatcher(wssUrl), 5000);
            });
        }

    } catch (error: any) {
        console.error('❌ Failed to start deposit watcher:', error);
        
        // Check if it's an RPC limit error
        if (error?.error?.message?.includes('daily request limit') || 
            error?.error?.message?.includes('upgrade your account') ||
            error?.message?.includes('daily request limit')) {
            console.error('⚠️ RPC provider limit reached. Deposit watcher will remain disabled.');
            console.error('   The application will continue to function, but deposit watching is unavailable.');
        } else {
            console.error('   Will retry in 30 seconds...');
            // Retry after 30 seconds for non-limit errors
            setTimeout(() => {
                if (!isRunning) {
                    startDepositWatcher(wssUrl);
                }
            }, 30000);
        }
        
        isRunning = false;
        if (provider) {
            try {
                provider.destroy();
            } catch (e) {
                // Ignore destroy errors
            }
            provider = null;
        }
    }
}

/**
 * Stop the deposit watcher
 */
export async function stopDepositWatcher() {
    if (provider) {
        await provider.destroy();
        provider = null;
    }
    isRunning = false;
    console.log('⏹️ Deposit watcher stopped');
}

/**
 * Check if watcher is running
 */
export function isWatcherRunning(): boolean {
    return isRunning;
}
