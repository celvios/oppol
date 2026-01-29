"use client";

import LogoBrand from "@/components/ui/LogoBrand";
import {
    Send,
    MessageCircle,
    FileText,
    HelpCircle,
    Shield,
    FileCheck,
    Lock,
    Twitter,
    Youtube,
    ChevronRight,
    ExternalLink
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";

// Animation Variants
const container = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.1
        }
    }
};

const itemAnim = {
    hidden: { opacity: 0, y: 20 },
    show: { opacity: 1, y: 0 }
};

interface MenuItemProps {
    icon: React.ReactNode;
    label: string;
    href?: string;
    onClick?: () => void;
    external?: boolean;
    color?: string; // Optional accent color class
}

function MenuButton({ icon, label, href, onClick, external, color = "text-white" }: MenuItemProps) {
    const Content = (
        <div className="w-full bg-surface/40 backdrop-blur-md border border-white/5 hover:bg-white/10 active:scale-[0.98] transition-all rounded-2xl p-4 flex items-center justify-between group">
            <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-full bg-white/5 flex items-center justify-center ${color} group-hover:scale-110 transition-transform`}>
                    {icon}
                </div>
                <span className="text-base font-medium text-white/90 group-hover:text-white transition-colors">{label}</span>
            </div>
            <div className="text-white/20 group-hover:text-white/50 transition-colors">
                {external ? <ExternalLink size={18} /> : <ChevronRight size={18} />}
            </div>
        </div>
    );

    return (
        <motion.div variants={itemAnim} className="w-full">
            {href ? (
                <Link
                    href={href}
                    target={external ? "_blank" : undefined}
                    rel={external ? "noreferrer" : undefined}
                    className="block w-full"
                >
                    {Content}
                </Link>
            ) : (
                <button onClick={onClick} className="w-full text-left">
                    {Content}
                </button>
            )}
        </motion.div>
    );
}

export default function MenuPage() {
    return (
        <div className="min-h-screen bg-[#020408] text-white pb-32 font-sans overflow-x-hidden relative">
            {/* Background Decor */}
            <div className="absolute top-0 left-0 w-full h-[30vh] bg-gradient-to-b from-neon-cyan/5 to-transparent pointer-events-none" />

            <motion.div
                initial="hidden"
                animate="show"
                variants={container}
                className="relative px-4 pt-12 max-w-lg mx-auto space-y-8"
            >
                {/* Header */}
                <motion.div variants={itemAnim} className="flex flex-col items-center">
                    <LogoBrand size="xl" className="mb-4" />
                    {/* <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-white/60">Menu</h1> */}
                </motion.div>

                {/* Section: Community */}
                <div className="space-y-3">
                    <motion.h2 variants={itemAnim} className="text-xs font-bold uppercase tracking-widest text-white/40 ml-2">Community</motion.h2>
                    <div className="space-y-3">
                        <MenuButton
                            icon={<Send size={20} className="-rotate-12 ml-[-2px]" />}
                            label="Telegram Community"
                            href="https://t.me/oppol"
                            external
                            color="text-[#229ED9]"
                        />
                        <MenuButton
                            icon={<MessageCircle size={20} />}
                            label="WhatsApp Group"
                            href="https://wa.me/yourwhatsapp"
                            external
                            color="text-[#25D366]"
                        />
                        <MenuButton
                            icon={<Twitter size={20} />}
                            label="Follow on X"
                            href="https://twitter.com/oppol"
                            external
                            color="text-white"
                        />
                    </div>
                </div>

                {/* Section: Resources */}
                <div className="space-y-3">
                    <motion.h2 variants={itemAnim} className="text-xs font-bold uppercase tracking-widest text-white/40 ml-2">Resources</motion.h2>
                    <div className="space-y-3">
                        <MenuButton
                            icon={<Video size={20} />}
                            label="How-to Video Tutorials"
                            href="/videos"
                            color="text-neon-cyan"
                        />
                        <MenuButton
                            icon={<FileText size={20} />}
                            label="Documentation"
                            href="/docs"
                            color="text-neon-purple"
                        />
                        <MenuButton
                            icon={<HelpCircle size={20} />}
                            label="Frequently Asked Questions"
                            href="/faq"
                            color="text-neon-green"
                        />
                    </div>
                </div>

                {/* Section: Legal */}
                <div className="space-y-3">
                    <motion.h2 variants={itemAnim} className="text-xs font-bold uppercase tracking-widest text-white/40 ml-2">Legal</motion.h2>
                    <div className="space-y-3">
                        <MenuButton
                            icon={<Shield size={20} />}
                            label="Disclaimer"
                            onClick={() => alert("Disclaimer Content Coming Soon")}
                        />
                        <MenuButton
                            icon={<FileCheck size={20} />}
                            label="Terms & Conditions"
                            onClick={() => alert("Terms and Conditions Coming Soon")}
                        />
                        <MenuButton
                            icon={<Lock size={20} />}
                            label="Privacy Policy"
                            onClick={() => alert("Privacy Policy Coming Soon")}
                        />
                    </div>
                </div>

                {/* App Version / Footer */}
                <motion.div variants={itemAnim} className="pt-8 text-center">
                    <p className="text-xs text-white/20">OPoll App v1.0.0 (Beta)</p>
                    <div className="flex justify-center gap-4 mt-4 text-white/30 text-xs">
                        {/* <span>© 2024 OPoll</span> */}
                    </div>
                </motion.div>

            </motion.div>
        </div>
    );
}
