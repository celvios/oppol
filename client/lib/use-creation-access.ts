
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './use-wallet';

const MARKET_ABI = [
    "function creationToken() view returns (address)",
    "function minCreationBalance() view returns (uint256)",
    "function publicCreation() view returns (bool)"
];

const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)"
];

export function useCreationAccess() {
    const { address, isConnected } = useWallet();
    const [canCreate, setCanCreate] = useState(false);
    const [checking, setChecking] = useState(false);

    useEffect(() => {
        async function checkAccess() {
            if (!isConnected || !address) {
                setCanCreate(false);
                return;
            }

            try {
                setChecking(true);
                // Use public RPC for reading state
                const provider = new ethers.JsonRpcProvider("https://bsc-dataseed.binance.org/"); // Mainnet
                // Or specific env RPC

                const marketAddress = process.env.NEXT_PUBLIC_MARKET_ADDRESS;
                if (!marketAddress) return;

                const market = new ethers.Contract(marketAddress, MARKET_ABI, provider);

                const isPublic = await market.publicCreation();
                if (isPublic) {
                    setCanCreate(true);
                    setChecking(false);
                    return;
                }

                const tokenAddr = await market.creationToken();
                if (tokenAddr === ethers.ZeroAddress) {
                    // If restricted but no token set, likely only owner or disabled
                    setCanCreate(false);
                    setChecking(false);
                    return;
                }

                const minBalance = await market.minCreationBalance();
                const token = new ethers.Contract(tokenAddr, ERC20_ABI, provider);
                const balance = await token.balanceOf(address);

                if (balance >= minBalance) {
                    setCanCreate(true);
                } else {
                    setCanCreate(false);
                }
            } catch (err) {
                console.error("Error checking creation access:", err);
                setCanCreate(false);
            } finally {
                setChecking(false);
            }
        }

        checkAccess();
    }, [address, isConnected]);

    return { canCreate, checking };
}
