"use client";

import { useState } from "react";
import { ArrowLeft, Plus, Trash2, Calendar, Image as ImageIcon, Save, Loader2 } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import NeonButton from "@/components/ui/NeonButton";
import Link from "next/link";
import { motion } from "framer-motion";

export default function CreateMarketPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    const [formData, setFormData] = useState({
        question: "",
        description: "",
        image: "",
        category: "Crypto",
        initialLiquidity: "100",
        durationDays: "30",
        outcomes: ["Yes", "No"] // Default to binary, user can add more
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleOutcomeChange = (index: number, value: string) => {
        const newOutcomes = [...formData.outcomes];
        newOutcomes[index] = value;
        setFormData({ ...formData, outcomes: newOutcomes });
    };

    const addOutcome = () => {
        if (formData.outcomes.length < 10) {
            setFormData({ ...formData, outcomes: [...formData.outcomes, ""] });
        }
    };

    const removeOutcome = (index: number) => {
        if (formData.outcomes.length > 2) {
            const newOutcomes = formData.outcomes.filter((_, i) => i !== index);
            setFormData({ ...formData, outcomes: newOutcomes });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");
        setSuccess("");

        const adminKey = localStorage.getItem("admin_secret");
        if (!adminKey) {
            setError("Admin key not found. Please login again.");
            setIsLoading(false);
            return;
        }

        try {
            const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/admin/create-market`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "x-admin-secret": adminKey
                },
                body: JSON.stringify({
                    question: formData.question,
                    description: formData.description,
                    image: formData.image,
                    category: formData.category,
                    outcomes: formData.outcomes,
                    initialLiquidity: parseFloat(formData.initialLiquidity),
                    durationHours: parseFloat(formData.durationDays) * 24
                })
            });

            const data = await res.json();

            if (data.success) {
                setSuccess(`Market created successfully! ID: ${data.marketId}`);
                // Clear form or redirect
                setTimeout(() => {
                    window.location.href = "/admin";
                }, 2000);
            } else {
                setError(data.error || "Failed to create market");
            }
        } catch (e: any) {
            setError(e.message || "Network error");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-void pb-20 pt-24 px-4 md:px-6">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <Link href="/admin" className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors">
                        <ArrowLeft size={20} />
                    </Link>
                    <div>
                        <h1 className="text-3xl font-heading font-bold text-white mb-1">Create Market</h1>
                        <p className="text-text-secondary">Launch a new prediction market</p>
                    </div>
                </div>

                <form onSubmit={handleSubmit}>
                    <GlassCard className="p-8 space-y-8">
                        {/* Basic Info */}
                        <div className="space-y-6">
                            <h2 className="text-lg font-bold text-white border-b border-white/5 pb-2">Basic Details</h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-sm text-text-secondary uppercase tracking-wider">Question / Title</label>
                                    <input
                                        name="question"
                                        required
                                        value={formData.question}
                                        onChange={handleInputChange}
                                        placeholder="e.g. Will Bitcoin reach $100k by 2025?"
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-cyan/50 transition-colors"
                                    />
                                </div>

                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-sm text-text-secondary uppercase tracking-wider">Description</label>
                                    <textarea
                                        name="description"
                                        rows={3}
                                        value={formData.description}
                                        onChange={handleInputChange}
                                        placeholder="Detailed rules for resolution..."
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-cyan/50 transition-colors resize-none"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm text-text-secondary uppercase tracking-wider flex items-center gap-2">
                                        <ImageIcon size={14} /> Image URL
                                    </label>
                                    <input
                                        name="image"
                                        value={formData.image}
                                        onChange={handleInputChange}
                                        placeholder="https://..."
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-cyan/50 transition-colors"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm text-text-secondary uppercase tracking-wider">Category</label>
                                    <select
                                        name="category"
                                        value={formData.category}
                                        onChange={handleInputChange}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-cyan/50 transition-colors appearance-none"
                                    >
                                        <option value="Crypto">Crypto</option>
                                        <option value="Tech">Tech</option>
                                        <option value="Politics">Politics</option>
                                        <option value="Sports">Sports</option>
                                        <option value="Entertainment">Entertainment</option>
                                        <option value="Science">Science</option>
                                        <option value="Other">Other</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Outcomes */}
                        <div className="space-y-6">
                            <h2 className="text-lg font-bold text-white border-b border-white/5 pb-2">Outcomes</h2>
                            <p className="text-sm text-white/50">Define the possible results. Use 2 for binary (YES/NO).</p>

                            <div className="space-y-3">
                                {formData.outcomes.map((outcome, index) => (
                                    <motion.div
                                        key={index}
                                        initial={{ opacity: 0, height: 0 }}
                                        animate={{ opacity: 1, height: "auto" }}
                                        className="flex gap-3"
                                    >
                                        <div className="flex items-center justify-center w-8 h-10 bg-white/5 rounded text-white/50 font-mono text-sm">
                                            {index + 1}
                                        </div>
                                        <input
                                            value={outcome}
                                            onChange={(e) => handleOutcomeChange(index, e.target.value)}
                                            placeholder={`Outcome ${index + 1}`}
                                            className="flex-1 bg-black/20 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-neon-cyan/50 transition-colors"
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeOutcome(index)}
                                            disabled={formData.outcomes.length <= 2}
                                            className="p-2 text-white/30 hover:text-neon-coral disabled:opacity-30 disabled:hover:text-white/30 transition-colors"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </motion.div>
                                ))}
                            </div>

                            <button
                                type="button"
                                onClick={addOutcome}
                                className="flex items-center gap-2 text-neon-cyan text-sm font-bold uppercase tracking-wider hover:text-white transition-colors"
                            >
                                <Plus size={16} /> Add Outcome
                            </button>
                        </div>

                        {/* Settings */}
                        <div className="space-y-6">
                            <h2 className="text-lg font-bold text-white border-b border-white/5 pb-2">Market Settings</h2>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-sm text-text-secondary uppercase tracking-wider flex items-center gap-2">
                                        <Calendar size={14} /> Duration (Days)
                                    </label>
                                    <input
                                        type="number"
                                        name="durationDays"
                                        value={formData.durationDays}
                                        onChange={handleInputChange}
                                        min="1"
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-cyan/50 transition-colors"
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm text-text-secondary uppercase tracking-wider">Initial Liquidity (Tokens)</label>
                                    <input
                                        type="number"
                                        name="initialLiquidity"
                                        value={formData.initialLiquidity}
                                        onChange={handleInputChange}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-cyan/50 transition-colors"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Feedback & Action */}
                        {error && (
                            <div className="p-4 bg-neon-coral/10 border border-neon-coral/20 rounded-lg text-neon-coral text-sm">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="p-4 bg-neon-green/10 border border-neon-green/20 rounded-lg text-neon-green text-sm flex items-center gap-2">
                                <Save size={16} /> {success}
                            </div>
                        )}

                        <NeonButton
                            variant="primary"
                            className="w-full py-4 text-lg"
                            disabled={isLoading}
                            type="submit"
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="animate-spin" /> ESTABLISHING MARKET...
                                </span>
                            ) : (
                                "CREATE MARKET DO YOU COPY?"
                            )}
                        </NeonButton>
                    </GlassCard>
                </form>
            </div>
        </div>
    );
}
