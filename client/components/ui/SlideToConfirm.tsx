"use client";

import { motion, useMotionValue, useTransform, useAnimation } from "framer-motion";
import { ChevronRight, ChevronsRight, Loader2 } from "lucide-react";
import { useEffect, useState, useRef } from "react";

interface SlideToConfirmProps {
    onConfirm: () => void;
    isLoading: boolean;
    disabled: boolean;
    text: string;
    side: 'YES' | 'NO';
}

export function SlideToConfirm({ onConfirm, isLoading, disabled, text, side }: SlideToConfirmProps) {
    const [complete, setComplete] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const [constraints, setConstraints] = useState(0);

    const x = useMotionValue(0);
    const controls = useAnimation();

    // Calculate drag constraints based on container width
    useEffect(() => {
        if (containerRef.current) {
            // Width of container - width of handle (change handle width here if needed)
            setConstraints(containerRef.current.offsetWidth - 52); // 48px handle + 4px margin
        }
    }, [containerRef.current]);

    // Transform opacity/color based on drag position
    const checkOffset = constraints * 0.9;
    const backgroundOpacity = useTransform(x, [0, constraints], [0, 1]);
    const textOpacity = useTransform(x, [0, constraints * 0.5], [1, 0]);
    const shimmerOpacity = useTransform(x, [0, constraints], [1, 0]);

    async function handleDragEnd() {
        if (x.get() > checkOffset) {
            setComplete(true);
            onConfirm();
        } else {
            controls.start({ x: 0, transition: { type: "spring", stiffness: 400, damping: 30 } });
        }
    }

    // Reset slider if loading finishes or component resets
    useEffect(() => {
        if (!isLoading && complete) {
            setComplete(false);
            controls.start({ x: 0 });
        }
    }, [isLoading, complete, controls]);

    const colorClass = side === 'YES' ? 'bg-success' : 'bg-danger';
    const glowClass = side === 'YES' ? 'shadow-[0_0_20px_rgba(0,255,148,0.4)]' : 'shadow-[0_0_20px_rgba(255,68,68,0.4)]';
    const textColorClass = side === 'YES' ? 'text-success' : 'text-danger';

    return (
        <div
            ref={containerRef}
            className={`
                relative w-full h-12 rounded-full overflow-hidden 
                bg-white/5 backdrop-blur-md border border-white/20 
                select-none shadow-inner transition-all duration-300
                ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:border-white/30 hover:bg-white/10'}
            `}
        >
            {/* Background Fill Animation */}
            <motion.div
                style={{ opacity: backgroundOpacity }}
                className={`absolute inset-0 ${colorClass}/20 transition-colors`}
            />

            {/* Shimmer Effect on Track */}
            <motion.div
                style={{ opacity: shimmerOpacity }}
                className="absolute inset-0"
            >
                <div className="absolute inset-0 -translate-x-full animate-[shimmer_2s_infinite] bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            </motion.div>

            {/* Text Label */}
            <motion.div
                style={{ opacity: textOpacity }}
                className="absolute inset-0 flex items-center justify-center pointer-events-none"
            >
                <span className={`text-[10px] font-bold tracking-[0.2em] font-mono ${textColorClass} drop-shadow-sm`}>
                    {isLoading ? 'PROCESSING...' : text}
                </span>
                <ChevronsRight size={14} className={`ml-2 ${textColorClass} animate-pulse`} />
            </motion.div>

            {/* Draggable Handle */}
            <motion.div
                drag={disabled || isLoading ? false : "x"}
                dragConstraints={{ left: 0, right: constraints }}
                dragElastic={0.05}
                dragMomentum={false}
                onDragEnd={handleDragEnd}
                animate={controls}
                style={{ x }}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`
                    absolute top-1 bottom-1 left-1 
                    w-12 rounded-full 
                    ${colorClass} ${glowClass}
                    flex items-center justify-center 
                    cursor-grab active:cursor-grabbing 
                    z-10 transition-shadow
                `}
            >
                {isLoading ? (
                    <Loader2 className="w-5 h-5 text-black animate-spin" />
                ) : (
                    <ChevronRight className="text-black" size={20} strokeWidth={3} />
                )}
            </motion.div>

            {/* Success State Overlay */}
            {complete && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className={`absolute inset-0 flex items-center justify-center font-bold text-xs tracking-widest text-black ${colorClass} z-20`}
                >
                    CONFIRMED
                </motion.div>
            )}
        </div>
    );
}
