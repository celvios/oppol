"use client";

import LogoSpinner from "./LogoSpinner";

// Simple full-page loader with just LogoSpinner
export function SkeletonLoader() {
    return (
        <div className="min-h-[60vh] flex items-center justify-center">
            <LogoSpinner size="xl" showText />
        </div>
    );
}

// Full page loader with backdrop
export function FullPageLoader({ message = "Loading..." }: { message?: string }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-void/95 backdrop-blur-sm">
            <LogoSpinner size="xl" showText />
        </div>
    );
}

// Markets list loading
export function MarketsListSkeleton() {
    return (
        <div className="flex items-center justify-center py-20">
            <LogoSpinner size="lg" showText />
        </div>
    );
}

// Card loading placeholder
export function SkeletonCard() {
    return (
        <div className="flex items-center justify-center h-64">
            <LogoSpinner size="md" />
        </div>
    );
}

export default SkeletonLoader;
