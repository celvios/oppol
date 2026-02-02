import { forwardRef } from "react";
import { motion, MotionProps } from "framer-motion";
import { ReactNode } from "react";
import clsx from "clsx";
import { twMerge } from "tailwind-merge";

interface GlassCardProps extends MotionProps {
    children: ReactNode;
    className?: string;
    hoverEffect?: boolean;
}

const GlassCard = forwardRef<HTMLDivElement, GlassCardProps>(({ children, className, hoverEffect = true, ...props }, ref) => {
    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            className={twMerge(
                "glass-panel rounded-xl overflow-hidden relative",
                hoverEffect && "hover:border-white/20 transition-colors duration-300",
                className
            )}
            {...props}
        >
            {hoverEffect && (
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 hover:opacity-100 transition-opacity pointer-events-none" />
            )}
            {children}
        </motion.div>
    );
});

GlassCard.displayName = "GlassCard";

export default GlassCard;
