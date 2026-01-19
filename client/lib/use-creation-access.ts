
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

// Use environment variable or default to BSC Testnet
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com';
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || '97');

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
                // Use configured RPC for reading state
                const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);

                const marketAddress = process.env.NEXT_PUBLIC_MARKET_ADDRESS;
                if (!marketAddress) {
                    console.log('[CreationAccess] No market address configured');
                    setCanCreate(false);
                    setChecking(false);
                    return;
                }

                const market = new ethers.Contract(marketAddress, MARKET_ABI, provider);

                // Check if public creation is enabled
                try {
                    const isPublic = await market.publicCreation();
                    if (isPublic) {
                        setCanCreate(true);
                        setChecking(false);
                        return;
                    }
                } catch (e) {
                    // Function might not exist on contract, assume not public
                    console.log('[CreationAccess] publicCreation check failed, assuming restricted');
                }

                // Check token-gated access
                try {
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

                    setCanCreate(balance >= minBalance);
                } catch (e) {
                    // Token gating not configured, default to false
                    console.log('[CreationAccess] Token gating check failed');
                    setCanCreate(false);
                }
            } catch (err) {
                console.error("[CreationAccess] Error checking creation access:", err);
                setCanCreate(false);
            } finally {
                setChecking(false);
            }
        }

        checkAccess();
    }, [address, isConnected]);

    return { canCreate, checking };
}
