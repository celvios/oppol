
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

                // Try multiple RPCs if one fails
                const RPCS = [
                    "https://bsc-dataseed.binance.org/",
                    "https://bsc-dataseed1.defibit.io/",
                    "https://bsc-dataseed1.ninicoin.io/",
                    "https://bscrpc.com"
                ];

                let provider = null;
                for (const rpc of RPCS) {
                    try {
                        const p = new ethers.JsonRpcProvider(rpc);
                        await p.getNetwork(); // Test connection
                        provider = p;
                        break;
                    } catch (e) {
                        console.warn(`RPC ${rpc} failed, trying next...`);
                    }
                }

                if (!provider) {
                    console.error("All RPCs failed for creation check");
                    setCanCreate(false); // Default to false if we can't check
                    setChecking(false);
                    return;
                }

                const marketAddress = process.env.NEXT_PUBLIC_MARKET_ADDRESS;
                try {
                    // Safety check for empty addresses
                    if (!marketAddress || marketAddress === "") {
                        console.warn('[CreationAccess] Missing Market Address');
                        setCanCreate(false);
                        setChecking(false);
                        return;
                    }

                    const market = new ethers.Contract(marketAddress, MARKET_ABI, provider);

                    // Check 1: User holds the specific NFT (if configured)
                    // This is a placeholder for actual NFT gating logic if needed

                    // Check 2: Check standard token balance or whitelist
                    // For now, we'll check if the user has deposited funds or holds OPOLL token if applicable

                    // Get required token/NFT address from env or config
                    const tokenAddr = process.env.NEXT_PUBLIC_GATE_TOKEN_ADDRESS;

                    if (tokenAddr && tokenAddr !== "") {
                        const token = new ethers.Contract(tokenAddr, ERC20_ABI, provider);
                        const balance = await token.balanceOf(address);
                        if (balance > 0) {
                            setCanCreate(true);
                            setChecking(false);
                            return;
                        }
                    }

                    // If no token gate, check if they have ever traded (deposited balance > 0)
                    // This is a basic anti-spam measure
                    try {
                        const balance = await market.userBalances(address);
                        if (BigInt(balance) > BigInt(0)) {
                            setCanCreate(true);
                            setChecking(false);
                            return;
                        }
                    } catch (err) {
                        console.warn('[CreationAccess] Failed to check user balance', err);
                    }

                    // Default: Allow access if no strict gates are failing, 
                    // OR restrict it. For Mainnet, we might want to restrict.
                    // For now, let's default to TRUE to avoid blocking legit users during launch
                    // unless explicitly gated.
                    setCanCreate(true);

                } catch (err) {
                    console.error('[CreationAccess] Error checking access:', err);
                    setCanCreate(false);
                } finally {
                    setChecking(false);
                }
            } catch (globalErr) {
                console.error("Global error in creation check:", globalErr);
                setCanCreate(false);
                setChecking(false);
            }
        }

        checkAccess();
    }, [address, isConnected]);

    return { canCreate, checking };
}
