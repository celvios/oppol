"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useState } from "react";
import { ChevronRight } from "lucide-react";
import { twMerge } from "tailwind-merge";

interface NeonSliderProps {
    onConfirm: () => void;
    isLoading?: boolean;
    disabled?: boolean;
    side: "YES" | "NO";
}

export default function NeonSlider({ onConfirm, isLoading, disabled, side }: NeonSliderProps) {
    const [complete, setComplete] = useState(false);
    const x = useMotionValue(0);
    const width = 280; // Slider width
    const dragLimit = width - 50; // Max drag distance

    const backgroundOpacity = useTransform(x, [0, dragLimit], [0.1, 1]);
    const glowOpacity = useTransform(x, [0, dragLimit], [0, 0.8]);

    const colorClass = side === "YES" ? "bg-outcome-a" : "bg-outcome-b";
    const shadowClass = side === "YES" ? "shadow-[0_0_20px_rgba(74,222,128,0.5)]" : "shadow-[0_0_20px_rgba(248,113,113,0.5)]";
    const textClass = side === "YES" ? "text-outcome-a" : "text-outcome-b";

    const handleDragEnd = () => {
        if (x.get() > dragLimit - 20) {
            setComplete(true);
            onConfirm();
        } else {
            animate(x, 0, { type: "spring", stiffness: 300, damping: 20 });
        }
    };

    useEffect(() => {
        if (!isLoading && complete) {
            setComplete(false);
            x.set(0);
        }
    }, [isLoading, complete, x]);

    return (
        <div className={twMerge("relative w-full h-14 rounded-full bg-white/10 border border-white/20 overflow-hidden select-none shadow-lg", disabled && "opacity-80 cursor-not-allowed grayscale-[0.5]")}>
            {/* Background Fill */}
            <motion.div
                style={{ opacity: backgroundOpacity, width: x }}
                className={twMerge("absolute inset-y-0 left-0 h-full", colorClass, "opacity-20")}
            />

            {/* Glow Effect */}
            <motion.div
                style={{ opacity: glowOpacity }}
                className={twMerge("absolute inset-y-0 left-0 w-full h-full blur-xl", colorClass)}
            />

            {/* Text */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <span className={twMerge("font-heading font-bold tracking-widest text-sm", textClass)}>
                    {isLoading ? "EXECUTING..." : `SLIDE TO ${side}`}
                </span>
            </div>

            {/* Draggable Handle */}
            <motion.div
                drag={disabled || isLoading ? false : "x"}
                dragConstraints={{ left: 0, right: dragLimit }}
                dragElastic={0.1}
                dragMomentum={false}
                onDragEnd={handleDragEnd}
                style={{ x }}
                className={twMerge(
                    "absolute top-1 left-1 w-12 h-12 rounded-full cursor-grab active:cursor-grabbing flex items-center justify-center z-20 transition-colors",
                    colorClass,
                    shadowClass,
                    "border border-white/20"
                )}
            >
                <ChevronRight className="text-void w-6 h-6" strokeWidth={3} />
            </motion.div>
        </div>
    );
}
