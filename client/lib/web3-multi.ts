import { ethers } from 'ethers';
import { getMultiContracts, PREDICTION_MARKET_MULTI_ABI } from './contracts-multi';
import { getCurrentNetwork } from './contracts';

export interface MultiMarket {
    id: number;
    question: string;
    outcomes: string[];
    outcomeCount: number;
    shares: string[];
    prices: number[];  // 0-100 for each outcome
    endTime: number;
    liquidityParam: string;
    totalVolume: string;
    resolved: boolean;
    winningOutcome: number;
}

export interface MultiPosition {
    shares: string[];
    claimed: boolean;
}

const USDC_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
];

export class Web3MultiService {
    private provider: ethers.JsonRpcProvider;
    private predictionMarket: ethers.Contract;
    private usdc: ethers.Contract;

    constructor() {
        const network = getCurrentNetwork();
        this.provider = new ethers.JsonRpcProvider(network.rpcUrl);

        const contracts = getMultiContracts();
        const marketAddress = contracts.predictionMarketMulti;


        // Only instantiate if address is present
        if (contracts.predictionMarketMulti) {
            this.predictionMarket = new ethers.Contract(
                contracts.predictionMarketMulti,
                PREDICTION_MARKET_MULTI_ABI,
                this.provider
            );
        } else {
            console.warn('[Web3Multi] Missing Market Contract Address - Service execution will be limited');
        }

        const usdcAddress = (contracts as any).mockUSDC || (contracts as any).usdc;
        if (usdcAddress) {
            this.usdc = new ethers.Contract(
                usdcAddress,
                USDC_ABI,
                this.provider
            );
        }
    }

    /**
     * Get all multi-outcome markets
     */
    async getMarkets(): Promise<MultiMarket[]> {
        if (!this.predictionMarket) return [];
        try {
            const count = Number(await this.predictionMarket.marketCount());
            const ids = Array.from({ length: count }, (_, i) => i);

            const markets: MultiMarket[] = [];

            for (const id of ids) {
                try {
                    const market = await this.getMarket(id);
                    if (market) markets.push(market);
                } catch (e) {
                    console.error(`Error fetching market ${id}:`, e);
                }
            }

            return markets;
        } catch (error) {
            console.error('Error fetching multi-markets:', error);
            return [];
        }
    }

    /**
     * Get single multi-outcome market
     */
    async getMarket(marketId: number): Promise<MultiMarket | null> {
        if (!this.predictionMarket) return null;
        try {
            const [basicInfo, outcomes, shares, prices] = await Promise.all([
                this.predictionMarket.getMarketBasicInfo(marketId),
                this.predictionMarket.getMarketOutcomes(marketId),
                this.predictionMarket.getMarketShares(marketId),
                this.predictionMarket.getAllPrices(marketId),
            ]);

            const sharesFormatted = shares.map((s: bigint) => ethers.formatUnits(s, 6));
            const pricesFormatted = prices.map((p: bigint) => Number(p) / 100); // Convert basis points to percentage

            const totalVolume = sharesFormatted.reduce((sum: number, s: string) => sum + parseFloat(s), 0);

            return {
                id: marketId,
                question: basicInfo.question,
                outcomes: outcomes,
                outcomeCount: Number(basicInfo.outcomeCount),
                shares: sharesFormatted,
                prices: pricesFormatted,
                endTime: Number(basicInfo.endTime),
                liquidityParam: ethers.formatUnits(basicInfo.liquidityParam, 18),
                totalVolume: totalVolume.toFixed(2),
                resolved: basicInfo.resolved,
                winningOutcome: Number(basicInfo.winningOutcome),
            };
        } catch (error) {
            console.error('Error fetching multi-market:', error);
            return null;
        }
    }

    /**
     * Get price for specific outcome (0-100%)
     */
    async getOutcomePrice(marketId: number, outcomeIndex: number): Promise<number> {
        if (!this.predictionMarket) return 0;
        try {
            const price = await this.predictionMarket.getPrice(marketId, outcomeIndex);
            return Number(price) / 100;
        } catch (error) {
            console.error('Error fetching outcome price:', error);
            return 0;
        }
    }

    /**
     * Calculate cost to buy shares
     */
    async calculateCost(marketId: number, outcomeIndex: number, shares: number): Promise<string> {
        if (!this.predictionMarket) return '0';
        try {
            const sharesInUnits = ethers.parseUnits(shares.toString(), 6);
            const cost = await this.predictionMarket.calculateCost(marketId, outcomeIndex, sharesInUnits);
            return ethers.formatUnits(cost, 6);
        } catch (error) {
            console.error('Error calculating cost:', error);
            return '0';
        }
    }

    /**
     * Get user position for a multi-outcome market
     */
    async getUserPosition(marketId: number, userAddress: string): Promise<MultiPosition | null> {
        if (!this.predictionMarket) return null;
        try {
            const position = await this.predictionMarket.getUserPosition(marketId, userAddress);
            return {
                shares: position.shares.map((s: bigint) => ethers.formatUnits(s, 6)),
                claimed: position.claimed,
            };
        } catch (error) {
            console.error('Error fetching position:', error);
            return null;
        }
    }

    /**
     * Get deposited balance in the contract
     */
    async getDepositedBalance(address: string): Promise<string> {
        if (!this.predictionMarket) return '0';
        try {
            const balance = await this.predictionMarket.userBalances(address);
            return ethers.formatUnits(balance, 6);
        } catch (error) {
            console.error('Error fetching deposited balance:', error);
            return '0';
        }
    }

    /**
     * Get USDC wallet balance
     */
    async getUSDCBalance(address: string): Promise<string> {
        if (!this.usdc) return '0';
        try {
            const balance = await this.usdc.balanceOf(address);
            return ethers.formatUnits(balance, 6);
        } catch (error) {
            console.error('Error fetching USDC balance:', error);
            return '0';
        }
    }
}

export const web3MultiService = new Web3MultiService();
