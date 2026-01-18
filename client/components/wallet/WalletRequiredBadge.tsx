"use client";

import { Lock } from "lucide-react";

export default function WalletRequiredBadge() {
    return (
        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-white/5 border border-white/10">
            <Lock size={10} className="text-white/40" />
            <span className="text-[10px] text-white/40 font-medium uppercase tracking-wide">
                Wallet
            </span>
        </div>
    );
}
