import { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import { useWallet } from './use-wallet';

const BC400_ABI = [
    "function balanceOf(address owner) view returns (uint256)"
];

// Placeholder - User can update this in .env later
const BC400_NFT_ADDRESS = "0xB929177331De755d7aCc5665267a247e458bCdeC";
const BC400_TOKEN_ADDRESS = "0x61Fc93c7C070B32B1b1479B86056d8Ec1D7125BD";
const MIN_TOKEN_BALANCE = "10000000"; // 10 Million

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

                // Check NFT Balance
                const nftContract = new ethers.Contract(BC400_NFT_ADDRESS, BC400_ABI, provider);
                const nftBalance = await nftContract.balanceOf(address).catch(() => BigInt(0));

                // Check Token Balance
                const tokenContract = new ethers.Contract(BC400_TOKEN_ADDRESS, BC400_ABI, provider);
                const tokenBalance = await tokenContract.balanceOf(address).catch(() => BigInt(0));

                // Logic: (NFT > 0) OR (Token >= 10M)
                // Assuming Token has 18 decimals. If 9, adjust accordingly.
                // Standard ERC20 is 18. 10M = 10_000_000 * 10^18
                const requiredTokens = ethers.parseUnits(MIN_TOKEN_BALANCE, 18);

                const hasEnoughTokens = tokenBalance >= requiredTokens;
                const hasNft = Number(nftBalance) > 0;

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
