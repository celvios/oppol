import { SkeletonLoader } from "@/components/ui/SkeletonLoader";

export default function Loading() {
    return (
        <div className="w-full min-h-screen p-4 md:p-8 space-y-8">
            <SkeletonLoader />
        </div>
    );
}
