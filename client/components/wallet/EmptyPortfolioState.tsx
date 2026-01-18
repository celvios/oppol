"use client";

import { PieChart } from "lucide-react";
import NeonButton from "@/components/ui/NeonButton";

interface EmptyPortfolioStateProps {
    onConnect: () => void;
}

export default function EmptyPortfolioState({ onConnect }: EmptyPortfolioStateProps) {
    return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-6">
            {/* Icon */}
            <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-6 border border-white/10">
                <PieChart className="w-12 h-12 text-white/30" />
            </div>

            {/* Message */}
            <h3 className="text-xl font-bold text-white mb-2">
                No Positions Yet
            </h3>
            <p className="text-white/50 mb-8 max-w-sm leading-relaxed">
                Connect your wallet to view your trading positions and portfolio performance.
            </p>

            {/* CTA */}
            <NeonButton variant="cyan" onClick={onConnect} className="px-8">
                Connect Wallet
            </NeonButton>
        </div>
    );
}
