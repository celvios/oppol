"use client";

import GlassCard from "./GlassCard";

// Helper for shimmering blocks
const SkeletonBlock = ({ className = "" }: { className?: string }) => (
    <div className={`bg-white/5 animate-pulse rounded-lg ${className}`} />
);

// Helper for shimmering text lines
const SkeletonText = ({ width = "w-full", height = "h-4", className = "" }: { width?: string, height?: string, className?: string }) => (
    <div className={`bg-white/5 animate-pulse rounded ${width} ${height} ${className}`} />
);

// Generic Skeleton for Portfolio, Deposit, etc.
export function GenericSkeleton() {
    return (
        <div className="min-h-screen p-4 md:p-8 max-w-7xl mx-auto space-y-6">
            <div className="flex justify-between items-center mb-8">
                <SkeletonBlock className="w-48 h-10" />
                <SkeletonBlock className="w-32 h-10 rounded-full" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2 space-y-6">
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-6 h-[200px]">
                        <SkeletonText width="w-32" height="h-6" className="mb-4" />
                        <div className="flex gap-4 items-end mt-8">
                            <SkeletonBlock className="w-1/3 h-16" />
                            <SkeletonBlock className="w-1/3 h-16" />
                            <SkeletonBlock className="w-1/3 h-16" />
                        </div>
                    </div>
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-6 h-[400px]">
                        <SkeletonText width="w-48" height="h-6" className="mb-6" />
                        <div className="space-y-4">
                            {[1, 2, 3, 4, 5].map(i => (
                                <div key={i} className="flex gap-4">
                                    <SkeletonBlock className="w-12 h-12 rounded-full" />
                                    <div className="flex-1 space-y-2">
                                        <SkeletonText width="w-3/4" />
                                        <SkeletonText width="w-1/2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                {/* Sidebar Area */}
                <div className="md:col-span-1 space-y-6">
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-6 h-[300px]">
                        <SkeletonText width="w-32" className="mb-4" />
                        <SkeletonBlock className="w-full h-32 mb-4" />
                        <SkeletonText width="w-full" />
                        <SkeletonText width="w-2/3" />
                    </div>
                </div>
            </div>
        </div>
    );
}

// Detailed Terminal Skeleton matching the actual layout
export function TerminalSkeleton() {
    return (
        <div className="min-h-screen w-full">
            {/* MOBILE VIEW SKELETON (< 768px) */}
            <div className="md:hidden flex flex-col gap-4 p-4 pb-32">
                {/* Header Row */}
                <div className="flex justify-between items-center mb-2">
                    <SkeletonBlock className="w-24 h-8" />
                    <SkeletonBlock className="w-24 h-8 rounded-full" />
                </div>

                {/* Featured Carousel Placeholder */}
                <SkeletonBlock className="w-full h-40 rounded-xl mb-2" />

                {/* Market Hero Card */}
                <div className="relative overflow-hidden rounded-2xl bg-white/5 border border-white/10 h-[400px]">
                    {/* Image Placeholder */}
                    <div className="h-48 bg-white/5 animate-pulse" />

                    <div className="p-6 space-y-4">
                        {/* Icon + Title */}
                        <div className="flex gap-4">
                            <SkeletonBlock className="w-12 h-12 rounded-full flex-shrink-0" />
                            <div className="space-y-2 flex-1">
                                <SkeletonText width="w-3/4" height="h-6" />
                                <SkeletonText width="w-1/2" height="h-4" />
                            </div>
                        </div>

                        {/* Description */}
                        <div className="space-y-2">
                            <SkeletonText width="w-full" />
                            <SkeletonText width="w-full" />
                            <SkeletonText width="w-2/3" />
                        </div>

                        {/* Big Stats */}
                        <div className="pt-4">
                            <SkeletonText width="w-32" height="h-10" />
                        </div>
                    </div>
                </div>

                {/* Chart Card */}
                <div className="rounded-2xl bg-white/5 border border-white/10 p-4 h-[250px]">
                    <div className="flex justify-between mb-4">
                        <SkeletonText width="w-24" />
                        <SkeletonBlock className="w-8 h-8 rounded-lg" />
                    </div>
                    <SkeletonBlock className="w-full h-[180px]" />
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 h-24">
                        <SkeletonText width="w-16" className="mb-2" />
                        <SkeletonText width="w-24" height="h-8" />
                    </div>
                    <div className="rounded-2xl bg-white/5 border border-white/10 p-4 h-24">
                        <SkeletonText width="w-16" className="mb-2" />
                        <SkeletonText width="w-24" height="h-8" />
                    </div>
                </div>

                {/* Outcome Buttons */}
                <div className="space-y-3">
                    <SkeletonText width="w-32" className="mb-2" />
                    <SkeletonBlock className="w-full h-16 rounded-xl" />
                    <SkeletonBlock className="w-full h-16 rounded-xl" />
                </div>
            </div>

            {/* DESKTOP VIEW SKELETON (>= 768px) */}
            <div className="hidden md:grid grid-cols-12 gap-6 p-6 min-h-screen">
                {/* Left Col: Market List */}
                <div className="col-span-3 flex flex-col gap-4">
                    {/* Featured Carousel */}
                    <SkeletonBlock className="w-full h-48 rounded-2xl" />

                    {/* Search Bar */}
                    <SkeletonBlock className="w-full h-12 rounded-xl" />

                    {/* Market List Items */}
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="p-4 rounded-xl border border-white/5 bg-white/5">
                            <div className="flex gap-3 mb-3">
                                <SkeletonBlock className="w-12 h-12 rounded-lg" />
                                <div className="space-y-2 flex-1">
                                    <SkeletonText width="w-3/4" />
                                    <SkeletonText width="w-1/2" height="h-3" />
                                </div>
                            </div>
                            <SkeletonBlock className="w-full h-2 rounded" />
                        </div>
                    ))}
                </div>

                {/* Center Col: Main Market */}
                <div className="col-span-6 flex flex-col gap-6">
                    {/* Hero Card */}
                    <div className="rounded-2xl border border-white/5 bg-white/5 p-6 h-[400px] relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-2/3 h-full bg-white/5 animate-pulse opacity-10" />
                        <div className="relative z-10 space-y-6 mt-8">
                            <div className="flex gap-2">
                                <SkeletonBlock className="w-20 h-6 rounded-full" />
                                <SkeletonBlock className="w-20 h-6 rounded-full" />
                            </div>
                            <SkeletonText width="w-3/4" height="h-10" />
                            <div className="space-y-2 max-w-lg">
                                <SkeletonText width="w-full" />
                                <SkeletonText width="w-5/6" />
                            </div>
                            <div className="flex gap-8 pt-6">
                                <div>
                                    <SkeletonText width="w-16" className="mb-2" />
                                    <SkeletonText width="w-24" height="h-8" />
                                </div>
                                <div className="w-px h-12 bg-white/10" />
                                <div>
                                    <SkeletonText width="w-16" className="mb-2" />
                                    <SkeletonText width="w-24" height="h-8" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Chart Card */}
                    <div className="rounded-2xl border border-white/5 bg-white/5 p-6 h-[500px]">
                        <div className="flex justify-between mb-6">
                            <SkeletonText width="w-32" height="h-6" />
                            <SkeletonBlock className="w-8 h-8 rounded-lg" />
                        </div>
                        <SkeletonBlock className="w-full h-[300px] mb-6" />
                        <div className="space-y-3">
                            <SkeletonText width="w-40" />
                            <SkeletonBlock className="w-full h-12 rounded-lg" />
                            <SkeletonBlock className="w-full h-12 rounded-lg" />
                        </div>
                    </div>
                </div>

                {/* Right Col: Order Book / Trade */}
                <div className="col-span-3 flex flex-col gap-4">
                    <div className="rounded-2xl border border-white/5 bg-white/5 p-6 h-[600px]">
                        <div className="flex gap-2 mb-6">
                            <SkeletonBlock className="w-1/2 h-10 rounded-lg" />
                            <SkeletonBlock className="w-1/2 h-10 rounded-lg" />
                        </div>
                        <div className="space-y-4">
                            <SkeletonText width="w-24" />
                            <SkeletonBlock className="w-full h-12 rounded-lg" />
                            <div className="flex justify-between">
                                <SkeletonText width="w-20" />
                                <SkeletonText width="w-20" />
                            </div>
                            <SkeletonBlock className="w-full h-12 rounded-lg" />

                            <div className="pt-8 space-y-2">
                                <SkeletonText width="w-full" height="h-8" />
                                <SkeletonText width="w-full" height="h-8" />
                                <SkeletonText width="w-full" height="h-8" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Default export uses GenericSkeleton for general page loading
export function SkeletonLoader() {
    return <GenericSkeleton />;
}

export default SkeletonLoader;
