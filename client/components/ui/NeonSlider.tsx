"use client";

import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useState, useRef } from "react";
import { ChevronRight, Loader2 } from "lucide-react";
import { twMerge } from "tailwind-merge";

interface NeonSliderProps {
    onConfirm: () => void;
    isLoading?: boolean;
    disabled?: boolean;
    side: string;
    color?: string; // Custom color override for multi-outcome support
}

export default function NeonSlider({ onConfirm, isLoading, disabled, side, color }: NeonSliderProps) {
    const [complete, setComplete] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const x = useMotionValue(0);

    // Dynamic width calculation
    const [dragLimit, setDragLimit] = useState(230);

    useEffect(() => {
        const updateDragLimit = () => {
            if (containerRef.current) {
                const containerWidth = containerRef.current.offsetWidth;
                const newLimit = containerWidth - 56; // Container width minus handle size
                setDragLimit(newLimit);
            }
        };

        updateDragLimit();
        window.addEventListener('resize', updateDragLimit);
        return () => window.removeEventListener('resize', updateDragLimit);
    }, []);

    const backgroundWidth = useTransform(x, [0, dragLimit], [56, dragLimit + 56]);
    const progressOpacity = useTransform(x, [0, dragLimit * 0.5, dragLimit], [0.3, 0.6, 1]);

    // Use custom color if provided, otherwise fallback to standard YES/NO logic
    const colorStyle = color ? { backgroundColor: color, color: color } : {};
    const shadowStyle = color ? { boxShadow: `0 0 30px ${color}60` } : {};

    const colorClass = color ? "" : (side === "YES" ? "bg-outcome-a" : "bg-outcome-b");
    const shadowClass = color ? "" : (side === "YES" ? "shadow-[0_0_30px_rgba(74,222,128,0.6)]" : "shadow-[0_0_30px_rgba(248,113,113,0.6)]");
    const textClass = color ? "" : (side === "YES" ? "text-outcome-a" : "text-outcome-b");

    const handleDragEnd = () => {
        const currentX = x.get();
        const threshold = dragLimit * 0.6; // Lower threshold for easier completion

        console.log('Drag ended:', { currentX, threshold, dragLimit });

        if (currentX >= threshold && !disabled && !isLoading) {
            // Snap to end and confirm
            animate(x, dragLimit, { type: "spring", stiffness: 400, damping: 30 });
            setComplete(true);
            setTimeout(() => onConfirm(), 100); // Small delay for visual feedback
        } else {
            // Snap back smoothly
            animate(x, 0, { type: "spring", stiffness: 400, damping: 30 });
        }
    };

    // Reset when loading completes
    useEffect(() => {
        if (!isLoading && complete) {
            setTimeout(() => {
                setComplete(false);
                animate(x, 0, { type: "spring", stiffness: 300, damping: 25 });
            }, 500);
        }
    }, [isLoading, complete, x]);

    return (
        <div
            ref={containerRef}
            className={twMerge(
                "relative w-full h-14 rounded-full bg-white/5 border border-white/10 overflow-hidden select-none",
                disabled && "opacity-50 cursor-not-allowed"
            )}
            style={{ touchAction: 'pan-y' }} // Allow vertical scroll, capture horizontal
        >
            {/* Progress Fill */}
            <motion.div
                style={{ width: backgroundWidth, opacity: progressOpacity, ...colorStyle, color: undefined }} // Set bg color via style
                className={twMerge("absolute inset-y-0 left-0 h-full rounded-full", colorClass)}
            />

            {/* Text */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
                <span
                    className={twMerge("font-heading font-bold tracking-widest text-sm", isLoading ? "text-white" : textClass)}
                    style={(!isLoading && color) ? { color: color } : {}}
                >
                    {isLoading ? (
                        <span className="flex items-center gap-2">
                            <Loader2 className="w-4 h-4 animate-spin" />
                            EXECUTING...
                        </span>
                    ) : complete ? (
                        "CONFIRMED!"
                    ) : (
                        `SLIDE TO BUY ${side}`
                    )}
                </span>
            </div>

            {/* Draggable Handle */}
            <motion.div
                drag={disabled || isLoading || complete ? false : "x"}
                dragConstraints={{ left: 0, right: dragLimit }}
                dragElastic={0} // No elastic/bounce
                dragMomentum={false}
                onDragEnd={handleDragEnd}
                style={{ x, ...colorStyle, color: undefined, ...shadowStyle }}
                whileDrag={{ scale: 1.05 }}
                className={twMerge(
                    "absolute top-1 left-1 w-12 h-12 rounded-full cursor-grab active:cursor-grabbing flex items-center justify-center z-20",
                    colorClass,
                    shadowClass,
                    "border border-white/30 backdrop-blur-sm"
                )}
            >
                {isLoading ? (
                    <Loader2 className="text-void w-5 h-5 animate-spin" />
                ) : (
                    <ChevronRight className="text-void w-6 h-6" strokeWidth={3} />
                )}
            </motion.div>
        </div>
    );
}
