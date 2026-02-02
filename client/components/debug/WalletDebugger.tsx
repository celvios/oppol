"use client";

import { useState, useEffect } from "react";
import { useAccount, useConfig } from "wagmi";
import { usePrivy } from "@privy-io/react-auth";
import { NeonButton } from "@/components/ui/NeonButton";

export default function WalletDebugger() {
    const { isConnected, status, address } = useAccount();
    const { ready, authenticated, user } = usePrivy();
    const [logs, setLogs] = useState<string[]>([]);
    const [providerInfo, setProviderInfo] = useState<any>({});

    const addLog = (msg: string) => setLogs(prev => [...prev, `${new Date().toISOString().split('T')[1].slice(0, 8)}: ${msg}`]);

    const checkProvider = async () => {
        addLog("Checking window.ethereum...");
        if (typeof window !== 'undefined' && (window as any).ethereum) {
            const eth = (window as any).ethereum;
            setProviderInfo({
                isMetaMask: eth.isMetaMask,
                chainId: eth.chainId,
                selectedAddress: eth.selectedAddress,
                networkVersion: eth.networkVersion
            });
            addLog(`Provider found: MetaMask=${eth.isMetaMask}, Chain=${eth.chainId}`);

            // Check if locked/pending?
            try {
                addLog("Attempting eth_accounts...");
                const accounts = await eth.request({ method: 'eth_accounts' });
                addLog(`eth_accounts result: ${JSON.stringify(accounts)}`);
            } catch (e: any) {
                addLog(`eth_accounts Error: ${e.message} (${e.code})`);
            }

        } else {
            addLog("window.ethereum NOT found!");
        }
    };

    const forceDirectConnect = async () => {
        addLog("Attempting DIRECT eth_requestAccounts...");
        if (typeof window === 'undefined' || !(window as any).ethereum) {
            addLog("No provider to connect to.");
            return;
        }
        try {
            const accounts = await (window as any).ethereum.request({ method: 'eth_requestAccounts' });
            addLog(`Success! Accounts: ${JSON.stringify(accounts)}`);
        } catch (e: any) {
            addLog(`Direct Connect Error: ${JSON.stringify(e)}`);
            if (e.code === -32002) {
                addLog("⚠️ ERROR -32002: Request of type 'wallet_requestPermissions' already pending.");
                addLog("👉 SOLUTION: Open your MetaMask extension and clear any pending popups.");
            }
        }
    };

    useEffect(() => {
        checkProvider();
    }, []);

    return (
        <div className="mt-4 p-4 bg-black/80 border border-red-500/50 rounded-lg text-xs font-mono text-left h-64 overflow-y-auto">
            <h3 className="text-red-400 font-bold mb-2">🐞 Wallet Debugger</h3>

            <div className="grid grid-cols-2 gap-2 mb-2 text-white/70">
                <div>
                    <span className="text-gray-500">Wagmi:</span> {status} {isConnected ? '✅' : '❌'}
                </div>
                <div>
                    <span className="text-gray-500">Privy:</span> {ready ? 'Ready' : 'Not Ready'} {authenticated ? '✅' : '❌'}
                </div>
                <div>
                    <span className="text-gray-500">Provider:</span> {providerInfo.isMetaMask ? 'MetaMask' : 'Unknown'}
                </div>
                <div>
                    <span className="text-gray-500">Addr:</span> {providerInfo.selectedAddress?.slice(0, 6) || 'None'}
                </div>
            </div>

            <div className="flex gap-2 mb-2">
                <button onClick={checkProvider} className="px-2 py-1 bg-white/10 hover:bg-white/20 rounded">
                    Refresh Provider
                </button>
                <button onClick={forceDirectConnect} className="px-2 py-1 bg-red-500/20 hover:bg-red-500/40 text-red-200 rounded border border-red-500/50">
                    Test Direct Connect
                </button>
            </div>

            <div className="space-y-1 text-gray-400 border-t border-white/10 pt-2">
                {logs.map((log, i) => (
                    <div key={i}>{log}</div>
                ))}
            </div>
        </div>
    );
}
