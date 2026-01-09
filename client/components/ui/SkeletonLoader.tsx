export function SkeletonLoader() {
    return (
        <div className="space-y-8 animate-pulse">
            {/* Header Skeleton */}
            <div className="flex justify-between items-end border-b border-white/5 pb-6">
                <div className="space-y-3">
                    <div className="h-8 w-64 bg-white/10 rounded"></div>
                    <div className="h-4 w-32 bg-white/5 rounded"></div>
                </div>
                <div className="text-right space-y-2">
                    <div className="h-3 w-20 bg-white/5 rounded ml-auto"></div>
                    <div className="h-6 w-32 bg-white/10 rounded ml-auto"></div>
                </div>
            </div>

            {/* Grid Skeleton */}
            <div className="grid grid-cols-12 gap-6 h-[600px]">

                {/* Main Content */}
                <div className="col-span-12 lg:col-span-9 flex flex-col gap-6">
                    {/* Featured Card Skeleton */}
                    <div className="bg-white/5 rounded-2xl p-6 flex-1 border border-white/5">
                        <div className="flex justify-between mb-8">
                            <div className="space-y-3">
                                <div className="h-4 w-20 bg-white/10 rounded"></div>
                                <div className="h-8 w-96 bg-white/10 rounded"></div>
                            </div>
                            <div className="text-right space-y-2">
                                <div className="h-10 w-24 bg-white/10 rounded ml-auto"></div>
                                <div className="h-3 w-16 bg-white/5 rounded ml-auto"></div>
                            </div>
                        </div>
                        {/* Chart Area */}
                        <div className="w-full h-[300px] bg-white/5 rounded-xl"></div>
                    </div>

                    {/* Stats Row Skeleton */}
                    <div className="grid grid-cols-3 gap-6">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-white/5 rounded-xl p-4 h-20 border border-white/5"></div>
                        ))}
                    </div>
                </div>

                {/* Right Panel Skeleton */}
                <div className="col-span-12 lg:col-span-3 bg-white/5 border-l border-white/5 -my-8 -mr-8 p-6">
                    <div className="h-4 w-32 bg-white/10 rounded mb-8"></div>

                    <div className="grid grid-cols-2 gap-2 mb-6">
                        <div className="h-12 bg-white/10 rounded-lg"></div>
                        <div className="h-12 bg-white/10 rounded-lg"></div>
                    </div>

                    <div className="space-y-6">
                        <div className="h-12 bg-white/5 rounded-lg"></div>
                        <div className="space-y-2">
                            <div className="flex justify-between"><div className="h-3 w-20 bg-white/5 rounded"></div><div className="h-3 w-10 bg-white/5 rounded"></div></div>
                            <div className="flex justify-between"><div className="h-3 w-20 bg-white/5 rounded"></div><div className="h-3 w-10 bg-white/5 rounded"></div></div>
                        </div>
                    </div>

                    <div className="mt-auto pt-8 space-y-3">
                        <div className="h-3 w-full bg-white/5 rounded"></div>
                        <div className="h-3 w-full bg-white/5 rounded"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
