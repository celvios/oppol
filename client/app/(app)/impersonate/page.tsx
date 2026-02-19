"use client";

import { useState } from "react";
import { useUIStore } from "@/lib/store";
import { useRouter } from "next/navigation";
import { ArrowRight, UserCog, AlertTriangle } from "lucide-react";

export default function ImpersonatePage() {
    const [targetAddress, setTargetAddress] = useState("");
    const { setCustodialAddress } = useUIStore();
    const router = useRouter();

    const handleImpersonate = () => {
        if (!targetAddress) return;

        // Override the custodial address in the global store
        // This tricks 'useWallet' into returning this address as 'effectiveAddress'
        // provided you are already logged in (as anyone).
        setCustodialAddress(targetAddress);

        console.log(`[Impersonate] Switched view to ${targetAddress}`);
        router.push("/withdraw");
    };

    const handleReset = () => {
        setCustodialAddress(null); // Will revert to real connected wallet
        console.log(`[Impersonate] Reset to real user`);
        router.push("/withdraw");
    };

    return (
        <div className="max-w-md mx-auto pt-20 px-6">
            <div className="bg-surface/50 backdrop-blur-md border border-white/10 rounded-2xl p-8">
                <div className="flex items-center gap-3 mb-6">
                    <UserCog className="w-8 h-8 text-yellow-500" />
                    <h1 className="text-xl font-bold text-white">Debug Impersonation</h1>
                </div>

                <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6">
                    <div className="flex gap-2 items-start">
                        <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0 mt-0.5" />
                        <p className="text-sm text-yellow-200/80">
                            <strong>Warning:</strong> This overrides your local view only.
                            You cannot sign transactions for this user (no private key).
                            Use this to check Balance Display and UI states.
                        </p>
                    </div>
                </div>

                <div className="space-y-4">
                    <div>
                        <label className="block text-xs text-white/50 uppercase font-bold mb-2">
                            Target Wallet Address
                        </label>
                        <input
                            type="text"
                            value={targetAddress}
                            onChange={(e) => setTargetAddress(e.target.value)}
                            placeholder="0x..."
                            className="w-full bg-black/40 border border-white/10 rounded-xl px-4 py-3 text-white font-mono text-sm focus:border-yellow-500/50 focus:outline-none"
                        />
                    </div>

                    <button
                        onClick={handleImpersonate}
                        disabled={!targetAddress}
                        className="w-full py-3 bg-yellow-500 text-black font-bold rounded-xl hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        Simulate User View
                        <ArrowRight className="w-4 h-4" />
                    </button>

                    <button
                        onClick={handleReset}
                        className="w-full py-3 bg-white/5 text-white/50 font-bold rounded-xl hover:bg-white/10 hover:text-white"
                    >
                        Reset / Stop Impersonating
                    </button>

                    <p className="text-center text-xs text-white/30 pt-4">
                        Refresh the page to fully reset if stuck.
                    </p>
                </div>
            </div>
        </div>
    );
}
