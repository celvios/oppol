"use client";

import {
    Send,
    MessageCircle,
    FileText,
    HelpCircle,
    Shield,
    FileCheck,
    Lock,
    Twitter,
    Video,
    ExternalLink
} from "lucide-react";
import Link from "next/link";
import LogoBrand from "@/components/ui/LogoBrand";

interface FooterLinkProps {
    href?: string;
    onClick?: () => void;
    label: string;
    icon?: React.ReactNode;
    external?: boolean;
}

function FooterLink({ href, onClick, label, icon, external }: FooterLinkProps) {
    const content = (
        <span className="flex items-center gap-2 text-sm text-text-secondary hover:text-white transition-colors cursor-pointer group">
            {icon && <span className="group-hover:text-neon-cyan transition-colors">{icon}</span>}
            {label}
            {external && <ExternalLink size={12} className="opacity-50" />}
        </span>
    );

    if (href) {
        return (
            <Link
                href={href}
                target={external ? "_blank" : undefined}
                rel={external ? "noreferrer" : undefined}
                className="block mb-2"
            >
                {content}
            </Link>
        );
    }

    return (
        <button onClick={onClick} className="block mb-2 text-left">
            {content}
        </button>
    );
}

export default function DesktopFooter() {
    return (
        <footer className="w-full bg-black/20 border-t border-white/5 py-16 mt-20">
            <div className="max-w-7xl mx-auto px-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-12">
                    {/* Brand Column */}
                    <div className="space-y-4">
                        <LogoBrand size="lg" />
                        <p className="text-sm text-text-secondary leading-relaxed">
                            The decentralized prediction market protocol. <br />
                            Trade on outcomes with zero limits.
                        </p>
                        <div className="text-xs text-white/20 pt-4">
                            © 2026 OPoll Protocol
                        </div>
                    </div>

                    {/* Community */}
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-6">Community</h3>
                        <FooterLink
                            label="Predict via Telegram"
                            href="https://t.me/opoll_predict_bot"
                            external
                            icon={<Send size={16} className="-rotate-12" />}
                        />
                        <FooterLink
                            label="Predict via Whatsapp"
                            onClick={() => alert("Coming Soon")}
                            icon={<MessageCircle size={16} />}
                        />
                        <FooterLink
                            label="Follow on X"
                            href="https://x.com/opollmarket?s=11"
                            external
                            icon={<Twitter size={16} />}
                        />
                    </div>

                    {/* Resources */}
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-6">Resources</h3>
                        <FooterLink
                            label="Video Tutorials"
                            href="/videos"
                            icon={<Video size={16} />}
                        />
                        <FooterLink
                            label="Documentation"
                            href="/docs"
                            icon={<FileText size={16} />}
                        />
                        <FooterLink
                            label="FAQ"
                            href="/faq"
                            icon={<HelpCircle size={16} />}
                        />
                    </div>

                    {/* Legal */}
                    <div>
                        <h3 className="text-xs font-bold uppercase tracking-widest text-white/40 mb-6">Legal</h3>
                        <FooterLink
                            label="Disclaimer"
                            onClick={() => alert("Disclaimer Content Coming Soon")}
                            icon={<Shield size={16} />}
                        />
                        <FooterLink
                            label="Terms & Conditions"
                            onClick={() => alert("Terms and Conditions Coming Soon")}
                            icon={<FileCheck size={16} />}
                        />
                        <FooterLink
                            label="Privacy Policy"
                            onClick={() => alert("Privacy Policy Coming Soon")}
                            icon={<Lock size={16} />}
                        />
                    </div>
                </div>
            </div>
        </footer>
    );
}
