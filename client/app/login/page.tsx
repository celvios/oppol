"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

export default function LoginPage() {
    const router = useRouter();

    useEffect(() => {
        // Web App is now Wallet-Only. Redirect to Terminal.
        router.push("/terminal");
    }, [router]);

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-white">
            <Loader2 className="w-16 h-16 text-primary animate-spin mb-4" />
            <p className="text-white/50 font-mono">Redirecting to Terminal...</p>
        </div>
    );
}
