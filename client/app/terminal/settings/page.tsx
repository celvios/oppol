"use client";

import { Bell, Shield, Wallet, Monitor } from "lucide-react";

export default function SettingsPage() {
    return (
        <div className="max-w-3xl space-y-8">
            <h1 className="text-3xl font-mono font-bold text-white mb-6">SETTINGS</h1>

            {/* Profile Section */}
            <div className="bg-surface/30 border border-white/5 rounded-2xl p-6 flex items-center gap-6">
                <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-primary to-purple-500 p-[2px]">
                    <div className="w-full h-full rounded-full bg-black flex items-center justify-center text-2xl font-bold text-white">
                        U
                    </div>
                </div>
                <div>
                    <h2 className="text-xl font-bold">User 8829</h2>
                    <p className="text-white/40 font-mono">+1 (555) 019-2834</p>
                    <div className="mt-2 text-xs bg-success/10 text-success px-2 py-0.5 rounded inline-block border border-success/20">VERIFIED</div>
                </div>
            </div>

            {/* Settings Grid */}
            <div className="space-y-4">
                {[
                    { icon: Bell, title: "Notifications", desc: "Manage WhatsApp alerts and push notifications" },
                    { icon: Shield, title: "Security", desc: "2FA and Session Management" },
                    { icon: Wallet, title: "Wallet Connections", desc: "Manage external authorized wallets" },
                    { icon: Monitor, title: "Appearance", desc: "Theme and Terminal Density" },
                ].map((item, i) => (
                    <div key={i} className="bg-surface/30 border border-white/5 p-4 rounded-xl flex items-center justify-between hover:bg-white/5 transition-colors cursor-pointer group">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-white/5 rounded-lg text-primary group-hover:bg-primary group-hover:text-black transition-colors">
                                <item.icon size={20} />
                            </div>
                            <div>
                                <h3 className="font-bold text-sm">{item.title}</h3>
                                <p className="text-white/40 text-xs">{item.desc}</p>
                            </div>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-white/10 group-hover:bg-primary transition-colors" />
                    </div>
                ))}
            </div>

            <div className="pt-8 text-center">
                <p className="text-white/20 text-xs uppercase tracking-widest">
                    OPoll Terminal v1.0.0 (Beta)
                </p>
            </div>
        </div>
    );
}
