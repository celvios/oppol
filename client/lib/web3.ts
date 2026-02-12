import { ethers } from 'ethers';
import { getContracts, getCurrentNetwork } from './contracts';

// ABI for PredictionMarketMulti - Unified contract for all markets
const PREDICTION_MARKET_MULTI_ABI = [
    'function marketCount() view returns (uint256)',
    'function getMarketBasicInfo(uint256 marketId) view returns (string question, string image, string description, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome)',
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
    // Metadata from database (via API)
    image_url?: string;
    description?: string;
    category_id?: string;
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
    private predictionMarket: ethers.Contract | null = null;
    private usdc: ethers.Contract | null = null;

    constructor() {
        const network = getCurrentNetwork();
        this.provider = new ethers.JsonRpcProvider(network.rpcUrl);

        const contracts = getContracts() as any;

        // Use the unified multi-outcome contract with fallback to env var
        const marketAddress = contracts.predictionMarketMulti
            || contracts.predictionMarket
            || process.env.NEXT_PUBLIC_MARKET_ADDRESS;

        console.log('[Web3Service] Initializing with market address:', marketAddress);

        if (marketAddress && marketAddress !== "") {
            try {
                this.predictionMarket = new ethers.Contract(
                    marketAddress,
                    PREDICTION_MARKET_MULTI_ABI,
                    this.provider
                );
                console.log('[Web3Service] Market contract initialized successfully');
            } catch (e) {
                console.error('[Web3Service] Failed to instantiate Market Contract:', e);
            }
        } else {
            console.error('[Web3Service] Missing Market Contract Address - balance queries will fail!');
        }

        const usdcAddress = contracts.mockUSDC || contracts.usdc;
        if (usdcAddress && usdcAddress !== "") {
            try {
                this.usdc = new ethers.Contract(
                    usdcAddress,
                    USDC_ABI,
                    this.provider
                );
            } catch (e) {
                console.error('[Web3Service] Failed to instantiate USDC Contract:', e);
            }
        }
    }

    /**
     * Get all markets - ALWAYS fetches from API to ensure metadata is included
     */
    async getMarkets(): Promise<Market[]> {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        if (!apiUrl) {
            console.error('[Web3Service] NEXT_PUBLIC_API_URL is not set. Cannot fetch markets with metadata.');
            throw new Error('API URL not configured');
        }

        try {
            const response = await fetch(`${apiUrl}/api/markets`);
            if (!response.ok) {
                throw new Error(`API returned ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'API returned unsuccessful response');
            }

            if (!data.markets || data.markets.length === 0) {
                console.warn('[Web3Service] API returned no markets');
                return [];
            }

            // Map API response to Market interface - API is the source of truth
            return data.markets.map((m: any) => ({
                id: m.market_id !== undefined ? m.market_id : m.id,
                question: m.question,
                outcomes: m.outcomes || [],
                outcomeCount: m.outcomeCount || m.outcomes?.length || 2,
                shares: [], // API doesn't provide shares, will be empty
                prices: m.prices || [],
                endTime: m.endTime,
                liquidityParam: m.liquidityParam || '0',
                totalVolume: m.totalVolume || '0',
                resolved: m.resolved || false,
                winningOutcome: m.winningOutcome || 0,
                // Metadata from API - REQUIRED
                image_url: m.image_url || '',
                description: m.description || '',
                category_id: m.category_id || '',
                // Legacy compatibility
                yesOdds: m.prices?.[0] || 50,
                noOdds: m.prices?.[1] || (100 - (m.prices?.[0] || 50)),
                yesShares: '0',
                noShares: '0',
                yesPool: m.liquidityParam || '0',
                noPool: '0',
                outcome: m.resolved ? Number(m.winningOutcome) === 0 : undefined,
            }));
        } catch (error: any) {
            console.error('[Web3Service] Failed to fetch markets from API:', error);
            throw new Error(`Failed to fetch markets: ${error.message || 'Unknown error'}`);
        }
    }

    /**
     * Get single market
     */
    async getMarket(marketId: number): Promise<Market | null> {
        const pm = this.predictionMarket;
        if (!pm) return null;
        try {
            const [basicInfo, outcomes, shares, prices] = await Promise.all([
                pm.getMarketBasicInfo(marketId),
                pm.getMarketOutcomes(marketId),
                pm.getMarketShares(marketId),
                pm.getAllPrices(marketId),
            ]);

            const sharesFormatted = shares.map((s: bigint) => ethers.formatUnits(s, 18));
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
        if (!this.predictionMarket) return '0';
        try {
            // Convert boolean isYes to outcomeIndex (0 = Yes, 1 = No for binary markets)
            const outcomeIndex = isYes ? 0 : 1;
            const sharesInUnits = ethers.parseUnits(shares.toString(), 18);
            const cost = await this.predictionMarket.calculateCost(marketId, outcomeIndex, sharesInUnits);

            // Add 5% Protocol Fee Buffer
            // We calculate fee manually here to match contract: fee = cost * 500 / 10000
            const fee = (cost * BigInt(500)) / BigInt(10000);
            const totalCost = cost + fee;

            return ethers.formatUnits(totalCost, 18);
        } catch (error) {
            console.error('Error calculating cost:', error);
            return '0';
        }
    }

    /**
     * Get user position
     */
    async getUserPosition(marketId: number, userAddress: string) {
        const pm = this.predictionMarket;
        if (!pm) return null;
        try {
            const position = await pm.getUserPosition(marketId, userAddress);
            const shares = position.shares || [];

            return {
                yesShares: shares[0] ? ethers.formatUnits(shares[0], 18) : '0',
                noShares: shares[1] ? ethers.formatUnits(shares[1], 18) : '0',
                claimed: position.claimed,
                allShares: shares.map((s: bigint) => ethers.formatUnits(s, 18)),
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
        const usdc = this.usdc;
        if (!usdc) return '0';
        try {
            const balance = await usdc.balanceOf(address);
            return ethers.formatUnits(balance, 18);
        } catch (error) {
            console.error('Error fetching USDC balance:', error);
            return '0';
        }
    }

    /**
     * Get deposited balance in the prediction market contract
     */
    async getDepositedBalance(address: string): Promise<string> {
        const pm = this.predictionMarket;
        if (!pm) return '0';
        try {
            const balance = await pm.userBalances(address);
            // IMPORTANT: Using 18 decimals because users deposited USDT (18 decimals)
            // Even though contract expects USDC (6 decimals), the actual deposits are USDT
            return ethers.formatUnits(balance, 18);
        } catch (error: any) {
            console.error('Error fetching deposited balance:', error);
            return '0';
        }
    }

    /**
     * Claim winnings for a resolved market
     */
    async claimWinnings(marketId: number): Promise<string> {
        if (!this.predictionMarket) throw new Error('Market contract not initialized');

        console.log(`[Web3Service] Claiming winnings for market ${marketId}...`);

        try {
            // Get signer from browser wallet
            const browserProvider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await browserProvider.getSigner();

            // Connect contract with signer
            const contractWithSigner = this.predictionMarket.connect(signer) as ethers.Contract;

            // Send transaction
            const tx = await contractWithSigner.claimWinnings(marketId);
            console.log(`[Web3Service] Claim TX sent: ${tx.hash}`);

            const receipt = await tx.wait();
            console.log(`[Web3Service] Claim TX confirmed: ${receipt.hash}`);

            return receipt.hash;
        } catch (error: any) {
            console.error('[Web3Service] Claim failed:', error);
            throw error;
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
