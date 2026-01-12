'use client';

import { useEffect } from 'react';
import { useWeb3Modal } from '@web3modal/wagmi/react';

interface WalletSelectorModalProps {
    isOpen: boolean;
    onClose: () => void;
    // Props below are now ignored but kept for compatibility
    wallets?: any[];
    onSelectWallet?: (wallet: any) => void;
    onConnectMetaMaskSDK?: () => void;
    isConnecting?: boolean;
    error?: string | null;
    isMobile?: boolean;
}

export function WalletSelectorModal({ isOpen, onClose }: WalletSelectorModalProps) {
    const { open } = useWeb3Modal();

    useEffect(() => {
        if (isOpen) {
            open();
            onClose();
        }
    }, [isOpen, open, onClose]);

    return null;
}

