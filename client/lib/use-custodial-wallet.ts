import { useWallet } from './use-wallet';

export function useCustodialWallet() {
    const { address, isConnected, isConnecting } = useWallet();
    return {
        address,
        isConnected,
        isLoading: isConnecting,
        isCustodial: false,
        login: () => { },
        authType: isConnected ? 'wallet' : null
    };
}
