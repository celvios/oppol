"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { ArrowLeft, Plus, Trash2, Calendar, Image as ImageIcon, Save, Loader2, Upload, X } from "lucide-react";
import GlassCard from "@/components/ui/GlassCard";
import NeonButton from "@/components/ui/NeonButton";
import Link from "next/link";
import { motion } from "framer-motion";
import { useWallet } from "@/lib/use-wallet";
import { useCreationAccess } from "@/lib/use-creation-access";
import { useRouter } from "next/navigation";
import { getContracts } from "@/lib/contracts";
import { ethers } from "ethers";
import { useConnectorClient } from 'wagmi';
import { clientToSigner } from "@/lib/viem-ethers-adapters";
import BC400PurchaseModal from "@/components/modals/BC400PurchaseModal";

export default function CreateMarketPage() {
    const { address, isConnected, connect } = useWallet();
    const { data: connectorClient } = useConnectorClient();
    const { canCreate, checking } = useCreationAccess();
    const router = useRouter();
    const [hasAdminAccess, setHasAdminAccess] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [createdMarketId, setCreatedMarketId] = useState<number | null>(null);
    const [imagePreview, setImagePreview] = useState<string | null>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [categories, setCategories] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [formData, setFormData] = useState({
        question: "",
        description: "",
        image: "",
        category: "Crypto",
        durationDays: "30",
        outcomes: ["Yes", "No"] // Default to binary, user can add more
    });

    // Check for admin access on mount
    useEffect(() => {
        const adminKey = localStorage.getItem("admin_secret");
        if (adminKey) {
            setHasAdminAccess(true);
        }

        // Fetch categories from API
        fetchCategories();
    }, []);

    const fetchCategories = async () => {
        try {
            const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';
            const response = await fetch(`${apiUrl}/api/categories`);
            const data = await response.json();
            if (data.success && data.categories) {
                const categoryNames = data.categories.map((cat: { name: string }) => cat.name);
                setCategories(categoryNames);
                // Set first category as default if available
                if (categoryNames.length > 0) {
                    setFormData(prev => ({ ...prev, category: categoryNames[0] }));
                }
            } else {
                // Fallback to hardcoded categories if API fails
                setCategories(["Crypto", "Tech", "Politics", "Sports", "Entertainment", "Science", "Other"]);
            }
        } catch (err) {
            console.error("Failed to fetch categories:", err);
            // Fallback to hardcoded categories
            setCategories(["Crypto", "Tech", "Politics", "Sports", "Entertainment", "Science", "Other"]);
        }
    };

    // Note: We don't redirect automatically - we show an error message instead
    // This allows users to see why they can't create markets

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // Image upload handlers
    const processFile = useCallback((file: File) => {
        if (!file.type.startsWith('image/')) {
            setError('Please upload an image file');
            return;
        }

        if (file.size > 5 * 1024 * 1024) { // 5MB limit
            setError('Image must be less than 5MB');
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            const base64 = e.target?.result as string;
            setImagePreview(base64);
            // We store the base64 for preview, but we'll upload the file on submit
            setFormData(prev => ({ ...prev, image: base64 }));
            setSelectedFile(file);
            setError('');
        };
        reader.readAsDataURL(file);
    }, []);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) processFile(file);
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files?.[0];
        if (file) processFile(file);
    };

    const removeImage = () => {
        setImagePreview(null);
        setSelectedFile(null);
        setFormData(prev => ({ ...prev, image: '' }));
        if (fileInputRef.current) fileInputRef.current.value = '';
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

    const uploadImage = async (file: File) => {
        const formData = new FormData();
        formData.append('image', file);

        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/upload`, {
            method: 'POST',
            body: formData
        });

        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'Image upload failed');

        // Cloudinary returns full URL directly
        return data.url;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError("");
        setSuccess("");

        // Basic Valdation
        if (formData.outcomes.some(o => o.trim() === "")) {
            setError("All outcomes must have a name.");
            setIsLoading(false);
            return;
        }
        const outcomeSet = new Set(formData.outcomes.map(o => o.trim().toLowerCase()));
        if (outcomeSet.size !== formData.outcomes.length) {
            setError("Outcome names must be unique.");
            setIsLoading(false);
            return;
        }

        if (!isConnected || !address) {
            setError("Please connect your wallet first");
            setIsLoading(false);
            return;
        }

        const adminKey = localStorage.getItem("admin_secret");
        const useAdminEndpoint = adminKey && hasAdminAccess;
        const usePublicEndpoint = canCreate && !useAdminEndpoint;

        if (!useAdminEndpoint && !usePublicEndpoint) {
            setError("You don't have permission to create markets. You need BFT token or admin access.");
            setIsLoading(false);
            return;
        }

        try {
            let marketId: number;
            let txHash: string;
            let finalImageUrl = formData.image;

            // Upload image if selected
            if (selectedFile) {
                try {
                    finalImageUrl = await uploadImage(selectedFile);
                } catch (err: unknown) {
                    const message = err instanceof Error ? err.message : 'Unknown upload error';
                    setError(`Image upload failed: ${message}`);
                    setIsLoading(false);
                    return;
                }
            } else if (formData.image.startsWith('data:')) {
                // If it's base64 but no file (maybe pasted?), warn or strip
                // But normally processFile sets selectedFile.
                // If the user didn't change image, assuming it's empty or URL
                if (finalImageUrl.length > 1000) {
                    setError("Image is too large (base64). Please upload a file.");
                    setIsLoading(false);
                    return;
                }
            }

            if (useAdminEndpoint) {
                // Admin flow: Use API endpoint
                const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/create-market-v2`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        "x-admin-secret": adminKey!
                    },
                    body: JSON.stringify({
                        question: formData.question,
                        description: formData.description,
                        image: finalImageUrl,
                        category: formData.category,
                        outcomes: formData.outcomes,
                        durationDays: parseFloat(formData.durationDays)
                    })
                });

                const data = await res.json();
                if (!data.success) {
                    setError(data.error || "Failed to create market");
                    setIsLoading(false);
                    return;
                }
                marketId = data.marketId;
                txHash = data.txHash;
            } else {
                // Public flow: User calls contract directly
                if (!connectorClient) {
                    setError("Wallet session stale. Opening connection modal...");
                    connect();
                    setIsLoading(false);
                    return;
                }

                const signer = clientToSigner(connectorClient);
                const contracts = getContracts();
                // Fix: Extract marketAddress from contracts object with fallbacks
                const marketAddress = contracts.predictionMarketMulti || contracts.predictionMarket || process.env.NEXT_PUBLIC_MARKET_ADDRESS;

                if (!marketAddress) {
                    throw new Error("Market contract address missing in config");
                }

                const marketABI = [
                    'function createMarket(string, string, string, string[], uint256) external returns (uint256)',
                    'function marketCount() view returns (uint256)'
                ];

                const contract = new ethers.Contract(marketAddress, marketABI, signer);

                console.log("Creating market with:", {
                    q: formData.question,
                    img: finalImageUrl ? "Present (URL/Data)" : "Empty",
                    d: formData.description,
                    o: formData.outcomes,
                    dur: formData.durationDays
                });

                // DEBUG: Run static call first to catch reverts
                try {
                    await contract.createMarket.staticCall(
                        formData.question,
                        finalImageUrl || "",
                        formData.description,
                        formData.outcomes,
                        parseFloat(formData.durationDays)
                    );
                } catch (staticError: any) {
                    console.error("Static call failed:", staticError);

                    // Robust Error Extraction
                    let reason = staticError.reason || staticError.message || "Unknown error";

                    // Handle nested error objects from Ethers/Viem
                    if (staticError.info && staticError.info.error && staticError.info.error.message) {
                        reason = staticError.info.error.message;
                    }

                    if (reason.toLowerCase().includes("insufficient creation token")) {
                        reason = "You do not have enough BFT (Creation Token) to create a market.";
                    } else if (reason.toLowerCase().includes("public creation disabled")) {
                        reason = "Public creation is currently disabled by admins.";
                    } else if (reason.toLowerCase().includes("user rejected")) {
                        reason = "User rejected the transaction.";
                    }

                    setError(`Validation Failed: ${reason}`);
                    setIsLoading(false);
                    return;
                }

                // If static call passes, send real transaction
                const tx = await contract.createMarket(
                    formData.question,
                    finalImageUrl || "",
                    formData.description,
                    formData.outcomes,
                    parseFloat(formData.durationDays)
                );

                console.log("Tx sent:", tx.hash);
                txHash = tx.hash;
                await tx.wait();

                // Get market ID
                const count = await contract.marketCount();
                marketId = Number(count) - 1;

                // Save metadata via API
                const metadataRes = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/markets/metadata`, {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        marketId,
                        question: formData.question,
                        description: formData.description,
                        image: finalImageUrl,
                        category: formData.category,
                        outcome_names: formData.outcomes
                    })
                });

                const metadataData = await metadataRes.json();
                if (!metadataData.success) {
                    console.warn("Market created but metadata save failed:", metadataData.error);
                }
            }

            setSuccess(`Market created successfully! ID: ${marketId}`);
            setCreatedMarketId(marketId);
            // Auto-redirect disabled per user request
        } catch (e: unknown) {
            console.error("Create market error:", e);
            // Show the actual error message from the blockchain/contract
            let errorMessage = "Failed to create market";

            const err = e as any;
            if (err.reason) {
                errorMessage = err.reason;
            } else if (err.message) {
                if (err.message.includes("actions")) {
                    errorMessage = "User rejected the transaction.";
                } else {
                    errorMessage = err.message.length > 100 ? "Transaction failed check console" : err.message;
                }
            }

            setError(errorMessage);
        } finally {
            setIsLoading(false);
        }
    };

    // Show loading while checking access
    if (checking) {
        return (
            <div className="min-h-screen bg-void flex items-center justify-center">
                <div className="text-white">Checking access...</div>
            </div>
        );
    }



    // Show error if no access (only if connected - allow viewing form if not connected)
    if (isConnected && !canCreate && !hasAdminAccess) {
        return (
            <div className="min-h-screen bg-void flex items-center justify-center p-4">
                <BC400PurchaseModal isOpen={true} onClose={() => router.push('/')} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-void pb-20 pt-24 px-4 md:px-6">
            <div className="max-w-4xl mx-auto space-y-8">
                {/* Header */}
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 rounded-full bg-white/5 hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                    >
                        <ArrowLeft size={20} />
                    </button>
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

                                <div className="space-y-2 md:col-span-2">
                                    <label className="text-sm text-text-secondary uppercase tracking-wider flex items-center gap-2">
                                        <ImageIcon size={14} /> Market Image
                                    </label>

                                    {/* Hidden file input */}
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept="image/*"
                                        onChange={handleFileChange}
                                        className="hidden"
                                    />

                                    {imagePreview ? (
                                        /* Image Preview */
                                        <div className="relative group">
                                            <img
                                                src={imagePreview}
                                                alt="Preview"
                                                className="w-full h-48 object-cover rounded-lg border border-white/10"
                                            />
                                            <button
                                                type="button"
                                                onClick={removeImage}
                                                className="absolute top-2 right-2 p-2 bg-black/70 rounded-full text-white/70 hover:text-neon-coral hover:bg-black transition-colors"
                                            >
                                                <X size={16} />
                                            </button>
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                                <button
                                                    type="button"
                                                    onClick={() => fileInputRef.current?.click()}
                                                    className="px-4 py-2 bg-white/10 rounded-lg text-white text-sm hover:bg-white/20 transition-colors"
                                                >
                                                    Change Image
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        /* Drag & Drop Zone */
                                        <div
                                            onClick={() => fileInputRef.current?.click()}
                                            onDragOver={handleDragOver}
                                            onDragLeave={handleDragLeave}
                                            onDrop={handleDrop}
                                            className={`
                                                w-full h-48 border-2 border-dashed rounded-lg cursor-pointer
                                                flex flex-col items-center justify-center gap-3 transition-all
                                                ${isDragging
                                                    ? 'border-neon-cyan bg-neon-cyan/10'
                                                    : 'border-white/20 hover:border-white/40 bg-black/20 hover:bg-black/30'
                                                }
                                            `}
                                        >
                                            <Upload className={`w-10 h-10 ${isDragging ? 'text-neon-cyan' : 'text-white/30'}`} />
                                            <div className="text-center">
                                                <p className={`font-medium ${isDragging ? 'text-neon-cyan' : 'text-white/50'}`}>
                                                    {isDragging ? 'Drop image here' : 'Click to upload or drag & drop'}
                                                </p>
                                                <p className="text-xs text-white/30 mt-1">PNG, JPG, GIF up to 5MB</p>
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="space-y-2">
                                    <label className="text-sm text-text-secondary uppercase tracking-wider">Category</label>
                                    <select
                                        name="category"
                                        value={formData.category}
                                        onChange={handleInputChange}
                                        className="w-full bg-black/20 border border-white/10 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-neon-cyan/50 transition-colors appearance-none"
                                    >
                                        {categories.map((category) => (
                                            <option key={category} value={category}>{category}</option>
                                        ))}
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
                            </div>
                        </div>

                        {/* Feedback & Action */}
                        {error && (
                            <div className="p-4 bg-neon-coral/10 border border-neon-coral/20 rounded-lg text-neon-coral text-sm">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="flex flex-col gap-4">
                                <div className="p-4 bg-neon-green/10 border border-neon-green/20 rounded-lg text-neon-green text-sm flex items-center gap-2">
                                    <Save size={16} /> {success}
                                </div>
                                {createdMarketId !== null && (
                                    <div className="text-white/60 text-xs text-center px-4">
                                        Market created! It may take a few minutes to span across the network and appear on the dashboard.
                                    </div>
                                )}
                            </div>
                        )}

                        <NeonButton
                            variant="cyan"
                            className="w-full py-4 text-lg"
                            disabled={isLoading}
                            type="submit"
                        >
                            {isLoading ? (
                                <span className="flex items-center gap-2">
                                    <Loader2 className="animate-spin" /> ESTABLISHING MARKET...
                                </span>
                            ) : (
                                "CREATE MARKET"
                            )}
                        </NeonButton>
                    </GlassCard>
                </form>
            </div>
        </div>
    );
}
