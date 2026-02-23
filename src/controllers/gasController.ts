import { Request, Response } from 'express';
import { gasService } from '../services/gasService';
import { ethers } from 'ethers';

// Base exact gas limit for a standard Pimlico batched transaction
// (approve + transfer fee + buyShares) = ~330,000 gas units on BSC
const BASE_GAS_LIMIT = BigInt(330000);

export const estimateGasFeeUSDC = async (req: Request, res: Response) => {
    try {
        // We use gasService to get the Chainlink oracle BNB price
        // and calculate the USDC equivalent on the backend

        // 1. Estimate base cost in USDC
        const estimatedFeeUSDCBigInt = await gasService.estimateGasCostInUSDC(BASE_GAS_LIMIT);

        // Return 18 decimal formatted string for easy usage on the frontend
        const feeUSDCFormatted = ethers.formatUnits(estimatedFeeUSDCBigInt, 18);

        return res.json({
            success: true,
            feeUSDC: feeUSDCFormatted, // e.g. "0.1504"
            feeUSDCWei: estimatedFeeUSDCBigInt.toString(),
            message: "Estimated successfully via Chainlink Oracle"
        });
    } catch (error: any) {
        console.error('[GasController] Failed to estimate gas fee:', error);

        // Fallback robust enough to keep trading alive
        return res.status(500).json({
            success: false,
            // $0.20 fallback represented in 18 decimals
            feeUSDC: "0.20",
            feeUSDCWei: ethers.parseUnits("0.20", 18).toString(),
            error: error.message || "Failed to estimate gas fee"
        });
    }
};
