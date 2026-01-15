"use client";

import { useEffect, useState } from "react";
import AdminMarketList from "@/components/admin/AdminMarketList";
import { useRouter } from "next/navigation";

export default function AdminMarketsPage() {
    const [adminKey, setAdminKey] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        const key = localStorage.getItem("admin_secret");
        if (!key) {
            router.push("/admin");
        } else {
            setAdminKey(key);
        }
    }, [router]);

    if (!adminKey) return null;

    return (
        <div className="min-h-screen bg-void pb-20 pt-24 px-4 md:px-6">
            <div className="max-w-4xl mx-auto">
                <div className="mb-8">
                    <button
                        onClick={() => router.push("/admin")}
                        className="text-white/50 hover:text-white mb-4 flex items-center gap-2"
                    >
                        ← Back to Dashboard
                    </button>
                    <h1 className="text-3xl font-heading font-bold text-white">Manage Markets</h1>
                    <p className="text-text-secondary">View and resolve active prediction markets</p>
                </div>

                <AdminMarketList adminKey={adminKey} />
            </div>
        </div>
    );
}
