'use client';

import { useState, useEffect } from 'react';

export function WalletDebug() {
  const [debugInfo, setDebugInfo] = useState<any>({});

  useEffect(() => {
    const updateDebugInfo = () => {
      setDebugInfo({
        hasEthereum: !!window.ethereum,
        hasAppKit: !!(window as any).__appkit,
        userAgent: navigator.userAgent,
        isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent),
        cachedWallet: localStorage.getItem('wallet_cache'),
        timestamp: new Date().toISOString()
      });
    };

    updateDebugInfo();
    const interval = setInterval(updateDebugInfo, 2000);
    return () => clearInterval(interval);
  }, []);

  const testReownConnection = () => {
    console.log('Testing Reown connection...');
    const appKit = (window as any).__appkit;
    if (appKit) {
      console.log('AppKit found, trying to open...');
      appKit.open();
    } else {
      console.log('AppKit not found');
    }
  };

  const testMetaMaskConnection = async () => {
    console.log('Testing MetaMask connection...');
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        console.log('MetaMask accounts:', accounts);
      } catch (error) {
        console.error('MetaMask error:', error);
      }
    } else {
      console.log('MetaMask not found');
    }
  };

  return (
    <div className="fixed bottom-4 right-4 bg-black/80 text-white p-4 rounded-lg text-xs max-w-sm z-50">
      <h3 className="font-bold mb-2">Wallet Debug</h3>
      <div className="space-y-1 mb-3">
        <div>Ethereum: {debugInfo.hasEthereum ? '✅' : '❌'}</div>
        <div>AppKit: {debugInfo.hasAppKit ? '✅' : '❌'}</div>
        <div>Mobile: {debugInfo.isMobile ? '✅' : '❌'}</div>
        <div>Cached: {debugInfo.cachedWallet ? '✅' : '❌'}</div>
      </div>
      <div className="space-y-2">
        <button 
          onClick={testReownConnection}
          className="w-full bg-blue-600 hover:bg-blue-700 px-2 py-1 rounded text-xs"
        >
          Test Reown
        </button>
        <button 
          onClick={testMetaMaskConnection}
          className="w-full bg-green-600 hover:bg-green-700 px-2 py-1 rounded text-xs"
        >
          Test MetaMask
        </button>
      </div>
    </div>
  );
}