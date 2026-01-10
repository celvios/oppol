"use client";

import { useState } from 'react';
import { useWallet } from '@/lib/use-wallet';
import { Loader2, RefreshCw, AlertCircle, CheckCircle } from 'lucide-react';

interface BalanceData {
    connectedWallet: {
        address: string;
        usdcBalance: number;
    };
    custodialWallet: {
        address: string;
        usdcBalance: number;
        depositedInContract: number;
        databaseBalance: number;
    };
    totalAvailableForTrading: number;
    discrepancy: {
        exists: boolean;
        difference: number;
    };
}

export function BalanceChecker() {
    const { address } = useWallet();
    const [balanceData, setBalanceData] = useState<BalanceData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const checkBalance = async () => {
        if (!address) return;

        setIsLoading(true);
        setError('');

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || '';
            console.log('Calling API:', `${apiUrl}/api/balance/${address}`);
            
            const response = await fetch(`${apiUrl}/api/balance/${address}`);
            
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                const text = await response.text();
                console.error('Non-JSON response:', text.substring(0, 200));
                throw new Error('Server returned HTML instead of JSON. Is the backend running?');
            }
            
            const data = await response.json();

            if (data.success) {
                setBalanceData(data.balances);
            } else {
                setError(data.error || 'Failed to fetch balance');
            }
        } catch (e: any) {
            console.error('Balance check error:', e);
            setError(e.message || 'Network error');
        } finally {
            setIsLoading(false);
        }
    };

    if (!address) {
        return (
            <div className="p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
                <p className="text-yellow-200 text-sm">Connect wallet to check balance</p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2">
                <button
                    onClick={checkBalance}
                    disabled={isLoading}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                >
                    {isLoading ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <RefreshCw className="w-4 h-4" />
                    )}
                    Check Real Balance
                </button>
            </div>

            {error && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400" />
                    <span className="text-red-200 text-sm">{error}</span>
                </div>
            )}

            {balanceData && (
                <div className="space-y-3">
                    <div className="p-4 bg-white/5 border border-white/10 rounded-lg">
                        <h3 className="font-semibold mb-3 flex items-center gap-2">
                            {balanceData.discrepancy.exists ? (
                                <AlertCircle className="w-4 h-4 text-yellow-400" />
                            ) : (
                                <CheckCircle className="w-4 h-4 text-green-400" />
                            )}
                            Balance Summary
                        </h3>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                            <div>
                                <p className="text-text-secondary">Connected Wallet Balance:</p>
                                <p className="font-mono font-bold text-lg">
                                    ${balanceData.connectedWallet.usdcBalance.toFixed(2)}
                                </p>
                            </div>
                            
                            <div>
                                <p className="text-text-secondary">Available for Trading:</p>
                                <p className="font-mono font-bold text-lg text-green-400">
                                    ${balanceData.totalAvailableForTrading.toFixed(2)}
                                </p>
                            </div>
                        </div>

                        {balanceData.discrepancy.exists && (
                            <div className="mt-3 p-2 bg-yellow-500/10 border border-yellow-500/20 rounded">
                                <p className="text-yellow-200 text-xs">
                                    ⚠️ Discrepancy detected: ${Math.abs(balanceData.discrepancy.difference).toFixed(2)} difference
                                </p>
                            </div>
                        )}
                    </div>

                    <details className="bg-white/5 border border-white/10 rounded-lg">
                        <summary className="p-3 cursor-pointer text-sm font-medium">
                            Detailed Breakdown
                        </summary>
                        <div className="p-3 pt-0 space-y-2 text-xs">
                            <div>
                                <p className="text-text-secondary">Connected Wallet:</p>
                                <p className="font-mono">{balanceData.connectedWallet.address}</p>
                                <p>USDC: ${balanceData.connectedWallet.usdcBalance.toFixed(2)}</p>
                            </div>
                            
                            <div>
                                <p className="text-text-secondary">Custodial Wallet:</p>
                                <p className="font-mono">{balanceData.custodialWallet.address}</p>
                                <p>USDC: ${balanceData.custodialWallet.usdcBalance.toFixed(2)}</p>
                                <p>Deposited in Contract: ${balanceData.custodialWallet.depositedInContract.toFixed(2)}</p>
                                <p>Database Balance: ${balanceData.custodialWallet.databaseBalance.toFixed(2)}</p>
                            </div>
                        </div>
                    </details>
                </div>
            )}
        </div>
    );
}