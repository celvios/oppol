/**
 * Wallet Connection Utilities
 * 
 * Provides debouncing and state management to prevent "connection declined" errors
 * caused by multiple simultaneous connection attempts or modal conflicts.
 */

// Track connection state
let isConnecting = false;
let lastConnectionAttempt = 0;
let isModalCurrentlyOpen = false;

// Connection debounce settings
const MIN_CONNECTION_INTERVAL = 2000; // 2 seconds minimum between attempts

/**
 * Debounces wallet connection attempts to prevent multiple simultaneous requests
 * @param callback - The connection function to execute
 * @returns Promise that resolves when connection completes or rejects if debounced
 */
export async function debounceConnection<T>(callback: () => Promise<T>): Promise<T> {
    const now = Date.now();
    const timeSinceLastAttempt = now - lastConnectionAttempt;

    // Prevent connection if already connecting
    if (isConnecting) {
        console.log('[ConnectionUtils] Connection already in progress, blocking duplicate attempt');
        throw new Error('Connection already in progress. Please wait.');
    }

    // Enforce minimum interval between attempts
    if (timeSinceLastAttempt < MIN_CONNECTION_INTERVAL) {
        const waitTime = MIN_CONNECTION_INTERVAL - timeSinceLastAttempt;
        console.log(`[ConnectionUtils] Connection attempt too soon, must wait ${waitTime}ms`);
        throw new Error(`Please wait ${Math.ceil(waitTime / 1000)} seconds before trying again.`);
    }

    // Set connection state
    isConnecting = true;
    lastConnectionAttempt = now;

    try {
        const result = await callback();
        return result;
    } finally {
        // Always clear connecting state after attempt completes
        setTimeout(() => {
            isConnecting = false;
        }, 500); // Small delay to prevent immediate re-triggering
    }
}

/**
 * Checks if Web3Modal is currently open
 * @returns true if modal is open, false otherwise
 */
export function isModalOpen(): boolean {
    return isModalCurrentlyOpen;
}

/**
 * Sets the modal open state
 * Called by web3-provider when modal opens/closes
 */
export function setModalState(open: boolean): void {
    isModalCurrentlyOpen = open;
    console.log('[ConnectionUtils] Modal state updated:', open ? 'OPEN' : 'CLOSED');
}

/**
 * Clears stuck connection state from localStorage and memory
 * Useful when recovering from failed connection attempts
 */
export function clearStuckState(): void {
    console.log('[ConnectionUtils] Clearing potentially stuck connection state...');

    try {
        // Clear any stuck WalletConnect sessions
        const keysToCheck = [
            'wc@2:core:0.3//subscription',
            'wc@2:client:0.3//proposal',
            'wc@2:core:0.3//pairing',
            'WALLETCONNECT_DEEPLINK_CHOICE',
        ];

        keysToCheck.forEach(key => {
            if (localStorage.getItem(key)) {
                console.log(`[ConnectionUtils] Removing stuck key: ${key}`);
                localStorage.removeItem(key);
            }
        });

        // Reset internal state
        isConnecting = false;

        console.log('[ConnectionUtils] Stuck state cleared successfully');
    } catch (error) {
        console.warn('[ConnectionUtils] Error clearing stuck state:', error);
    }
}

/**
 * Resets connection attempt timer
 * Use sparingly - only when you need to allow immediate reconnection
 */
export function resetConnectionTimer(): void {
    lastConnectionAttempt = 0;
    console.log('[ConnectionUtils] Connection timer reset');
}

/**
 * Gets current connection state for debugging
 */
export function getConnectionState() {
    return {
        isConnecting,
        lastConnectionAttempt,
        isModalCurrentlyOpen,
        timeSinceLastAttempt: Date.now() - lastConnectionAttempt,
    };
}
