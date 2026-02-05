'use client';

import { useEffect } from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { bsc } from 'wagmi/chains';

const REQUIRED_CHAIN_ID = 56; // BSC Mainnet

export function NetworkChecker() {
    const { chain, isConnected } = useAccount();
    const { switchChain } = useSwitchChain();

    useEffect(() => {
        if (isConnected && chain && chain.id !== REQUIRED_CHAIN_ID) {
            console.log('[NetworkChecker] Wrong network detected:', chain.id, 'Expected:', REQUIRED_CHAIN_ID);

            // Automatically switch to BSC Mainnet
            if (switchChain) {
                console.log('[NetworkChecker] Switching to BSC Mainnet...');
                switchChain({ chainId: REQUIRED_CHAIN_ID });
            }
        }
    }, [chain, isConnected, switchChain]);

    return null; // This is a headless component
}
