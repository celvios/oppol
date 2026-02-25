
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './use-wallet';
import { useAccount } from 'wagmi';

const ERC20_ABI = [
    "function balanceOf(address owner) view returns (uint256)"
];

// BC400 Token Addresses
const BC400_NFT_ADDRESS = "0xB929177331De755d7aCc5665267a247e458bCdeC";
const BC400_TOKEN_ADDRESS = "0x61Fc93c7C070B32B1b1479B86056d8Ec1D7125BD";
const MIN_TOKEN_BALANCE = "10000000"; // 10 Million
const BC400_DECIMALS = 9; // BC400 has 9 decimals

// Use environment variable or default to BSC Mainnet
const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || process.env.BNB_RPC_URL || 'https://bsc-dataseed.binance.org';

async function hasCreationAccess(address: string, provider: ethers.JsonRpcProvider): Promise<boolean> {
    const nftContract = new ethers.Contract(BC400_NFT_ADDRESS, ERC20_ABI, provider);
    const tokenContract = new ethers.Contract(BC400_TOKEN_ADDRESS, ERC20_ABI, provider);

    const [nftBalance, tokenBalance] = await Promise.all([
        Promise.race([
            nftContract.balanceOf(address),
            new Promise<bigint>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
        ]).catch(() => BigInt(0)),
        Promise.race([
            tokenContract.balanceOf(address),
            new Promise<bigint>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
        ]).catch(() => BigInt(0)),
    ]);

    const requiredTokens = ethers.parseUnits(MIN_TOKEN_BALANCE, BC400_DECIMALS);
    const hasEnoughTokens = (tokenBalance as bigint) >= requiredTokens;
    const hasNft = Number(nftBalance) > 0;

    console.log(`[CreationAccess] ${address}: tokens=${ethers.formatUnits(tokenBalance as bigint, BC400_DECIMALS)}, nft=${nftBalance}, access=${hasNft || hasEnoughTokens}`);
    return hasNft || hasEnoughTokens;
}

export function useCreationAccess() {
    const { address: effectiveAddress, isConnected } = useWallet();
    // Also grab the raw MetaMask/wagmi address in case the user is Google-logged-in
    // with BC400 sitting in their externally connected MetaMask
    const { address: wagmiAddress } = useAccount();

    // Start as `true` when connected to prevent a premature "Access Restricted" flash
    const [canCreate, setCanCreate] = useState(false);
    const [checking, setChecking] = useState(!!effectiveAddress || !!wagmiAddress);

    useEffect(() => {
        async function checkAccess() {
            if (!isConnected || (!effectiveAddress && !wagmiAddress)) {
                setCanCreate(false);
                setChecking(false);
                return;
            }

            try {
                setChecking(true);
                const provider = new ethers.JsonRpcProvider(RPC_URL);

                // Check all available addresses — custodial/embedded AND MetaMask
                const addressesToCheck = Array.from(
                    new Set([effectiveAddress, wagmiAddress].filter(Boolean) as string[])
                );

                const results = await Promise.all(
                    addressesToCheck.map(addr => hasCreationAccess(addr, provider))
                );

                const access = results.some(Boolean);
                setCanCreate(access);
            } catch (err) {
                console.error("[CreationAccess] Error checking BC400 access:", err);
                setCanCreate(false);
            } finally {
                setChecking(false);
            }
        }

        checkAccess();
    }, [effectiveAddress, wagmiAddress, isConnected]);

    return { canCreate, checking };
}
