"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Search, ExternalLink, RefreshCw, Loader2, MessageCircle, Send } from "lucide-react";
import NeonButton from "@/components/ui/NeonButton";

interface User {
    id_val: string;
    source: 'whatsapp' | 'telegram';
    display_name: string;
    wallet_address: string;
    created_at: string;
    balance?: number;
    phone_number?: string;
    username?: string;
}

export default function UserExplorer({ adminKey }: { adminKey: string }) {
    const [users, setUsers] = useState<User[]>([]);
    const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [search, setSearch] = useState("");

    useEffect(() => {
        fetchUsers();
    }, [adminKey]);

    useEffect(() => {
        if (!search.trim()) {
            setFilteredUsers(users);
        } else {
            const lowerInfo = search.toLowerCase();
            setFilteredUsers(users.filter(u =>
                u.display_name?.toLowerCase().includes(lowerInfo) ||
                u.wallet_address?.toLowerCase().includes(lowerInfo)
            ));
        }
    }, [search, users]);

    const fetchUsers = async () => {
        setIsLoading(true);
        try {
            const res = await fetch('/api/admin/users', {
                headers: { 'x-admin-secret': adminKey }
            });
            const data = await res.json();
            if (data.success) {
                setUsers(data.users);
                setFilteredUsers(data.users);
            }
        } catch (e) {
            console.error("Failed to fetch users", e);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header / Search */}
            <div className="flex justify-between items-center gap-4">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 h-4 w-4" />
                    <input
                        type="text"
                        placeholder="Search phone, username, or wallet..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="w-full bg-black/20 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-white focus:outline-none focus:border-neon-cyan/50 transition-colors"
                    />
                </div>
                <NeonButton variant="secondary" size="sm" icon={RefreshCw} onClick={fetchUsers}>
                    Refresh
                </NeonButton>
            </div>

            {isLoading ? (
                <div className="flex justify-center p-12">
                    <Loader2 className="animate-spin text-primary w-8 h-8" />
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-white/10 text-white/40 text-sm uppercase tracking-wider">
                                <th className="p-4 font-medium">Source</th>
                                <th className="p-4 font-medium">Identity</th>
                                <th className="p-4 font-medium">Created</th>
                                <th className="p-4 font-medium">Wallet</th>
                                <th className="p-4 font-medium text-right">Balance (USDC)</th>
                                <th className="p-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-white/80">
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-white/30">
                                        No users found
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user, i) => (
                                    <tr key={user.wallet_address + i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                        <td className="p-4">
                                            {user.source === 'whatsapp' ? (
                                                <div className="flex items-center gap-2 text-green-400">
                                                    <MessageCircle size={16} />
                                                    <span className="text-xs font-bold">WA</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-blue-400">
                                                    <Send size={16} />
                                                    <span className="text-xs font-bold">TG</span>
                                                </div>
                                            )}
                                        </td>
                                        <td className="p-4 font-bold text-white">
                                            {user.display_name}
                                        </td>
                                        <td className="p-4 text-sm font-mono text-white/50">
                                            {user.created_at ? format(new Date(user.created_at), 'MMM d, yyyy') : '-'}
                                        </td>
                                        <td className="p-4 font-mono text-xs text-white/50">
                                            {user.wallet_address?.substring(0, 6)}...{user.wallet_address?.substring(38)}
                                        </td>
                                        <td className="p-4 text-right font-bold font-mono">
                                            ${user.balance?.toFixed(2) || '0.00'}
                                        </td>
                                        <td className="p-4 text-right">
                                            <a
                                                href={`https://testnet.bscscan.com/address/${user.wallet_address}`}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline hover:text-neon-cyan"
                                            >
                                                Explorer <ExternalLink size={10} />
                                            </a>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}
