'use client';

import { useAccount } from 'wagmi';
import { useEffect, useState } from 'react';

export function useWalletStatus() {
    const { address, isConnected, status } = useAccount();
    const [isHydrated, setIsHydrated] = useState(false);
    
    useEffect(() => {
        setIsHydrated(true);
    }, []);
    
    const isLoading = !isHydrated || status === 'reconnecting';
    
    return {
        address,
        isConnected: isHydrated && isConnected,
        isLoading,
        status,
    };
}
