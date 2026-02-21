
import { ethers } from 'ethers';
import { CONFIG } from '../config/contracts';

// Chainlink BNB/USD Aggregator on BSC Mainnet
const BNB_USD_FEED = '0x0567F2323251f0Aab15c8dFb1967E4e8A7D42aeE';

export class GasService {
    private provider: ethers.JsonRpcProvider;

    constructor() {
        const rpcUrl = CONFIG.RPC_URL || 'https://bsc-dataseed.binance.org';
        this.provider = new ethers.JsonRpcProvider(rpcUrl);
    }

    /**
     * Get current BNB Price in USD (from Chainlink or fallback API)
     */
    async getBNBPrice(): Promise<number> {
        try {
            // Try Chainlink Feed first (Reliable, On-chain)
            const aggregatorV3InterfaceABI = [
                {
                    inputs: [],
                    name: "latestRoundData",
                    outputs: [
                        { name: "roundId", type: "uint80" },
                        { name: "answer", type: "int256" },
                        { name: "startedAt", type: "uint256" },
                        { name: "updatedAt", type: "uint256" },
                        { name: "answeredInRound", type: "uint80" }
                    ],
                    stateMutability: "view",
                    type: "function"
                }
            ];
            const priceFeed = new ethers.Contract(BNB_USD_FEED, aggregatorV3InterfaceABI, this.provider);
            const roundData = await priceFeed.latestRoundData();
            // Chainlink updates are 8 decimals for USD pairs
            const price = Number(ethers.formatUnits(roundData.answer, 8));
            return price;

        } catch (error) {
            console.warn('Chainlink Feed Failed, using fallback price $600', error);
            // Fallback (or fetch from CoinGecko API if critical)
            return 600;
        }
    }

    /**
     * Estimate transaction cost in USDC
     * @param gasLimit Expected gas limit for the tx
     * @returns Cost in USDC (6 decimals bigint)
     */
    async estimateGasCostInUSDC(gasLimit: bigint): Promise<bigint> {
        try {
            const feeData = await this.provider.getFeeData();
            const gasPrice = feeData.gasPrice || ethers.parseUnits("3", "gwei"); // Fallback 3 gwei
            const bnbPrice = await this.getBNBPrice();

            // Cost in BNB (Wei)
            const costBNBWei = gasLimit * gasPrice;

            // Convert to BNB (Float)
            const costBNB = parseFloat(ethers.formatEther(costBNBWei));

            // Cost in USD
            const costUSD = costBNB * bnbPrice;

            // Add Safety Margin (10%?)
            const costUSDSafe = costUSD * 1.1;

            // Convert to USDC (18 decimals for BSC)
            // e.g. $0.50 -> 500000000000000000
            const amountUSDC = ethers.parseUnits(costUSDSafe.toFixed(18), 18);

            console.log(`[GasService] Est. Cost: ${gasLimit} gas @ ${ethers.formatUnits(gasPrice, "gwei")} gwei`);
            console.log(`[GasService] BNB Price: $${bnbPrice}, Total: $${costUSDSafe.toFixed(4)}`);

            return amountUSDC;

        } catch (error) {
            console.error('Gas estimation failed:', error);
            // Fallback: Return generous estimate ($0.10) to be safe
            // 0.10 USDC in 18 decimals
            return ethers.parseUnits("0.1", 18);
        }
    }
}

export const gasService = new GasService();
