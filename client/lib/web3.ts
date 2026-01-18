import { ethers } from 'ethers';
import { getContracts, getCurrentNetwork } from './contracts';

// ABI for PredictionMarketMulti - Unified contract for all markets
const PREDICTION_MARKET_MULTI_ABI = [
    'function marketCount() view returns (uint256)',
    'function getMarketBasicInfo(uint256 marketId) view returns (string question, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome)',
    'function getMarketOutcomes(uint256 marketId) view returns (string[])',
    'function getMarketShares(uint256 marketId) view returns (uint256[])',
    'function getAllPrices(uint256 marketId) view returns (uint256[])',
    'function getPrice(uint256 marketId, uint256 outcomeIndex) view returns (uint256)',
    'function calculateCost(uint256 marketId, uint256 outcomeIndex, uint256 shares) view returns (uint256)',
    'function buyShares(uint256 marketId, uint256 outcomeIndex, uint256 shares, uint256 maxCost)',
    'function getUserPosition(uint256 marketId, address user) view returns (uint256[] shares, bool claimed)',
    'function userBalances(address) view returns (uint256)',
    'function deposit(uint256 amount)',
    'function withdraw(uint256 amount)',
    'function claimWinnings(uint256 marketId)',
    'function getMarketStatus(uint256 marketId) view returns (bool ended, bool assertionPending, bool resolved, uint256 winningOutcome, address asserter, bytes32 assertionId)',
];

const USDC_ABI = [
    'function balanceOf(address) view returns (uint256)',
    'function approve(address spender, uint256 amount) returns (bool)',
    'function allowance(address owner, address spender) view returns (uint256)',
];

export interface Market {
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
    // Legacy compatibility fields for binary markets
    yesOdds: number;
    noOdds: number;
    yesShares: string;
    noShares: string;
    yesPool: string;
    noPool: string;
    outcome?: boolean;
    assertionPending?: boolean;
    assertedOutcome?: boolean;
    asserter?: string;
}

export class Web3Service {
    private provider: ethers.JsonRpcProvider;
    private predictionMarket: ethers.Contract;
    private usdc: ethers.Contract;

    constructor() {
        const network = getCurrentNetwork();
        this.provider = new ethers.JsonRpcProvider(network.rpcUrl);

        const contracts = getContracts() as any;

        // Use the unified multi-outcome contract
        const marketAddress = contracts.predictionMarketMulti || contracts.predictionMarket;
        this.predictionMarket = new ethers.Contract(
            marketAddress,
            PREDICTION_MARKET_MULTI_ABI,
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
     * Get all markets (now uses multi-outcome contract)
     */
    async getMarkets(): Promise<Market[]> {
        try {
            const count = Number(await this.predictionMarket.marketCount());
            const ids = Array.from({ length: count }, (_, i) => i);

            const markets: Market[] = [];

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
            console.error('Error fetching markets:', error);
            return [];
        }
    }

    /**
     * Get single market
     */
    async getMarket(marketId: number): Promise<Market | null> {
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

            // For binary (2-outcome) markets, provide legacy yesOdds/noOdds
            const isBinary = Number(basicInfo.outcomeCount) === 2;
            const yesOdds = isBinary ? pricesFormatted[0] : pricesFormatted[0];
            const noOdds = isBinary ? pricesFormatted[1] : 100 - pricesFormatted[0];

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
                // Legacy compatibility
                yesOdds: yesOdds,
                noOdds: noOdds,
                yesShares: sharesFormatted[0] || '0',
                noShares: sharesFormatted[1] || '0',
                yesPool: ethers.formatUnits(basicInfo.liquidityParam, 18),
                noPool: '0',
                outcome: basicInfo.resolved ? Number(basicInfo.winningOutcome) === 0 : undefined,
            };
        } catch (error) {
            console.error('Error fetching market:', error);
            return null;
        }
    }

    /**
     * Calculate cost to buy shares
     */
    async calculateCost(marketId: number, isYes: boolean, shares: number): Promise<string> {
        try {
            // Convert boolean isYes to outcomeIndex (0 = Yes, 1 = No for binary markets)
            const outcomeIndex = isYes ? 0 : 1;
            const sharesInUnits = ethers.parseUnits(shares.toString(), 6);
            const cost = await this.predictionMarket.calculateCost(marketId, outcomeIndex, sharesInUnits);
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
            const shares = position.shares || [];

            return {
                yesShares: shares[0] ? ethers.formatUnits(shares[0], 6) : '0',
                noShares: shares[1] ? ethers.formatUnits(shares[1], 6) : '0',
                claimed: position.claimed,
                allShares: shares.map((s: bigint) => ethers.formatUnits(s, 6)),
            };
        } catch (error) {
            console.error('Error fetching position:', error);
            return null;
        }
    }

    /**
     * Get USDC balance (wallet balance)
     */
    async getUSDCBalance(address: string): Promise<string> {
        try {
            const balance = await this.usdc.balanceOf(address);
            return ethers.formatUnits(balance, 6);
        } catch (error) {
            console.error('Error fetching USDC balance:', error);
            return '0';
        }
    }

    /**
     * Get deposited balance in the prediction market contract
     */
    async getDepositedBalance(address: string): Promise<string> {
        try {
            const balance = await this.predictionMarket.userBalances(address);
            return ethers.formatUnits(balance, 6);
        } catch (error: any) {
            console.error('Error fetching deposited balance:', error);
            return '0';
        }
    }
}

export const web3Service = new Web3Service();

export async function checkAndSwitchNetwork(ethereumProvider: any): Promise<boolean> {
    const network = getCurrentNetwork();
    const chainIdHex = '0x' + network.chainId.toString(16);

    try {
        const currentChainId = await ethereumProvider.request({ method: 'eth_chainId' });
        if (currentChainId === chainIdHex) return true;

        await ethereumProvider.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: chainIdHex }],
        });
        return true;
    } catch (switchError: any) {
        // This error code 4902 indicates that the chain has not been added to MetaMask.
        if (switchError.code === 4902) {
            try {
                await ethereumProvider.request({
                    method: 'wallet_addEthereumChain',
                    params: [
                        {
                            chainId: chainIdHex,
                            chainName: network.name,
                            rpcUrls: [network.rpcUrl],
                            nativeCurrency: {
                                name: 'BNB',
                                symbol: 'tBNB', // or BNB
                                decimals: 18,
                            },
                            blockExplorerUrls: ['https://testnet.bscscan.com'],
                        },
                    ],
                });
                return true;
            } catch (addError) {
                console.error('Failed to add network:', addError);
                return false;
            }
        }
        console.error('Failed to switch network:', switchError);
        return false;
    }
}
