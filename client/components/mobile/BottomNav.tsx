"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, PieChart, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
    { name: "Terminal", href: "/terminal", icon: Home },
    { name: "Portfolio", href: "/terminal/portfolio", icon: PieChart },
    { name: "Deposit", href: "/terminal/deposit", icon: ArrowUpRight },
    { name: "Withdraw", href: "/terminal/withdraw", icon: ArrowDownRight },
];

export function BottomNav() {
    const pathname = usePathname();

    return (
        <div className="fixed bottom-0 left-0 w-full bg-[#0A0A0C] border-t border-white/10 z-50 flex justify-around items-center px-2 py-3 safe-area-bottom">
            {navItems.map((item) => {
                const isActive = pathname === item.href;
                const Icon = item.icon;
                return (
                    <Link
                        key={item.href}
                        href={item.href}
                        className={cn(
                            "flex flex-col items-center gap-1 transition-colors relative p-2",
                            isActive ? "text-primary" : "text-white/40"
                        )}
                    >
                        <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
                        <span className="text-[10px] font-medium">{item.name}</span>
                        {isActive && (
                            <div className="absolute -top-[13px] left-1/2 -translate-x-1/2 w-8 h-1 bg-primary rounded-b-full shadow-[0_4px_12px_rgba(0,255,148,0.5)]" />
                        )}
                    </Link>
                );
            })}
        </div>
    );
}
