"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import Link from "next/link";

interface LogoBrandProps {
    size?: "sm" | "md" | "lg";
    className?: string;
    href?: string;
    animate?: boolean;
}

const sizeMap = {
    sm: { logo: 20, text: "text-lg", gap: "gap-0.5" },
    md: { logo: 28, text: "text-xl", gap: "gap-1" },
    lg: { logo: 36, text: "text-3xl", gap: "gap-1.5" },
};

export default function LogoBrand({ size = "md", className, href = "/", animate = true }: LogoBrandProps) {
    const { logo, text, gap } = sizeMap[size];

    const content = (
        <motion.div
            className={cn("flex items-center", gap, className)}
            whileHover={animate ? { scale: 1.02 } : undefined}
            whileTap={animate ? { scale: 0.98 } : undefined}
        >
            {/* Logo replacing "O" */}
            <motion.div
                className="relative flex-shrink-0"
                whileHover={animate ? { rotate: [0, -5, 5, 0] } : undefined}
                transition={{ duration: 0.4 }}
            >
                {/* Subtle glow on hover */}
                <div
                    className="absolute inset-0 rounded-full blur-md opacity-0 group-hover:opacity-60 transition-opacity"
                    style={{
                        background: "radial-gradient(circle, rgba(0,255,255,0.5) 0%, transparent 70%)",
                        transform: "scale(1.3)",
                    }}
                />
                <img
                    src="/logo.png"
                    alt="O"
                    width={logo}
                    height={logo}
                    className="relative z-10 drop-shadow-[0_0_8px_rgba(0,255,255,0.4)]"
                    style={{ marginBottom: "-2px" }} // Align with text baseline
                />
            </motion.div>

            {/* "POLL" text */}
            <span
                className={cn(
                    "font-heading font-black tracking-wide text-white",
                    text
                )}
                style={{
                    textShadow: "0 0 20px rgba(0,255,255,0.3)",
                }}
            >
                POLL
            </span>
        </motion.div>
    );

    if (href) {
        return (
            <Link href={href} className="group">
                {content}
            </Link>
        );
    }

    return content;
}
