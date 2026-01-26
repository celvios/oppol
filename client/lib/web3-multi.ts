import { ethers } from 'ethers';
import { getMultiContracts, PREDICTION_MARKET_MULTI_ABI } from './contracts-multi';
import { getCurrentNetwork } from './contracts';

export interface MultiMarket {
    id: number;
    question: string;
    image_url?: string;     // API metadata field (primary)
    description?: string;   // API metadata field
    category_id?: string;  // API metadata field
    outcomes: string[];
    outcomeCount: number;
    shares: string[];
    prices: number[];  // 0-100 for each outcome
    endTime: number;
    liquidityParam: string;
    totalVolume: string;
    resolved: boolean;
    winningOutcome: number;
    assertionPending?: boolean;
    assertedOutcome?: number;
    asserter?: string;
    // Legacy fields for backward compatibility
    image?: string;          // Alias for image_url
    yesOdds?: number;
    noOdds?: number;
    yesShares?: string;
    noShares?: string;
    yesPool?: string;
    noPool?: string;
    outcome?: boolean; // true if YES won, false if NO won (for binary)
    // Boost fields
    isBoosted?: boolean;
    boost_expires_at?: number;
    boost_tier?: number;
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
    private predictionMarket: ethers.Contract | null = null;
    private usdc: ethers.Contract | null = null;

    // Client-side cache to prevent duplicate API calls and speed up navigation
    private marketsCache: { data: MultiMarket[], timestamp: number } | null = null;
    private readonly CACHE_TTL = 60000; // 60 seconds - survives page navigation
    private readonly STALE_TTL = 300000; // 5 minutes - show stale data while revalidating
    private readonly STORAGE_KEY = 'opoll_markets_cache';
    private isRevalidating = false; // Prevent multiple simultaneous background fetches
    private updateListeners: Set<(markets: MultiMarket[]) => void> = new Set();

    constructor() {
        // Restore cache from localStorage on init (survives page navigations)
        this.restoreCacheFromStorage();
        const network = getCurrentNetwork();
        this.provider = new ethers.JsonRpcProvider(network.rpcUrl);

        const contracts = getMultiContracts();
        const marketAddress = contracts.predictionMarketMulti;


        // Only instantiate if address is present and valid
        if (contracts.predictionMarketMulti && contracts.predictionMarketMulti !== "") {
            try {
                this.predictionMarket = new ethers.Contract(
                    contracts.predictionMarketMulti,
                    PREDICTION_MARKET_MULTI_ABI,
                    this.provider
                );
            } catch (e) {
                console.error('[Web3Multi] Failed to instantiate Market Contract:', e);
            }
        } else {
            console.warn('[Web3Multi] Missing Market Contract Address - Service execution will be limited');
        }

        const usdcAddress = (contracts as any).mockUSDC || (contracts as any).usdc;
        if (usdcAddress && usdcAddress !== "") {
            try {
                this.usdc = new ethers.Contract(
                    usdcAddress,
                    USDC_ABI,
                    this.provider
                );
            } catch (e) {
                console.error('[Web3Multi] Failed to instantiate USDC Contract:', e);
            }
        }
    }

    /**
     * Restore cache from localStorage (survives page navigations)
     */
    private restoreCacheFromStorage(): void {
        if (typeof window === 'undefined') return; // SSR check
        try {
            const stored = localStorage.getItem(this.STORAGE_KEY);
            if (stored) {
                const parsed = JSON.parse(stored);
                // Only restore if not expired
                if (Date.now() - parsed.timestamp < this.CACHE_TTL) {
                    this.marketsCache = parsed;
                    console.log('[Web3MultiService] Restored markets from localStorage cache');
                }
            }
        } catch (e) {
            // Ignore localStorage errors
        }
    }

