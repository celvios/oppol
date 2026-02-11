'use client';

import { useSession, signIn, signOut } from "next-auth/react";
import { useState, useEffect } from "react";
import { Wallet, LogOut, Loader2 } from "lucide-react";
import Image from "next/image";

export function ConnectWallet() {
    const { data: session, status } = useSession();
    const [isHovering, setIsHovering] = useState(false);

    if (status === 'loading') {
        return (
            <div className="h-10 w-24 bg-white/5 animate-pulse rounded-xl" />
        );
    }

    if (session && session.user) {
        return (
            <div className="relative z-50">
                <button
                    onMouseEnter={() => setIsHovering(true)}
                    onMouseLeave={() => setIsHovering(false)}
                    className="flex items-center gap-2 bg-white/10 hover:bg-white/20 border border-white/10 backdrop-blur-md px-3 py-2 rounded-xl transition-all"
                >
                    {session.user.image ? (
                        <Image
                            src={session.user.image}
                            alt="Avatar"
                            width={24}
                            height={24}
                            className="rounded-full ring-2 ring-white/10"
                        />
                    ) : (
                        <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-blue-500 to-purple-500 flex items-center justify-center">
                            <span className="text-xs font-bold text-white">
                                {session.user.name?.charAt(0) || 'U'}
                            </span>
                        </div>
                    )}

                    <span className="text-sm font-medium text-white hidden sm:block">
                        {isHovering ? 'Disconnect' : (
                            <div className="flex flex-col items-end leading-tight">
                                <span>{session.user.name?.split(' ')[0]}</span>
                                <span className="text-[10px] text-white/50 font-mono">
                                    {session.user.address ? `${session.user.address.slice(0, 4)}...${session.user.address.slice(-4)}` : ''}
                                </span>
                            </div>
                        )}
                    </span>

                    {isHovering && (
                        <LogOut
                            className="w-4 h-4 text-red-400 ml-1"
                            onClick={(e) => {
                                e.stopPropagation();
                                signOut();
                            }}
                        />
                    )}
                </button>
            </div>
        );
    }

    return (
        <button
            onClick={() => signIn('google')}
            className="flex items-center gap-2 bg-white text-black hover:bg-white/90 px-4 py-2.5 rounded-xl font-bold transition-all shadow-[0_0_15px_rgba(255,255,255,0.2)] hover:shadow-[0_0_25px_rgba(255,255,255,0.4)] hover:scale-105 active:scale-95"
        >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.26.81-.58z"
                />
                <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
            </svg>
            <span className="hidden sm:inline">Continue with Google</span>
            <span className="sm:hidden">Login</span>
        </button>
    );
}
