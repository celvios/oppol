"use client";

import LogoBrand from "@/components/ui/LogoBrand";
import { Send, MessageCircle, FileText, HelpCircle, Shield, FileCheck, Lock, Twitter, Video } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

// Types
interface MenuItem {
    icon: React.ReactNode;
    label: string;
    href?: string; // For external/internal links
    onClick?: () => void; // For modals/alerts
    external?: boolean;
}

export default function MenuPage() {
    const [showDisclaimer, setShowDisclaimer] = useState(false);
    const [showTerms, setShowTerms] = useState(false);
    const [showPrivacy, setShowPrivacy] = useState(false);

    const menuItems: MenuItem[] = [
        {
            icon: <Send className="w-5 h-5 -rotate-12 fill-white text-white" />,
            label: "Predict Via Telegram",
            href: "https://t.me/oppol",
            external: true
        },
        {
            icon: <MessageCircle className="w-5 h-5 text-white" />,
            label: "Predict Via WhatsApp",
            href: "https://wa.me/yourwhatsapp",
            external: true
        },
        {
            icon: <div className="w-5 h-5 bg-white rounded-full" />, // Placeholder for Document circle
            label: "Document",
            href: "/docs",
            external: false
        },
        {
            icon: <div className="w-5 h-5 bg-white rounded-full" />, // Placeholder for FAQ circle
            label: "FAQ",
            href: "/faq",
            external: false
        },
        {
            icon: <div className="w-5 h-5 bg-white rounded-full" />,
            label: "Disclaimer",
            onClick: () => alert("Disclaimer Content Coming Soon"),
        },
        {
            icon: <div className="w-5 h-5 bg-white rounded-full" />,
            label: "Terms and Condition",
            onClick: () => alert("Terms and Conditions Coming Soon"),
        },
        {
            icon: <div className="w-5 h-5 hidden" />, // Privacy Policy has no icon in image, just text centered? No, image checks out, it looks different.
            // Wait, looking at image:
            // "Privacy Policy" is in a button but no white circle? Or maybe it is?
            // The image shows "Privacy Policy" centered in a button without an icon circle on the left, unlike others.
            // Actually, "Privacy Policy" looks like a section header or a different button style?
            // "Privacy Policy" is in a button, centered text, no icon.
            label: "Privacy Policy",
            onClick: () => alert("Privacy Policy Coming Soon"),
        },
        {
            icon: <div className="w-5 h-5 bg-white rounded-full" />,
            label: "Twitter",
            href: "https://twitter.com/oppol",
            external: true
        },
        {
            icon: <div className="w-5 h-5 bg-white rounded-full" />,
            label: "How to Videos",
            href: "/videos",
            external: false
        },
    ];

    return (
        <div className="min-h-screen bg-[#020408] text-white pb-24 font-sans">
            {/* Header */}
            <div className="flex flex-col items-center pt-8 pb-6">
                <div className="flex items-center gap-2 mb-2">
                    <LogoBrand size="lg" />
                </div>
                <h1 className="text-xl text-gray-400 font-medium">Menu</h1>
            </div>

            {/* Menu List */}
            <div className="px-4 space-y-3">
                {menuItems.map((item, index) => {
                    // Special case for Privacy Policy styling to match image
                    const isPrivacy = item.label === "Privacy Policy";

                    const ButtonContent = () => (
                        <div className={`w-full bg-white/15 hover:bg-white/20 active:bg-white/25 transition-colors rounded-xl p-4 flex items-center ${isPrivacy ? "justify-center" : "justify-start gap-4"}`}>
                            {!isPrivacy && (
                                <div className="shrink-0 flex items-center justify-center">
                                    {/* Handle Lucide icons vs white circles */}
                                    {/* The image shows white circles for most, but specific icons for Telegram/WhatsApp/Twitter if available. 
                                        The user image has:
                                        - Telegram: Paper plane
                                        - WhatsApp: Phone/Chat icon
                                        - Others: White circle
                                        - Privacy Policy: No icon
                                     */}
                                    {item.label.includes("Telegram") ? <Send className="w-6 h-6 -rotate-12" /> :
                                        item.label.includes("WhatsApp") ? <MessageCircle className="w-6 h-6" /> :
                                            item.label === "Privacy Policy" ? null :
                                                <div className="w-6 h-6 bg-white rounded-full" />
                                    }
                                </div>
                            )}
                            <span className="text-base font-bold text-gray-200">{item.label}</span>
                        </div>
                    );

                    if (item.href) {
                        return (
                            <Link
                                key={index}
                                href={item.href}
                                target={item.external ? "_blank" : undefined}
                                rel={item.external ? "noreferrer" : undefined}
                                className="block"
                            >
                                <ButtonContent />
                            </Link>
                        );
                    }

                    return (
                        <button key={index} onClick={item.onClick} className="w-full text-left">
                            <ButtonContent />
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
