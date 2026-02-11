'use client';

import { useWallet } from "@/lib/use-wallet";
import { useState } from "react";
import { Wallet, LogOut } from "lucide-react";
import Image from "next/image";

export function ConnectWallet() {
    const { isConnected, user, connect, disconnect, isConnecting } = useWallet();
    const [isHovering, setIsHovering] = useState(false);

    if (isConnecting) {
        return (
            <div className="h-10 w-24 bg-white/5 animate-pulse rounded-xl" />
        );
    }

    if (isConnected && user) {
        const displayName = user.name || 'User';
        const displayAddress = user.address ? `${user.address.slice(0, 4)}...${user.address.slice(-4)}` : '';
        const avatarUrl = user.image;

        return (
            <div className="relative z-50">
                <button
                    onMouseEnter={() => setIsHovering(true)}
                    onMouseLeave={() => setIsHovering(false)}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md px-3 py-2 rounded-xl transition-all"
                >
                    {avatarUrl ? (
                        <Image
                            src={avatarUrl}
                            alt="Avatar"
                            width={24}
                            height={24}
                            className="rounded-full ring-2 ring-white/10"
                        />
                    ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center">
                            <span className="text-xs font-bold text-white">
                                {displayName.charAt(0)}
                            </span>
                        </div>
                    )}

                    <span className="text-sm font-medium text-white hidden sm:block">
                        {isHovering ? 'Disconnect' : (
                            <div className="flex flex-col items-end leading-tight">
                                <span>{displayName.split(' ')[0]}</span>
                                {displayAddress && (
                                    <span className="text-[10px] text-white/50 font-mono">
                                        {displayAddress}
                                    </span>
                                )}
                            </div>
                        )}
                    </span>

                    {isHovering && (
                        <LogOut
                            className="w-4 h-4 text-red-400 ml-1"
                            onClick={(e) => {
                                e.stopPropagation();
                                disconnect();
                            }}
                        />
                    )}
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={() => connect()}
            className="flex items-center gap-3 px-4 py-3 rounded-xl text-text-secondary hover:bg-white/5 hover:text-white transition-all group w-full"
        >
            <div className="w-5 h-5 flex items-center justify-center opacity-70 group-hover:opacity-100">
                <Wallet className="w-5 h-5" />
            </div>
            <span className="font-medium">Login</span>
        </button>
    );
}