    /**
     * Save cache to localStorage
     */
    private saveCacheToStorage(): void {
        if (typeof window === 'undefined') return; // SSR check
        try {
            if (this.marketsCache) {
                localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.marketsCache));
            }
        } catch (e) {
            // Ignore localStorage errors (quota exceeded, etc)
        }
    }

    /**
     * Seed cache with server-fetched data (for SSR - instant load!)
     */
    seedCache(markets: MultiMarket[]): void {
        if (markets.length > 0) {
            this.marketsCache = { data: markets, timestamp: Date.now() };
            this.saveCacheToStorage();
            console.log('[Web3MultiService] Cache seeded with server data');
        }
    }

    /**
     * Subscribe to market updates (for components that want real-time data)
     */
    onMarketsUpdate(callback: (markets: MultiMarket[]) => void): () => void {
        this.updateListeners.add(callback);
        return () => this.updateListeners.delete(callback);
    }

    /**
     * Notify all listeners of market updates
     */
    private notifyListeners(markets: MultiMarket[]): void {
        this.updateListeners.forEach(cb => cb(markets));
    }

    /**
     * Background revalidation - fetches fresh data without blocking UI
     */
    private async revalidateInBackground(): Promise<void> {
        if (this.isRevalidating) return; // Already revalidating
        this.isRevalidating = true;

        console.log('[Web3MultiService] Background revalidation started...');
        try {
            const freshMarkets = await this.fetchMarketsFromAPI();
            if (freshMarkets.length > 0) {
                this.marketsCache = { data: freshMarkets, timestamp: Date.now() };
                this.saveCacheToStorage();
                this.notifyListeners(freshMarkets);
                console.log('[Web3MultiService] Background revalidation complete - cache updated');
            }
        } catch (e) {
            console.error('[Web3MultiService] Background revalidation failed:', e);
        } finally {
            this.isRevalidating = false;
        }
    }

    /**
     * Get all multi-outcome markets - Stale-While-Revalidate pattern
     * Returns cached data instantly, refreshes in background if stale
     */
    async getMarkets(): Promise<MultiMarket[]> {
        const now = Date.now();

        // If cache exists and is within stale TTL, return it immediately
        if (this.marketsCache && (now - this.marketsCache.timestamp) < this.STALE_TTL) {
            const isFresh = (now - this.marketsCache.timestamp) < this.CACHE_TTL;

            if (isFresh) {
                console.log('[Web3MultiService] Returning fresh cached data');
            } else {
                console.log('[Web3MultiService] Returning stale data, revalidating in background...');
                // Trigger background refresh (non-blocking)
                this.revalidateInBackground();
            }

            return this.marketsCache.data;
        }

        // Cache is too old or doesn't exist - must fetch fresh
        console.log('[Web3MultiService] Cache expired or empty, fetching fresh data...');
        const markets = await this.fetchMarketsFromAPI();
        this.marketsCache = { data: markets, timestamp: Date.now() };
        this.saveCacheToStorage();
        return markets;
    }

    /**
     * Fetch markets from API (internal method)
     */
    private async fetchMarketsFromAPI(): Promise<MultiMarket[]> {
        const apiUrl = process.env.NEXT_PUBLIC_API_URL;
        if (!apiUrl) {
            console.error('[Web3MultiService] NEXT_PUBLIC_API_URL is not set.');
            return this.getMarketsFromContract();
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
                console.warn('[Web3MultiService] API returned no markets - forcing contract fallback');
                throw new Error('API returned no markets');
            }

            // Map API response to MultiMarket interface
            return data.markets.map((m: any) => ({
                id: m.market_id !== undefined ? m.market_id : m.id,
                question: m.question,
                image_url: m.image_url || '',
                description: m.description || '',
                category_id: m.category_id || '',
                outcomes: (typeof m.outcomes === 'string' ? JSON.parse(m.outcomes) : m.outcomes) || [],
                outcomeCount: m.outcomeCount || (typeof m.outcomes === 'string' ? JSON.parse(m.outcomes).length : m.outcomes?.length) || 2,
                shares: [],
                prices: m.prices || [],
                endTime: m.endTime,
                liquidityParam: m.liquidityParam || '0',
                totalVolume: m.totalVolume || '0',
                resolved: m.resolved || false,
                winningOutcome: m.winningOutcome || 0,
                // Boost fields
                isBoosted: m.is_boosted || false,
                boost_tier: m.boost_tier,
                boost_expires_at: m.boost_expires_at,
                image: m.image_url || '',
            }));
        } catch (error: any) {
            console.error('[Web3MultiService] Error fetching markets from API:', error);
            return this.getMarketsFromContract();
        }
    }

    /**
     * Fallback: Get markets directly from contract in PARALLEL
     */
    private async getMarketsFromContract(): Promise<MultiMarket[]> {
        if (!this.predictionMarket) return [];
        try {
            const count = Number(await this.predictionMarket.marketCount());
            const ids = Array.from({ length: count }, (_, i) => i);

            // PARALLEL fetch all markets at once
            const marketPromises = ids.map(id =>
                this.getMarket(id).catch(e => {
                    console.error(`Error fetching market ${id}:`, e);
                    return null;
                })
            );

            const results = await Promise.all(marketPromises);
            return results.filter((m): m is MultiMarket => m !== null);
        } catch (error) {
            console.error('Error fetching multi-markets from contract:', error);
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

            const sharesFormatted = shares.map((s: bigint) => ethers.formatUnits(s, 18));
            const pricesFormatted = prices.map((p: bigint) => Number(p) / 100); // Convert basis points to percentage

            const totalVolume = sharesFormatted.reduce((sum: number, s: string) => sum + parseFloat(s), 0);

            // Legacy binary odds calculation
            const yesPrice = pricesFormatted[0] || 50;
            const noPrice = pricesFormatted[1] || 50;

            return {
                id: marketId,
                question: basicInfo.question,
                image_url: basicInfo.image || '', // Map from contract
                description: basicInfo.description || '', // Map from contract
                category_id: '',
                outcomes: outcomes,
                outcomeCount: Number(basicInfo.outcomeCount),
                shares: sharesFormatted,
                prices: pricesFormatted,
                endTime: Number(basicInfo.endTime),
                liquidityParam: ethers.formatUnits(basicInfo.liquidityParam, 18),
                totalVolume: totalVolume.toFixed(2),
                resolved: basicInfo.resolved,
                winningOutcome: Number(basicInfo.winningOutcome),
                assertionPending: basicInfo.assertionPending || false,
                assertedOutcome: Number(basicInfo.assertedOutcome || 0),
                asserter: basicInfo.asserter || ethers.ZeroAddress,
                // Legacy compatibility
                image: basicInfo.image || '',
                yesOdds: yesPrice,
                noOdds: noPrice,
                yesShares: sharesFormatted[0] || '0',
                noShares: sharesFormatted[1] || '0',
                yesPool: ethers.formatUnits(basicInfo.liquidityParam, 18),
                noPool: '0',
                outcome: basicInfo.resolved ? Number(basicInfo.winningOutcome) === 0 : undefined,
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
            const sharesInUnits = ethers.parseUnits(shares.toString(), 18);
            const cost = await this.predictionMarket.calculateCost(marketId, outcomeIndex, sharesInUnits);
            return ethers.formatUnits(cost, 18);
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
                shares: position.shares.map((s: bigint) => ethers.formatUnits(s, 18)),
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
            return ethers.formatUnits(balance, 18);
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
            return ethers.formatUnits(balance, 18);
        } catch (error) {
            console.error('Error fetching USDC balance:', error);
            return '0';
        }
    }
}

export const web3MultiService = new Web3MultiService();
