import { ethers } from 'ethers';
import { getContracts, getCurrentNetwork } from './contracts';

// ABI for PredictionMarketLMSR contract (with Deposit System)
const PREDICTION_MARKET_LMSR_ABI = [
    'function marketCount() view returns (uint256)',
    'function markets(uint256) view returns (string question, uint256 endTime, uint256 yesShares, uint256 noShares, uint256 liquidityParam, bool resolved, bool outcome, uint256 subsidyPool, bytes32 assertionId, bool assertionPending, address asserter, bool assertedOutcome)',
    'function getPrice(uint256 marketId) view returns (uint256)',
    'function calculateCost(uint256 marketId, bool isYes, uint256 shares) view returns (uint256)',
    'function buyShares(uint256 marketId, bool isYes, uint256 shares, uint256 maxCost)',
    'function getUserPosition(uint256 marketId, address user) view returns (uint256 yesShares, uint256 noShares, bool claimed)',
    'function claimWinnings(uint256 marketId)',
    'function userBalances(address) view returns (uint256)',
    'function deposit(uint256 amount)',
    'function withdraw(uint256 amount)',
];

const USDC_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
];

export class Web3Service {
    private provider: ethers.JsonRpcProvider;
    private predictionMarket: ethers.Contract;
    private usdc: ethers.Contract;

    constructor() {
        const network = getCurrentNetwork();
        this.provider = new ethers.JsonRpcProvider(network.rpcUrl);

        const contracts = getContracts() as any; // Type assertion for flexibility

        // Use LMSR contract if available, fallback to old AMM
        const marketAddress = contracts.predictionMarketLMSR || contracts.predictionMarket;
        this.predictionMarket = new ethers.Contract(
            marketAddress,
            PREDICTION_MARKET_LMSR_ABI,
            this.provider
        );

        const usdcAddress = contracts.mockUSDC || contracts.usdc;
        this.usdc = new ethers.Contract(
            usdcAddress,
            USDC_ABI,
            this.provider
        );
    }

    /**
     * Get all markets
     */
    /**
     * Get all markets
     */
    async getMarkets() {
        try {
            const count = Number(await this.predictionMarket.marketCount());
            const ids = Array.from({ length: count }, (_, i) => i);

            // Fetch all data in parallel
            const [marketsData, pricesData] = await Promise.all([
                Promise.all(ids.map(id => this.predictionMarket.markets(id))),
                Promise.all(ids.map(id => this.predictionMarket.getPrice(id)))
            ]);

            return ids.map((id, index) => {
                const market = marketsData[index];
                const price = pricesData[index];
                const yesOdds = Number(price) / 100;

                return {
                    id: id,
                    question: market.question,
                    endTime: Number(market.endTime),
                    yesShares: ethers.formatUnits(market.yesShares, 6),
                    noShares: ethers.formatUnits(market.noShares, 6),
                    yesPool: ethers.formatUnits(market.yesShares, 6),
                    noPool: ethers.formatUnits(market.noShares, 6),
                    totalVolume: (parseFloat(ethers.formatUnits(market.yesShares, 6)) + parseFloat(ethers.formatUnits(market.noShares, 6))).toFixed(2),
                    resolved: market.resolved,
                    outcome: market.outcome,
                    yesOdds: yesOdds,
                    noOdds: 100 - yesOdds,
                    assertionPending: market.assertionPending,
                    assertedOutcome: market.assertedOutcome,
                    asserter: market.asserter,
                };
            });
        } catch (error) {
            console.error('Error fetching markets:', error);
            return [];
        }
    }

    /**
     * Get single market
     */
    async getMarket(marketId: number) {
        try {
            const market = await this.predictionMarket.markets(marketId);
            const price = await this.predictionMarket.getPrice(marketId);

            const yesOdds = Number(price) / 100;

            return {
                id: marketId,
                question: market.question,
                endTime: Number(market.endTime),
                yesShares: ethers.formatUnits(market.yesShares, 6),
                noShares: ethers.formatUnits(market.noShares, 6),
                yesPool: ethers.formatUnits(market.yesShares, 6), // For compatibility
                noPool: ethers.formatUnits(market.noShares, 6),
                totalVolume: (parseFloat(ethers.formatUnits(market.yesShares, 6)) + parseFloat(ethers.formatUnits(market.noShares, 6))).toFixed(2),
                resolved: market.resolved,
                outcome: market.outcome,
                yesOdds: yesOdds,
                noOdds: 100 - yesOdds,
            };
        } catch (error) {
            console.error('Error fetching market:', error);
            return null;
        }
    }

    /**
     * Calculate cost to buy shares (LMSR)
     */
    async calculateCost(marketId: number, isYes: boolean, shares: number) {
        try {
            const sharesInUnits = ethers.parseUnits(shares.toString(), 6);
            const cost = await this.predictionMarket.calculateCost(marketId, isYes, sharesInUnits);
            return ethers.formatUnits(cost, 6);
        } catch (error) {
            console.error('Error calculating cost:', error);
            return '0';
        }
    }

    /**
     * Get user position
     */
    async getUserPosition(marketId: number, userAddress: string) {
        try {
            const position = await this.predictionMarket.getUserPosition(marketId, userAddress);

            return {
                yesShares: ethers.formatUnits(position.yesShares, 6),
                noShares: ethers.formatUnits(position.noShares, 6),
                claimed: position.claimed,
            };
        } catch (error) {
            console.error('Error fetching position:', error);
            return null;
        }
    }

    /**
     * Get USDC balance (wallet balance)
     */
    async getUSDCBalance(address: string) {
        try {
            const balance = await this.usdc.balanceOf(address);
            return ethers.formatUnits(balance, 6);
        } catch (error) {
            console.error('Error fetching USDC balance:', error);
            return '0';
        }
    }

    /**
     * Get deposited balance in the prediction market contract (Polymarket-style)
     */
    async getDepositedBalance(address: string) {
        try {
            const balance = await this.predictionMarket.userBalances(address);
            return ethers.formatUnits(balance, 6);
        } catch (error) {
            console.error('Error fetching deposited balance:', error);
            return '0';
        }
    }
}

export const web3Service = new Web3Service();
