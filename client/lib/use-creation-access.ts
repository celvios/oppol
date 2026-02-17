
import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './use-wallet';

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
const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_CHAIN_ID || process.env.CHAIN_ID || '56');

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
                // Don't enforce CHAIN_ID here to avoid Vercel env mismatch issues (e.g. RPC is Mainnet but ID is 97)
                const provider = new ethers.JsonRpcProvider(RPC_URL);

                // Check NFT Balance
                const nftContract = new ethers.Contract(BC400_NFT_ADDRESS, ERC20_ABI, provider);
                const nftBalance = await Promise.race([
                    nftContract.balanceOf(address),
                    new Promise<bigint>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
                ]).catch(() => BigInt(0));

                // Check Token Balance
                const tokenContract = new ethers.Contract(BC400_TOKEN_ADDRESS, ERC20_ABI, provider);
                const tokenBalance = await Promise.race([
                    tokenContract.balanceOf(address),
                    new Promise<bigint>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
                ]).catch(() => BigInt(0));

                const requiredTokens = ethers.parseUnits(MIN_TOKEN_BALANCE, BC400_DECIMALS);
                const hasEnoughTokens = tokenBalance >= requiredTokens;

                const hasNft = Number(nftBalance) > 0;

                console.log('[CreationAccess Check]', {
                    address,
                    tokenBalance: ethers.formatUnits(tokenBalance, BC400_DECIMALS),
                    requiredTokens: MIN_TOKEN_BALANCE,
                    nftBalance: nftBalance.toString(),
                    hasNft,
                    hasEnoughTokens,
                    canCreate: hasNft || hasEnoughTokens
                });

                setCanCreate(hasNft || hasEnoughTokens);
            } catch (err) {
                console.error("[CreationAccess] Error checking BC400 access:", err);
                setCanCreate(false);
            } finally {
                setChecking(false);
            }
        }

        checkAccess();
    }, [address, isConnected]);

    return { canCreate, checking };
}
