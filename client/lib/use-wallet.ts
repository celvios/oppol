// Wallet connection removed as per user request
export function useWallet() {
  return {
    isConnected: false,
    address: null,
    isConnecting: false,
    connect: () => { },
    disconnect: () => { },
    connectors: [],
  };
}

