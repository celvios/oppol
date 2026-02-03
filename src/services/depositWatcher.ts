/**
 * Deposit Watcher Service
 * Monitors blockchain for USDC transfers and credits user balances instantly
 */

import { ethers } from 'ethers';
import { CONFIG } from '../config/contracts';

// Configuration
const BNB_WSS_URL = CONFIG.WSS_URL;
if (!BNB_WSS_URL) console.warn('⚠️ BNB_WSS_URL not set. Watcher may fail.');

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
let isConnecting = false;
let reconnectTimer: NodeJS.Timeout | null = null;

// Basic Exponential Backoff State
let backoffDelay = 5000;
const MAX_BACKOFF = 60000;

function resetBackoff() {
    backoffDelay = 5000;
}

function getNextBackoff() {
    const current = backoffDelay;
    backoffDelay = Math.min(backoffDelay * 2, MAX_BACKOFF);
    return current;
}

function scheduleReconnect(wssUrl: string) {
    if (reconnectTimer) return; // Already scheduled

    const delay = getNextBackoff();
    console.log(`🔄 Reconnect scheduled in ${delay / 1000}s...`);
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        startDepositWatcher(wssUrl);
    }, delay);
}

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
 * Start the deposit watcher with Robust Connection Handling
 */
export async function startDepositWatcher(wssUrl: string = BNB_WSS_URL) {
    if (isRunning || isConnecting) {
        return;
    }

    // Required to prevent Node process crash on unhandled WS errors
    const WebSocket = require('ws');

    try {
        isConnecting = true;

        // Clean up previous provider
        if (provider) {
            try { await provider.destroy(); } catch (e) { }
            provider = null;
        }

        console.log(`🚀 connection attempt to ${wssUrl}...`);

        // 1. Monitor Socket Level Errors First (Prevents CRASH)
        // Strategy: Use Ethers but attach error listener to underlying socket immediately
        const newProvider = new ethers.WebSocketProvider(wssUrl);

        // SAFETY: Node 'ws' objects emit 'error'. If no listener, node crashes.
        const internalWs = (newProvider as any).websocket;

        // Explicitly attach error handler to the underlying socket to prevent unhandled exception
        if (internalWs) {
            internalWs.on('error', (err: any) => {
                console.error('⚠️ [WS-Internal] Connected Socket Error:', err.message);
                // The provider specific error handler will also fire, but this prevents the crash
                handleDisconnect();
            });

            internalWs.on('close', (code: number, reason: string) => {
                console.log(`⚠️ [WS-Internal] Closed: ${code} ${reason}`);
                handleDisconnect();
            });
        }

        // Connection Handling Logic
        const handleDisconnect = () => {
            if (isConnecting) {
                isConnecting = false;
                console.log('⚠️ Connection failed.');
                scheduleReconnect(wssUrl);
                return;
            }

            if (!isRunning) return;

            console.log('⚠️ WebSocket disconnected, triggering reconnect...');
            isRunning = false;

            // Clear listeners
            if (provider) {
                provider.removeAllListeners();
                try { (provider as any).websocket?.terminate(); } catch { } // Force kill
                provider = null;
            }

            scheduleReconnect(wssUrl);
        };

        // Ethers Provider Error Handler
        newProvider.on('error', (err) => {
            console.error('❌ Ethers Provider Error:', err);
            // handleDisconnect is called by internalWs 'error' usually, but safe to call here if needed
        });

        // Wait for network detection to confirm connection is "alive"
        // If 429 happens, internalWs 'error' fires first, handleDisconnect runs, backoff triggers.
        try {
            await Promise.race([
                newProvider.getNetwork(),
                new Promise((_, reject) => setTimeout(() => reject(new Error('Connection timeout')), 10000))
            ]);

            console.log('✅ Connected to BNB Chain (Deposit Watcher)');
            // Success - reset backoff
            resetBackoff();

        } catch (err: any) {
            console.error(`❌ Connection Handshake Failed: ${err.message}`);
            // This catch block handles timeout or network fetch errors
            // The 429 crash is handled by internalWs.on('error')
            internalWs?.terminate(); // Ensure dead
            handleDisconnect();
            return;
        }

        // --- SUCCESSFUL CONNECTION ---
        provider = newProvider;
        isRunning = true;
        isConnecting = false;

        // Subscribe to events
        const filter = {
            address: USDC_ADDRESS,
            topics: [TRANSFER_TOPIC]
        };

        provider.on(filter, async (log) => {
            try {
                const iface = new ethers.Interface(['event Transfer(address indexed from, address indexed to, uint256 value)']);
                const decoded = iface.parseLog({ topics: log.topics as string[], data: log.data });

                if (!decoded) return;

                const to = decoded.args.to.toLowerCase();
                const amount = ethers.formatUnits(decoded.args.value, 18);

                const userInfo = watchedAddresses.get(to);
                if (userInfo) {
                    console.log(`💰 Deposit Detected: $${amount} for ${userInfo.userId}`);
                    if (onDepositDetected) {
                        await onDepositDetected(userInfo.userId, userInfo.phoneNumber, amount, log.transactionHash);
                    }
                }
            } catch (e) {
                console.error('Error processing log:', e);
            }
        });

        console.log(`👁️ Watching ${watchedAddresses.size} addresses for deposits`);

    } catch (fatalError: any) {
        console.error('❌ Fatal error in startDepositWatcher:', fatalError);
        isConnecting = false;
        scheduleReconnect(wssUrl);
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
