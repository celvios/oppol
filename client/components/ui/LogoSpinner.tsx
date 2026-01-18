"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface LogoSpinnerProps {
    size?: "sm" | "md" | "lg" | "xl";
    className?: string;
    showText?: boolean;
}

const sizeMap = {
    sm: { logo: 24, text: "text-sm" },
    md: { logo: 40, text: "text-lg" },
    lg: { logo: 64, text: "text-2xl" },
    xl: { logo: 96, text: "text-4xl" },
};

export default function LogoSpinner({ size = "md", className, showText = false }: LogoSpinnerProps) {
    const { logo, text } = sizeMap[size];

    return (
        <div className={cn("flex flex-col items-center justify-center gap-3", className)}>
            {/* Spinning Logo with Glow */}
            <motion.div
                className="relative"
                animate={{ rotate: 360 }}
                transition={{
                    duration: 2,
                    repeat: Infinity,
                    ease: "linear",
                }}
            >
                {/* Glow Effect */}
                <div
                    className="absolute inset-0 rounded-full blur-xl opacity-50"
                    style={{
                        background: "radial-gradient(circle, rgba(0,255,255,0.4) 0%, transparent 70%)",
                        transform: "scale(1.5)",
                    }}
                />

                {/* Logo */}
                <img
                    src="/logo.png"
                    alt="OPOLL"
                    width={logo}
                    height={logo}
                    className="relative z-10 drop-shadow-[0_0_10px_rgba(0,255,255,0.5)]"
                />
            </motion.div>

            {/* Optional Loading Text */}
            {showText && (
                <motion.p
                    className={cn("font-heading font-bold text-white/60", text)}
                    animate={{ opacity: [0.4, 1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                >
                    Loading...
                </motion.p>
            )}
        </div>
    );
}

// Compact inline spinner for buttons/small areas
export function LogoSpinnerInline({ size = 16 }: { size?: number }) {
    return (
        <motion.img
            src="/logo.png"
            alt=""
            width={size}
            height={size}
            animate={{ rotate: 360 }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            className="inline-block"
        />
    );
}
