import { CONTRACTS } from "./contracts";
import { ethers } from "ethers";

// Configuration for Boost Tiers
export const BOOST_TIERS = [
    { id: 1, name: "Flash Boost", price: 20, hours: 12, color: "from-blue-400 to-blue-600", emoji: "⚡" },
    { id: 2, name: "Standard", price: 50, hours: 24, color: "from-purple-400 to-purple-600", emoji: "🔥" },
    { id: 3, name: "Whale Pin", price: 150, hours: 168, color: "from-yellow-400 to-yellow-600", emoji: "🐋" }
];

// Admin Wallet for Receiving Payments
const ADMIN_WALLET = "0xYourAdminWalletHere"; // Replace with real admin wallet

export const BoostService = {
    async verifyBoost(marketId: number | string, txHash: string, tierId: number) {
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001'}/api/boost/verify`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ marketId, txHash, tierId })
            });
            return await response.json();
        } catch (error) {
            console.error("Boost verification failed:", error);
            return { success: false, message: "Network error" };
        }
    },

    getAdminWallet() {
        return ADMIN_WALLET;
    }
};
