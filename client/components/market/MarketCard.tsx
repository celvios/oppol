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
    endTime?: number;
    resolved?: boolean;
    winningOutcome?: number;
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
    isBoosted,
    endTime,
    resolved = false,
    winningOutcome
}: MarketCardProps) {

    // Check if market has ended
    const isEnded = endTime ? (Date.now() > (endTime * 1000)) : false;

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

    const getImageUrl = () => {
        let img = image_url || '';
        if (!isValidImage(img) && isValidImage(description)) {
            img = description as string;
        }
        return img && isValidImage(img) ? img.trim() : '';
    };

    const getDescription = () => {
        let desc = description && description.trim() ? description : '';
        if (isValidImage(desc) && !isValidImage(image_url)) {
            desc = image_url || '';
        }
        return desc;
    };

    const metadata = {
        image: getImageUrl(),
        description: getDescription(),
        category: 'General'
    };

    // Determine if this is a multi-outcome market (more than 2 outcomes)
    const isMultiOutcome = outcomeCount > 2 || (outcomes && outcomes.length > 2);

    // For multi-outcome: find leading outcome
    let leadingOutcome = outcomeA;
    let leadingPrice = Math.round(probA * 100);
    let displayOutcomes: { name: string; price: number; displayPrice?: string; color: string }[] = [];

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
        // Calculate percentages with 1 decimal precision if needed
        const rawPercentA = probA * 100;
        const rawPercentB = 100 - rawPercentA;

        // Helper to format: 50 -> "50", 49.9 -> "49.9"
        const formatPercent = (n: number) => {
            if (Math.abs(Math.round(n) - n) < 0.05) return Math.round(n).toString();
            return n.toFixed(1);
        };

        const percentA = formatPercent(rawPercentA);
        const percentB = formatPercent(rawPercentB);

        displayOutcomes = [
            { name: outcomeA, price: Number(percentA), displayPrice: percentA, color: OUTCOME_COLORS[0] },
            { name: outcomeB, price: Number(percentB), displayPrice: percentB, color: OUTCOME_COLORS[1] }
        ];
    }

    return (
        <Link href={`/multi?marketId=${id}`} prefetch={true}>
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

                {/* Status Badges */}
                <div className="absolute top-4 left-4 z-20 flex gap-2">
                    {metadata.category && (
                        <span className="px-2 py-1 bg-black/40 backdrop-blur-md rounded-lg text-[10px] font-mono text-white/70 border border-white/10">
                            {metadata.category}
                        </span>
                    )}

                    {/* Resolved / Ended Badges */}
                    {isBoosted && (
                        <span className="px-2 py-1 bg-amber-500/20 backdrop-blur-md rounded-lg text-[10px] font-mono text-amber-400 border border-amber-500/30 flex items-center gap-1 shadow-[0_0_10px_rgba(245,158,11,0.2)]">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-pulse" />
                            BOOSTED
                        </span>
                    )}

                    {resolved ? (
                        <span className="px-2 py-1 bg-neon-green/20 backdrop-blur-md rounded-lg text-[10px] font-mono text-neon-green border border-neon-green/30 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
                            RESOLVED
                        </span>
                    ) : isEnded ? (
                        <span className="px-2 py-1 bg-orange-500/20 backdrop-blur-md rounded-lg text-[10px] font-mono text-orange-400 border border-orange-500/30 flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-orange-400" />
                            AWAITING RESOLUTION
                        </span>
                    ) : null}
                </div>

                {/* Content */}
                <div className={`relative z-10 flex flex-col justify-end h-full p-5 ${isEnded ? 'grayscale-[50%]' : ''}`}>

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
                        {!isEnded && (
                            <div className="mt-2" onClick={(e) => e.preventDefault()}>
                                <BoostButton marketId={id} isBoosted={isBoosted} />
                            </div>
                        )}
                    </div>

                    {isMultiOutcome ? (
                        /* Multi-outcome display */
                        <div className="space-y-2">
                            {/* Leading outcome */}
                            <div className="flex justify-between text-xs font-mono uppercase tracking-wider">
                                <span className="text-neon-green">
                                    {resolved ? `Winner: ${outcomes?.[winningOutcome || 0]}` : `Leading: ${leadingOutcome}`}
                                </span>
                                <span className="text-white">{resolved ? '100%' : `${leadingPrice}%`}</span>
                            </div>

                            {/* Mini distribution bar */}
                            <div className="h-2 w-full bg-white/10 rounded-full overflow-hidden flex">
                                {displayOutcomes.map((outcome, i) => (
                                    <div
                                        key={i}
                                        className="h-full transition-all duration-500"
                                        style={{
                                            width: resolved
                                                ? (i === winningOutcome ? '100%' : '0%')
                                                : `${outcome.price}%`,
                                            backgroundColor: outcome.color,
                                            minWidth: (resolved && i !== winningOutcome) ? '0' : (outcome.price > 0 ? '2px' : '0')
                                        }}
                                    />
                                ))}
                            </div>

                            {/* Outcome count badge */}
                            <div className="flex justify-between items-center">
                                <span className="text-[10px] text-white/40 font-mono">
                                    {outcomes?.length || outcomeCount} outcomes
                                </span>
                            </div>
                        </div>
                    ) : (
                        /* Binary (YES/NO) display */
                        <div className="space-y-2">
                            <div className="flex justify-between text-xs font-mono uppercase tracking-wider">
                                <span className={`${resolved && winningOutcome === 0 ? 'text-neon-green font-bold' : 'text-outcome-a'}`}>
                                    {outcomeA} {resolved ? (winningOutcome === 0 ? 'WIN' : '') : `${displayOutcomes[0]?.displayPrice || displayOutcomes[0]?.price}%`}
                                </span>
                                <span className={`${resolved && winningOutcome === 1 ? 'text-neon-green font-bold' : 'text-outcome-b'}`}>
                                    {resolved ? (winningOutcome === 1 ? 'WIN' : '') : `${displayOutcomes[1]?.displayPrice || displayOutcomes[1]?.price}%`} {outcomeB}
                                </span>
                            </div>
                            <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden flex">
                                <div
                                    className="h-full bg-outcome-a shadow-[0_0_10px_vars(--outcome-a)] transition-all duration-1000"
                                    style={{ width: resolved ? (winningOutcome === 0 ? '100%' : '0%') : `${displayOutcomes[0]?.price}%` }}
                                />
                                <div
                                    className="h-full bg-outcome-b shadow-[0_0_10px_vars(--outcome-b)] transition-all duration-1000"
                                    style={{ width: resolved ? (winningOutcome === 1 ? '100%' : '0%') : `${displayOutcomes[1]?.price}%` }}
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
        </Link >
    );
}
