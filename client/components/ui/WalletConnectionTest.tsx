"use client";

import { useWallet } from "@/lib/use-wallet";
import { useState } from "react";

export function WalletConnectionTest() {
    const { isConnected, address, isConnecting, connect, disconnect } = useWallet();
    const [testResults, setTestResults] = useState<string[]>([]);

    const addTestResult = (result: string) => {
        setTestResults(prev => [...prev, `${new Date().toLocaleTimeString()}: ${result}`]);
    };

    const runConnectionTest = async () => {
        addTestResult("Starting connection test...");
        
        if (isConnected) {
            addTestResult("✅ Already connected, disconnecting first...");
            await disconnect();
            setTimeout(() => {
                addTestResult("Attempting reconnection...");
                connect();
            }, 1000);
        } else {
            addTestResult("Attempting connection...");
            await connect();
        }
    };

    const clearResults = () => {
        setTestResults([]);
    };

    // Only show in development
    if (process.env.NODE_ENV !== 'development') {
        return null;
    }

    return (
        <div className="fixed top-4 left-4 z-50 w-80 bg-black/90 border border-blue-500/50 rounded-lg p-4 text-xs text-white font-mono">
            <h3 className="text-blue-400 font-bold mb-3">Wallet Connection Test</h3>
            
            <div className="space-y-2 mb-4">
                <div>Status: {isConnected ? '🟢 Connected' : '🔴 Disconnected'}</div>
                <div>Address: {address || 'None'}</div>
                <div>Connecting: {isConnecting ? '⏳ Yes' : '✅ No'}</div>
            </div>
            
            <div className="space-x-2 mb-4">
                <button
                    onClick={runConnectionTest}
                    disabled={isConnecting}
                    className="px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 rounded text-xs"
                >
                    {isConnecting ? 'Testing...' : 'Test Connection'}
                </button>
                <button
                    onClick={clearResults}
                    className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-xs"
                >
                    Clear
                </button>
            </div>
            
            <div className="max-h-32 overflow-y-auto space-y-1">
                <div className="text-blue-400 mb-1">Test Results:</div>
                {testResults.length === 0 ? (
                    <div className="text-white/50">No tests run yet</div>
                ) : (
                    testResults.map((result, i) => (
                        <div key={i} className="text-xs break-all">{result}</div>
                    ))
                )}
            </div>
        </div>
    );
}