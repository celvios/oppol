"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2, CheckCircle2, XCircle } from "lucide-react";
import { authApi } from "@/lib/api";

function LoginContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const token = searchParams.get("token");
    const [status, setStatus] = useState<"verifying" | "success" | "error">("verifying");
    const [message, setMessage] = useState("Encrypting connection...");

    useEffect(() => {
        if (!token) {
            setStatus("error");
            setMessage("No login token found.");
            return;
        }

        const verify = async () => {
            try {
                // Simulated "Heavy" Verification Animation delay
                await new Promise((r) => setTimeout(r, 1500));

                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'}/api/auth/verify`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ token }),
                });

                const data = await res.json();

                if (data.success) {
                    localStorage.setItem("session_token", data.token);
                    setStatus("success");
                    setMessage("Identity Verified. Entering Terminal...");
                    setTimeout(() => router.push("/terminal"), 2000);
                } else {
                    setStatus("error");
                    setMessage(data.error || "Verification failed");
                }
            } catch (err) {
                setStatus("error");
                setMessage("Connection Error");
            }
        };

        verify();
    }, [token, router]);

    return (
        <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-white relative overflow-hidden">
            {/* Background Ambient Glow */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/20 blur-[120px] rounded-full pointer-events-none" />

            <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.8 }}
                className="z-10 bg-surface/50 backdrop-blur-xl border border-white/10 p-12 rounded-2xl flex flex-col items-center max-w-md w-full shadow-2xl"
            >
                <div className="mb-8 relative">
                    {status === "verifying" && (
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        >
                            <Loader2 className="w-16 h-16 text-primary" />
                        </motion.div>
                    )}
                    {status === "success" && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="bg-success/20 p-4 rounded-full"
                        >
                            <CheckCircle2 className="w-16 h-16 text-success" />
                        </motion.div>
                    )}
                    {status === "error" && (
                        <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            className="bg-danger/20 p-4 rounded-full"
                        >
                            <XCircle className="w-16 h-16 text-danger" />
                        </motion.div>
                    )}
                </div>

                <h1 className="text-2xl font-mono font-bold tracking-wider mb-2">
                    {status === "verifying" && "AUTHENTICATING"}
                    {status === "success" && "ACCESS GRANTED"}
                    {status === "error" && "ACCESS DENIED"}
                </h1>

                <p className="text-white/50 font-mono text-sm text-center">
                    {message}
                </p>

                {/* Decorative Scanner Line */}
                {status === "verifying" && (
                    <motion.div
                        initial={{ width: "0%" }}
                        animate={{ width: "100%" }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="h-1 bg-primary/50 mt-8 w-full rounded-full"
                    />
                )}
            </motion.div>
        </div>
    );
}

export default function LoginPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen w-full flex flex-col items-center justify-center bg-background text-white">
                <Loader2 className="w-16 h-16 text-primary animate-spin" />
            </div>
        }>
            <LoginContent />
        </Suspense>
    );
}
