"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, Tag } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import NeonButton from "@/components/ui/NeonButton";
import { motion } from "framer-motion";

interface Category {
    id: number;
    name: string;
    created_at: string;
}

export default function CategoriesPage() {
    const [categories, setCategories] = useState<Category[]>([]);
    const [newCategoryName, setNewCategoryName] = useState("");
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            const response = await fetch(`${apiUrl}/api/categories`);
            const data = await response.json();
            if (data.success) {
                setCategories(data.categories);
            }
        } catch (err) {
            console.error("Failed to fetch categories:", err);
            setError("Failed to load categories");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCategory = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newCategoryName.trim()) return;

        setCreating(true);
        setError(null);

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            const response = await fetch(`${apiUrl}/api/categories`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: newCategoryName.trim() })
            });

            const data = await response.json();
            if (data.success) {
                setNewCategoryName("");
                fetchCategories(); // Refresh the list
            } else {
                setError(data.message || "Failed to create category");
            }
        } catch (err) {
            console.error("Failed to create category:", err);
            setError("Failed to create category");
        } finally {
            setCreating(false);
        }
    };

    const handleDeleteCategory = async (id: number) => {
        if (!confirm("Are you sure you want to delete this category?")) return;

        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            const response = await fetch(`${apiUrl}/api/categories/${id}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            if (data.success) {
                fetchCategories(); // Refresh the list
            } else {
                setError(data.message || "Failed to delete category");
            }
        } catch (err) {
            console.error("Failed to delete category:", err);
            setError("Failed to delete category");
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-void text-white flex items-center justify-center">
                <div className="text-xl">Loading categories...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-void text-white p-6">
            <div className="max-w-4xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-8"
                >
                    <h1 className="text-4xl font-heading font-bold mb-2">
                        Category <span className="text-gradient-cyan">Management</span>
                    </h1>
                    <p className="text-text-secondary">
                        Manage market categories for better organization
                    </p>
                </motion.div>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-4 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400"
                    >
                        {error}
                    </motion.div>
                )}

                {/* Create Category Form */}
                <GlassCard className="mb-8 p-6">
                    <h2 className="text-xl font-heading font-bold mb-4 flex items-center gap-2">
                        <Plus className="w-5 h-5" />
                        Add New Category
                    </h2>
                    <form onSubmit={handleCreateCategory} className="flex gap-3">
                        <input
                            type="text"
                            value={newCategoryName}
                            onChange={(e) => setNewCategoryName(e.target.value)}
                            placeholder="Category name (e.g., Sports, Politics)"
                            className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white placeholder:text-white/40 focus:outline-none focus:border-neon-cyan/50 transition-colors"
                            disabled={creating}
                        />
                        <NeonButton
                            type="submit"
                            disabled={creating || !newCategoryName.trim()}
                            className="px-6"
                        >
                            {creating ? "Creating..." : "Create"}
                        </NeonButton>
                    </form>
                </GlassCard>

                {/* Categories List */}
                <GlassCard className="p-6">
                    <h2 className="text-xl font-heading font-bold mb-4 flex items-center gap-2">
                        <Tag className="w-5 h-5" />
                        Existing Categories ({categories.length})
                    </h2>

                    {categories.length === 0 ? (
                        <div className="text-center py-12 text-text-secondary">
                            <Tag className="w-12 h-12 mx-auto mb-3 opacity-30" />
                            <p>No categories yet. Create your first one above!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {categories.map((category, index) => (
                                <motion.div
                                    key={category.id}
                                    initial={{ opacity: 0, y: 10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-lg hover:border-neon-cyan/30 transition-colors group"
                                >
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-neon-cyan/20 to-neon-purple/20 flex items-center justify-center">
                                            <Tag className="w-5 h-5 text-neon-cyan" />
                                        </div>
                                        <div>
                                            <h3 className="font-semibold">{category.name}</h3>
                                            <p className="text-xs text-text-secondary">
                                                ID: {category.id}
                                            </p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteCategory(category.id)}
                                        className="opacity-0 group-hover:opacity-100 transition-opacity p-2 hover:bg-red-500/10 rounded-lg text-red-400 hover:text-red-300"
                                        title="Delete category"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </GlassCard>
            </div>
        </div>
    );
}
