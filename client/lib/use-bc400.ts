import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './use-wallet';

const BC400_ABI = [
    "function balanceOf(address owner) view returns (uint256)"
];

// Placeholder - User can update this in .env later
const BC400_ADDRESS = process.env.NEXT_PUBLIC_BC400_CONTRACT_ADDRESS || "0xB929177331De755d7aCc5665267a247e458bCdeC";

export function useBC400Check() {
    const { address, isConnected } = useWallet();
    const [hasNFT, setHasNFT] = useState(false);
    const [checking, setChecking] = useState(false);

    useEffect(() => {
        async function checkBalance() {
            if (!isConnected || !address) {
                setHasNFT(false);
                return;
            }

            // If address is the ZeroAddress placeholder, we can't check
            // For dev/demo purposes, we might want to default to FALSE to show the modal
            if (BC400_ADDRESS === ethers.ZeroAddress) {
                setHasNFT(false);
                return;
            }

            try {
                setChecking(true);
                // Use a public provider or the connected provider
                const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-rpc.publicnode.com');
                const contract = new ethers.Contract(BC400_ADDRESS, BC400_ABI, provider);

                const balance = await contract.balanceOf(address);
                setHasNFT(Number(balance) > 0);
            } catch (error) {
                console.error("Error checking BC400 balance:", error);
                setHasNFT(false);
            } finally {
                setChecking(false);
            }
        }

        checkBalance();
    }, [address, isConnected]);

    return { hasNFT, checking };
}
