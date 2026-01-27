"use client";

import GlassCard from "@/components/ui/GlassCard";
import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import BoostButton from "./BoostButton";

// Outcome colors for multi-outcome markets
const OUTCOME_COLORS = [
    "#27E8A7", // Green
    "#FF2E63", // Red/Coral
    "#00F0FF", // Cyan
    "#FFB800", // Gold
    "#9D4EDD", // Purple
    "#FF6B35", // Orange
];

interface MarketCardProps {
    id: string;
    title: string;
    volume: string;
    // Binary market props (legacy)
    outcomeA?: string;
    outcomeB?: string;
    probA?: number;
    // Multi-outcome props
    outcomes?: string[];
    prices?: number[];
    outcomeCount?: number;
    color?: "cyan" | "coral" | "green";
    // API metadata (optional)
    image_url?: string;
    description?: string;
    isBoosted?: boolean;
}

export default function MarketCard({
    id,
    title,
    volume,
    outcomeA = "Yes",
    outcomeB = "No",
    probA = 0.5,
    outcomes,
    prices,
    outcomeCount = 2,
    color = "cyan",
    image_url,
    description,
    isBoosted
}: MarketCardProps) {
    // Use API metadata - no fallback, API is source of truth
    // Base64 images should start with 'data:image/' or be a valid URL
    const isValidImage = (img: string | undefined): boolean => {
        if (!img || !img.trim()) return false;
        const trimmed = img.trim();
        // Check if it's a base64 data URI or a valid URL
        return trimmed.startsWith('data:image/') ||
            trimmed.startsWith('http://') ||
            trimmed.startsWith('https://') ||
            trimmed.startsWith('/');
    };

    const metadata = {
        image: image_url && isValidImage(image_url) ? image_url.trim() : '',
        description: description && description.trim() ? description : '',
        category: 'General'
    };

    // Determine if this is a multi-outcome market (more than 2 outcomes)
    const isMultiOutcome = outcomeCount > 2 || (outcomes && outcomes.length > 2);

    // For multi-outcome: find leading outcome
    let leadingOutcome = outcomeA;
    let leadingPrice = Math.round(probA * 100);
    let displayOutcomes: { name: string; price: number; color: string }[] = [];

    if (isMultiOutcome && outcomes && prices) {
        // Find the leading outcome (highest price)
        let maxIndex = 0;
        let maxPrice = prices[0];
        prices.forEach((p, i) => {
            if (p > maxPrice) {
                maxPrice = p;
                maxIndex = i;
            }
        });
        leadingOutcome = outcomes[maxIndex];
        leadingPrice = Math.round(maxPrice);

        // Build display outcomes for mini-bar
        displayOutcomes = outcomes.map((name, i) => ({
            name,
            price: prices[i],
            color: OUTCOME_COLORS[i % OUTCOME_COLORS.length]
        }));
    } else {
        // Binary market
        const percentA = Math.round(probA * 100);
        const percentB = 100 - percentA;
        displayOutcomes = [
            { name: outcomeA, price: percentA, color: OUTCOME_COLORS[0] },
            { name: outcomeB, price: percentB, color: OUTCOME_COLORS[1] }
        ];
    }

    return (
        <Link href={`/?marketId=${id}`}>
            <GlassCard
                className="h-64 group cursor-pointer border-white/5 hover:border-outcome-a/30 overflow-hidden"
                whileHover={{ y: -5, scale: 1.02 }}
            >
                {/* Image Header - Only show if image exists and is valid */}
                {metadata.image && metadata.image.length > 0 && (
                    <div className="absolute inset-0 h-32 z-0">
                        <img
                            src={metadata.image}
                            alt={title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                                // Hide image on error
                                const target = e.currentTarget;
                                target.style.display = 'none';
                                // Also hide the parent div
                                const parent = target.parentElement;
                                if (parent) parent.style.display = 'none';
                            }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-void/50 to-void" />
                    </div>
                )}

                {/* Content */}
                <div className="relative z-10 flex flex-col justify-end h-full p-5">

                    {/* Title */}
                    <div className="mb-4">
                        <h3 className="text-xl font-heading font-bold leading-tight group-hover:text-outcome-a transition-colors">
                            {title}
                        </h3>
                        {/* Description - Show if available */}
                        {metadata.description && (
                            <p className="text-xs text-white/60 mt-2 line-clamp-2 leading-relaxed">
                                {metadata.description}
                            </p>
                        )}
                        <p className="text-xs text-text-secondary mt-1 font-mono">Vol: {volume}</p>

                        {/* Boost Button - Prevent bubbling */}
                        <div className="mt-2" onClick={(e) => e.preventDefault()}>
                            <BoostButton marketId={id} isBoosted={isBoosted} />
                        </div>
                    </div>

                    {isMultiOutcome ? (
                        /* Multi-outcome display */
                        <div className="space-y-2">
                            {/* Leading outcome */}
                            <div className="flex justify-between text-xs font-mono uppercase tracking-wider">
                                <span className="text-neon-green">Leading: {leadingOutcome}</span>
                                <span className="text-white">{leadingPrice}%</span>
                            </div>

                            {/* Mini distribution bar */}
                            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden flex">
                                {displayOutcomes.map((outcome, i) => (
                                    <div
                                        key={i}
                                        className="h-full transition-all duration-500"
                                        style={{
                                            width: `${outcome.price}%`,
                                            backgroundColor: outcome.color,
                                            minWidth: outcome.price > 0 ? '2px' : '0'
                                        }}
                                    />
                                ))}
                            </div>

                            {/* Outcome count badge */}
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-white/40 font-mono">
                                    {outcomes?.length || outcomeCount} outcomes
                                </span>
                                <span className="text-[10px] px-2 py-0.5 bg-white/10 rounded-full text-white/60">
                                    {metadata.category}
                                </span>
                            </div>
                        </div>
                    ) : (
                        /* Binary (YES/NO) display */
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-mono uppercase tracking-wider">
                                <span className="text-outcome-a">{outcomeA} {displayOutcomes[0]?.price}%</span>
                                <span className="text-outcome-b">{displayOutcomes[1]?.price}% {outcomeB}</span>
                            </div>
                            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden flex">
                                <div
                                    className="h-full bg-outcome-a shadow-[0_0_10px_vars(--outcome-a)] transition-all duration-1000"
                                    style={{ width: `${displayOutcomes[0]?.price}%` }}
                                />
                                <div
                                    className="h-full bg-outcome-b shadow-[0_0_10px_vars(--outcome-b)] transition-all duration-1000"
                                    style={{ width: `${displayOutcomes[1]?.price}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {/* Hover Action */}
                    <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all duration-300 transform translate-x-2 group-hover:translate-x-0">
                        <div className="p-2 rounded-full bg-white/10 backdrop-blur-md border border-white/20">
                            <ArrowUpRight className="w-4 h-4 text-white" />
                        </div>
                    </div>
                </div>
            </GlassCard>
        </Link>
    );
}
