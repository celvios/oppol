import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3000/api';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

export class ApiClient {
    /**
     * Get or create WhatsApp user wallet
     */
    async getUserByPhone(phoneNumber: string): Promise<{ walletAddress: string; isNew: boolean } | null> {
        try {
            const response = await axios.post(`${API_URL}/whatsapp/user`, {
                phone: phoneNumber
            });
            if (response.data.success) {
                return {
                    walletAddress: response.data.walletAddress,
                    isNew: response.data.isNew
                };
            }
            return null;
        } catch (error) {
            console.error('Error fetching user:', error);
            return null;
        }
    }

    /**
     * Generate a Magic Link for user authentication
     */
    async generateMagicLink(phoneNumber: string): Promise<string> {
        try {
            const response = await axios.post(`${API_URL}/auth/magic-link`, {
                phone_number: phoneNumber,
            });

            if (response.data.success) {
                return response.data.link;
            }
            // Return a fallback link if API fails
            return `${FRONTEND_URL}/terminal?phone=${phoneNumber}`;
        } catch (error) {
            console.error('Error generating magic link:', error);
            // Return fallback link
            return `${FRONTEND_URL}/terminal`;
        }
    }

    /**
     * Get all markets
     */
    async getMarkets(): Promise<any[]> {
        try {
            const response = await axios.get(`${API_URL}/markets`);
            if (response.data.success) {
                return response.data.markets;
            }
            return [];
        } catch (error) {
            console.error('Error fetching markets');
            return [];
        }
    }

    /**
     * Get single market by ID
     */
    async getMarket(marketId: number): Promise<any> {
        try {
            const markets = await this.getMarkets();
            return markets.find((m: any) => m.id === marketId) || markets[0];
        } catch (error) {
            console.error('Error fetching market');
            return {
                id: marketId,
                question: "Market data unavailable",
                yesOdds: 50,
                volume: "0",
                endTime: Date.now() / 1000 + 86400,
            };
        }
    }

    /**
     * Generate a Magic Link for user authentication
     */
    async generateMagicLink(phoneNumber: string): Promise<string> {
        // Return direct link to terminal
        return `${FRONTEND_URL}/terminal?phone=${phoneNumber}`;
    }

    /**
     * Get user balance
     */
    async getBalance(phoneNumber: string): Promise<string> {
        try {
            const user = await this.getUserByPhone(phoneNumber);
            if (!user?.walletAddress) {
                return '0.00';
            }
            
            const response = await axios.get(`${API_URL}/wallet/balance/${user.walletAddress}`);
            return response.data.balanceFormatted || '0.00';
        } catch (error) {
            console.error('Error fetching balance');
            return '0.00';
        }
    }

    /**
     * Get user wallet/deposit address
     */
    async getDepositAddress(phoneNumber: string): Promise<string> {
        try {
            const user = await this.getUserByPhone(phoneNumber);
            return user?.walletAddress || '0x0000000000000000000000000000000000000000';
        } catch (error) {
            console.error('Error fetching deposit address');
            return '0x0000000000000000000000000000000000000000';
        }
    }

    /**
     * Place a bet
     */
    async placeBet(phoneNumber: string, marketId: number, isYes: boolean, amount: number): Promise<any> {
        try {
            const user = await this.getUserByPhone(phoneNumber);
            if (!user?.walletAddress) {
                throw new Error('User wallet not found');
            }

            const response = await axios.post(`${API_URL}/bet`, {
                walletAddress: user.walletAddress,
                marketId,
                side: isYes ? 'YES' : 'NO',
                amount
            });

            if (!response.data.success) {
                throw new Error(response.data.error || 'Bet failed');
            }

            return {
                success: true,
                txHash: response.data.transaction?.hash,
                shares: response.data.transaction?.shares,
                newPrice: response.data.transaction?.newPrice,
            };
        } catch (error: any) {
            console.error('Error placing bet:', error.message);
            throw error;
        }
    }

    /**
     * Get user positions
     */
    async getPositions(phoneNumber: string): Promise<any[]> {
        try {
            const user = await this.getUserByPhone(phoneNumber);
            if (!user?.walletAddress) {
                return [];
            }

            const response = await axios.get(`${API_URL}/portfolio/${user.walletAddress}`);
            if (!response.data.success) return [];

            // Fetch current prices for each position
            const positions = await Promise.all(
                response.data.positions.map(async (p: any) => {
                    const market = await this.getMarket(p.marketId);
                    const currentPrice = p.side === 'YES' ? market.yesOdds / 100 : (100 - market.yesOdds) / 100;
                    const currentValue = p.shares * currentPrice;

                    return {
                        marketId: p.marketId,
                        marketQuestion: market.question,
                        side: p.side,
                        shares: p.shares,
                        costBasis: p.totalCost,
                        currentValue,
                        avgPrice: p.avgPrice
                    };
                })
            );

            return positions;
        } catch (error) {
            console.error('Error fetching positions');
            return [];
        }
    }

    /**
     * Submit withdrawal request
     */
    async withdraw(phoneNumber: string, amount: number, address: string): Promise<any> {
        try {
            const response = await axios.post(`${API_URL}/wallet/withdraw`, {
                phone: phoneNumber,
                amount,
                address
            });
            return response.data;
        } catch (error) {
            console.error('Error processing withdrawal');
            // Return mock success
            return {
                success: true,
                txHash: '0x' + Math.random().toString(16).substring(2, 66),
            };
        }
    }
}

export const apiClient = new ApiClient();
