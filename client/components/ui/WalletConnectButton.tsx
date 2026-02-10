"use client";

import { useWallet } from "@/lib/use-wallet";
import NeonButton from "@/components/ui/NeonButton";
import { Loader2, Wallet } from "lucide-react";

interface WalletConnectButtonProps {
    className?: string;
    showBalance?: boolean;
    label?: string;
}

export default function WalletConnectButton({
    className = "",
    showBalance = true,
    label = "Connect Wallet"
}: WalletConnectButtonProps) {
    const { isConnected, isConnecting, connect, address } = useWallet();

    if (isConnected && address) {
        return (
            <div className={`flex items-center gap-2 ${className}`}>
                <div className="px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-xs font-mono text-neon-cyan/90 shadow-[0_0_10px_rgba(0,224,255,0.1)]">
                    <span className="w-2 h-2 rounded-full bg-neon-cyan inline-block mr-2 animate-pulse"></span>
                    {address.slice(0, 6)}...{address.slice(-4)}
                </div>
            </div>
        );
    }

    return (
        <NeonButton
            variant="cyan"
            onClick={connect}
            isLoading={isConnecting}
            disabled={isConnecting}
            className={className}
        >
            {!isConnecting && <Wallet className="w-4 h-4 mr-2" />}
            {isConnecting ? "Connecting..." : label}
        </NeonButton>
    );
}
