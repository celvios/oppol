"use client";

import { useWallet } from "@/lib/use-wallet";

export default function WalletConnectButtonLite({ className }: { className?: string }) {
    const { connect, isConnected, isConnecting } = useWallet();

    if (isConnected) return null;

    return (
        <button
            onClick={connect}
            disabled={isConnecting}
            className={`text-xs font-bold text-neon-cyan hover:text-white transition-colors uppercase tracking-wider ${className}`}
        >
            {isConnecting ? "..." : "CONNECT"}
        </button>
    );
}
