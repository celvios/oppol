import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './use-wallet';

const BC400_ABI = [
    "function balanceOf(address owner) view returns (uint256)"
];

// BC400 Token Addresses
const BC400_NFT_ADDRESS = "0xB929177331De755d7aCc5665267a247e458bCdeC";
const BC400_TOKEN_ADDRESS = "0x61Fc93c7C070B32B1b1479B86056d8Ec1D7125BD";
const MIN_TOKEN_BALANCE = "10000000"; // 10 Million
const BC400_DECIMALS = 9; // BC400 has 9 decimals (verified on-chain)

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

            try {
                setChecking(true);
                const provider = new ethers.JsonRpcProvider(process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-rpc.publicnode.com');

                // Check NFT Balance with 10s timeout
                const nftContract = new ethers.Contract(BC400_NFT_ADDRESS, BC400_ABI, provider);
                const nftBalance = await Promise.race([
                    nftContract.balanceOf(address),
                    new Promise<bigint>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
                ]).catch(() => BigInt(0));

                // Check Token Balance with 10s timeout
                const tokenContract = new ethers.Contract(BC400_TOKEN_ADDRESS, BC400_ABI, provider);
                const tokenBalance = await Promise.race([
                    tokenContract.balanceOf(address),
                    new Promise<bigint>((_, reject) => setTimeout(() => reject(new Error('Timeout')), 10000))
                ]).catch(() => BigInt(0));

                // BC400 uses 9 decimals (verified on-chain)
                const requiredTokens = ethers.parseUnits(MIN_TOKEN_BALANCE, BC400_DECIMALS);

                const hasEnoughTokens = tokenBalance >= requiredTokens;
                const hasNft = Number(nftBalance) > 0;

                console.log('[BC400 Access Check]', {
                    address,
                    tokenBalance: ethers.formatUnits(tokenBalance, BC400_DECIMALS),
                    tokenBalanceRaw: tokenBalance.toString(),
                    requiredTokens: MIN_TOKEN_BALANCE,
                    requiredTokensRaw: requiredTokens.toString(),
                    nftBalance: nftBalance.toString(),
                    hasNft,
                    hasEnoughTokens,
                    hasAccess: hasNft || hasEnoughTokens
                });

                setHasNFT(hasNft || hasEnoughTokens);
            } catch (error) {
                console.error("Error checking BC400 access:", error);
                setHasNFT(false);
            } finally {
                setChecking(false);
            }
        }

        checkBalance();
    }, [address, isConnected]);
    return { hasNFT, checking };
}
