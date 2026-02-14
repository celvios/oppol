"use client";

import { motion, HTMLMotionProps } from "framer-motion";
import { twMerge } from "tailwind-merge";
import { Loader2 } from "lucide-react";

interface NeonButtonProps extends HTMLMotionProps<"button"> {
    variant?: "cyan" | "coral" | "green" | "red" | "orange" | "glass";
    isLoading?: boolean;
}

export default function NeonButton({
    children,
    className,
    variant = "cyan",
    isLoading,
    ...props
}: NeonButtonProps) {
    const variants = {
        cyan: "bg-gradient-cyan text-void shadow-[0_0_20px_rgba(82,183,232,0.4)] hover:shadow-[0_0_30px_rgba(82,183,232,0.6)]",
        coral: "bg-gradient-coral text-void shadow-[0_0_20px_rgba(255,46,99,0.4)] hover:shadow-[0_0_30px_rgba(255,46,99,0.6)]",
        green: "bg-outcome-a text-void shadow-[0_0_20px_rgba(74,222,128,0.4)] hover:shadow-[0_0_30px_rgba(74,222,128,0.6)]",
        red: "bg-outcome-b text-void shadow-[0_0_20px_rgba(248,113,113,0.4)] hover:shadow-[0_0_30px_rgba(248,113,113,0.6)]",
        orange: "bg-orange-500 text-void shadow-[0_0_20px_rgba(255,140,0,0.4)] hover:shadow-[0_0_30px_rgba(255,140,0,0.6)] hover:bg-orange-400",
        glass: "bg-white/10 text-white border border-white/10 hover:bg-white/20 backdrop-blur-md",
    };

    return (
        <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={twMerge(
                "relative rounded-lg px-6 py-3 font-heading font-medium tracking-wide flex items-center justify-center gap-2 transition-all duration-300",
                variants[variant],
                isLoading && "opacity-80 cursor-wait",
                className
            )}
            disabled={isLoading}
            {...props}
        >
            {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
            {children as React.ReactNode}
        </motion.button>
    );
}
