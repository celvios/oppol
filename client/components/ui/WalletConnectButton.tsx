'use client';

import { useState } from 'react';

export function WalletConnectButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const [isConnecting, setIsConnecting] = useState(false);

  const handleConnect = async () => {
    setIsConnecting(true);
    
    try {
      if (typeof window !== 'undefined' && window.ethereum) {
        const accounts = await window.ethereum.request({ 
          method: 'eth_requestAccounts' 
        });
        
        if (accounts.length > 0) {
          localStorage.setItem('wallet_cache', JSON.stringify({
            address: accounts[0],
            isConnected: true
          }));
          
          window.dispatchEvent(new CustomEvent('wallet-changed', {
            detail: { address: accounts[0], isConnected: true }
          }));
        }
      } else {
        // Mobile fallback - try to open MetaMask mobile app
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
          const metamaskUrl = `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`;
          window.open(metamaskUrl, '_blank');
        } else {
          alert('Please install MetaMask or use a Web3 browser');
        }
      }
    } catch (error) {
      console.error('Connection failed:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <button 
      onClick={handleConnect} 
      className={className}
      disabled={isConnecting}
    >
      {isConnecting ? 'Connecting...' : children}
    </button>
  );
}