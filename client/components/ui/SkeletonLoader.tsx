"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import LogoSpinner from "./LogoSpinner";

// Base shimmer skeleton element
function Shimmer({ className }: { className?: string }) {
    return (
        <div
            className={cn(
                "relative overflow-hidden rounded-lg bg-white/5",
                className
            )}
        >
            <motion.div
                className="absolute inset-0"
                style={{
                    background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)",
                }}
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            />
        </div>
    );
}

// Full page loader with logo spinner
export function FullPageLoader({ message = "Loading..." }: { message?: string }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/95 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-6">
                <LogoSpinner size="xl" />
                <motion.p
                    className="text-lg font-heading text-white/60"
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                >
                    {message}
                </motion.p>
            </div>
        </div>
    );
}

// Enhanced SkeletonLoader with LogoSpinner integration
export function SkeletonLoader() {
    return (
        <div className="space-y-8" suppressHydrationWarning={true}>
            {/* Logo Spinner Header */}
            <div className="flex justify-center py-8">
                <LogoSpinner size="lg" showText />
            </div>

            {/* Header Skeleton */}
            <div className="flex justify-between items-end border-b border-white/5 pb-6" suppressHydrationWarning={true}>
                <div className="space-y-3" suppressHydrationWarning={true}>
                    <Shimmer className="h-8 w-64" />
                    <Shimmer className="h-4 w-32" />
                </div>
                <div className="text-right space-y-2" suppressHydrationWarning={true}>
                    <Shimmer className="h-3 w-20 ml-auto" />
                    <Shimmer className="h-6 w-32 ml-auto" />
                </div>
            </div>

            {/* Grid Skeleton */}
            <div className="grid grid-cols-12 gap-6 min-h-[600px]" suppressHydrationWarning={true}>

                {/* Main Content */}
                <div className="col-span-12 lg:col-span-9 flex flex-col gap-6" suppressHydrationWarning={true}>
                    {/* Featured Card Skeleton */}
                    <div className="bg-white/5 rounded-2xl p-6 flex-1 border border-white/5" suppressHydrationWarning={true}>
                        <div className="flex justify-between mb-8" suppressHydrationWarning={true}>
                            <div className="space-y-3" suppressHydrationWarning={true}>
                                <Shimmer className="h-4 w-20" />
                                <Shimmer className="h-8 w-96" />
                            </div>
                            <div className="text-right space-y-2" suppressHydrationWarning={true}>
                                <Shimmer className="h-10 w-24 ml-auto" />
                                <Shimmer className="h-3 w-16 ml-auto" />
                            </div>
                        </div>
                        {/* Chart Area */}
                        <Shimmer className="w-full h-[300px] rounded-xl" />
                    </div>

                    {/* Stats Row Skeleton */}
                    <div className="grid grid-cols-3 gap-6" suppressHydrationWarning={true}>
                        {[1, 2, 3].map((i) => (
                            <motion.div
                                key={i}
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: i * 0.1 }}
                            >
                                <Shimmer className="h-20 rounded-xl" />
                            </motion.div>
                        ))}
                    </div>
                </div>

                {/* Right Panel Skeleton */}
                <div className="col-span-12 lg:col-span-3 bg-white/5 border-l border-white/5 -my-8 -mr-8 p-6" suppressHydrationWarning={true}>
                    <Shimmer className="h-4 w-32 mb-8" />

                    <div className="grid grid-cols-2 gap-2 mb-6" suppressHydrationWarning={true}>
                        <Shimmer className="h-12 rounded-lg" />
                        <Shimmer className="h-12 rounded-lg" />
                    </div>

                    <div className="space-y-6" suppressHydrationWarning={true}>
                        <Shimmer className="h-12 rounded-lg" />
                        <div className="space-y-2" suppressHydrationWarning={true}>
                            <div className="flex justify-between" suppressHydrationWarning={true}>
                                <Shimmer className="h-3 w-20" />
                                <Shimmer className="h-3 w-10" />
                            </div>
                            <div className="flex justify-between" suppressHydrationWarning={true}>
                                <Shimmer className="h-3 w-20" />
                                <Shimmer className="h-3 w-10" />
                            </div>
                        </div>
                    </div>

                    <div className="mt-auto pt-8 space-y-3" suppressHydrationWarning={true}>
                        <Shimmer className="h-3 w-full" />
                        <Shimmer className="h-3 w-full" />
                    </div>
                </div>
            </div>
        </div>
    );
}

// Card skeleton for market cards
export function SkeletonCard() {
    return (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4 space-y-4">
            <Shimmer className="h-40 w-full rounded-xl" />
            <div className="space-y-2">
                <Shimmer className="h-5 w-3/4" />
                <Shimmer className="h-4 w-1/2" />
            </div>
            <div className="flex gap-4">
                <Shimmer className="h-8 w-20 rounded-full" />
                <Shimmer className="h-8 w-20 rounded-full" />
            </div>
        </div>
    );
}

// Markets list skeleton with staggered animation
export function MarketsListSkeleton({ count = 6 }: { count?: number }) {
    return (
        <div className="space-y-6">
            <div className="flex items-center justify-center py-8">
                <LogoSpinner size="lg" showText />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: count }).map((_, i) => (
                    <motion.div
                        key={i}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                    >
                        <SkeletonCard />
                    </motion.div>
                ))}
            </div>
        </div>
    );
}
