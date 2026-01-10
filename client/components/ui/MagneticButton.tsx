"use client";

import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { useRef, MouseEvent } from "react";
import { twMerge } from "tailwind-merge";

interface MagneticButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    variant?: "cyan" | "coral" | "green" | "glass";
    glow?: boolean;
}

export default function MagneticButton({
    children,
    className,
    variant = "cyan",
    glow = true,
    ...props
}: MagneticButtonProps) {
    const ref = useRef<HTMLButtonElement>(null);

    const x = useMotionValue(0);
    const y = useMotionValue(0);

    // Spring physics for smooth return
    const springConfig = { damping: 15, stiffness: 150, mass: 0.1 };
    const springX = useSpring(x, springConfig);
    const springY = useSpring(y, springConfig);

    const handleMouseMove = (e: MouseEvent<HTMLButtonElement>) => {
        if (!ref.current) return;

        const rect = ref.current.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;

        const distanceX = e.clientX - centerX;
        const distanceY = e.clientY - centerY;

        // Limit the magnetic pull distance
        x.set(distanceX * 0.3);
        y.set(distanceY * 0.3);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    const variants = {
        cyan: "bg-gradient-cyan text-void shadow-[0_0_20px_rgba(0,240,255,0.4)]",
        coral: "bg-gradient-coral text-void shadow-[0_0_20px_rgba(255,46,99,0.4)]",
        green: "bg-neon-green text-void shadow-[0_0_20px_rgba(39,232,167,0.4)]",
        glass: "bg-white/10 text-white border border-white/10 backdrop-blur-md",
    };

    return (
        <motion.button
            ref={ref}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            style={{ x: springX, y: springY }}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={twMerge(
                "relative flex items-center justify-center px-8 py-4 rounded-xl font-heading font-bold text-lg tracking-wide uppercase transition-all duration-300",
                variants[variant],
                glow && variant !== "glass" && "hover:shadow-[0_0_40px_rgba(255,255,255,0.5)]", // Intensified glow
                className
            )}
            {...props as any} // Cast specific props for motion
        >
            {children}
        </motion.button>
    );
}
