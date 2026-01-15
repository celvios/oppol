'use client';

import { useEffect, useState } from 'react';

export function ReownConnectButton({ children, className }: { children: React.ReactNode; className?: string }) {
  const [mounted, setMounted] = useState(false);
  const [appKit, setAppKit] = useState<any>(null);

  useEffect(() => {
    setMounted(true);
    
    // Only load Reown on client side and handle errors gracefully
    const loadReown = async () => {
      try {
        // Use dynamic imports with proper error handling
        const { createAppKit } = await import('@reown/appkit/react');
        
        // Only import what we actually need - avoid the problematic adapters
        const { mainnet, polygon, bsc } = await import('@reown/appkit/networks');
        
        const appKitInstance = createAppKit({
          networks: [bsc, mainnet, polygon],
          metadata: {
            name: 'OPoll',
            description: 'Decentralized Prediction Market',
            url: 'https://oppollbnb.vercel.app',
            icons: ['https://oppollbnb.vercel.app/favicon.ico']
          },
          projectId: '70415295a4738286445072f5c2392457',
          features: {
            analytics: false,
            email: false,
            socials: []
          },
          themeMode: 'dark'
        });
        
        setAppKit(appKitInstance);
        (window as any).__appkit = appKitInstance;
        
        // Listen for connection events
        appKitInstance.subscribeAccount((account: any) => {
          if (account.isConnected && account.address) {
            localStorage.setItem('wallet_cache', JSON.stringify({
              address: account.address,
              isConnected: true
            }));
            
            window.dispatchEvent(new CustomEvent('wallet-changed', {
              detail: { address: account.address, isConnected: true }
            }));
          } else {
            localStorage.removeItem('wallet_cache');
            window.dispatchEvent(new CustomEvent('wallet-changed', {
              detail: { address: null, isConnected: false }
            }));
          }
        });
        
      } catch (error) {
        console.warn('Reown AppKit failed to load, using fallback:', error);
        // Fallback to simple wallet connection
      }
    };
    
    loadReown();
  }, []);

  const handleClick = () => {
    if (appKit) {
      try {
        appKit.open();
      } catch (error) {
        console.error('Error opening AppKit:', error);
        // Fallback to MetaMask
        handleMetaMaskFallback();
      }
    } else {
      // If Reown failed to load, use MetaMask directly
      handleMetaMaskFallback();
    }
  };

  const handleMetaMaskFallback = async () => {
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
        // Mobile fallback
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
        if (isMobile) {
          const metamaskUrl = `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`;
          window.open(metamaskUrl, '_blank');
        } else {
          alert('Please install MetaMask or use a Web3 browser');
        }
      }
    } catch (error) {
      console.error('MetaMask connection failed:', error);
    }
  };

  if (!mounted) {
    return (
      <button className={className} disabled>
        {children}
      </button>
    );
  }

  return (
    <button onClick={handleClick} className={className}>
      {children}
    </button>
  );
}