// Connection utility functions to prevent wallet connection conflicts

let lastConnectionAttempt = 0;
const CONNECTION_DEBOUNCE_MS = 2000; // 2 seconds

export function canAttemptConnection(): boolean {
  const now = Date.now();
  if (now - lastConnectionAttempt < CONNECTION_DEBOUNCE_MS) {
    console.log('[ConnectionUtils] Connection attempt blocked - too soon after last attempt');
    return false;
  }
  lastConnectionAttempt = now;
  return true;
}

export function resetConnectionDebounce(): void {
  lastConnectionAttempt = 0;
}

// Clear any stuck connection states
export function clearStuckConnectionState(): void {
  try {
    // Clear Web3Modal state
    const modal = (window as any).web3modal;
    if (modal?.close) {
      modal.close();
    }
    
    // Clear any pending connection promises
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('clear-connection-state'));
    }
    
    console.log('[ConnectionUtils] Cleared stuck connection state');
  } catch (error) {
    console.error('[ConnectionUtils] Error clearing connection state:', error);
  }
}