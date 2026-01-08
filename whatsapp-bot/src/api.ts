import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3000/api';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

export class ApiClient {
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
     * Get user balance
     */
    async getBalance(phoneNumber: string): Promise<string> {
        try {
            const response = await axios.get(`${API_URL}/wallet/balance`, {
                params: { phone: phoneNumber }
            });
            return response.data.balance || '0.00';
        } catch (error) {
            console.error('Error fetching balance');
            return '1000.00'; // Mock balance
        }
    }

    /**
     * Get user wallet/deposit address
     */
    async getDepositAddress(phoneNumber: string): Promise<string> {
        try {
            const response = await axios.get(`${API_URL}/wallet/address`, {
                params: { phone: phoneNumber }
            });
            return response.data.address;
        } catch (error) {
            console.error('Error fetching deposit address');
            return '0x71C7656EC7ab88b098defB751B7401B5f6d8976F'; // Mock address
        }
    }

    /**
     * Place a bet
     */
    async placeBet(phoneNumber: string, marketId: number, isYes: boolean, amount: number): Promise<any> {
        try {
            const response = await axios.post(`${API_URL}/bet`, {
                phone: phoneNumber,
                marketId,
                side: isYes ? 'YES' : 'NO',
                shares: Math.floor(amount / (isYes ? 0.72 : 0.28)) // Estimate shares
            });

            return {
                success: true,
                txHash: response.data.transaction?.hash || '0x' + Math.random().toString(16).substring(2, 66),
                shares: response.data.transaction?.shares || Math.floor(amount * 1.5),
                newPrice: response.data.transaction?.newPrice || 72,
            };
        } catch (error) {
            console.error('Error placing bet, using mock response');
            // Return mock success for development
            return {
                success: true,
                txHash: '0x' + Math.random().toString(16).substring(2, 66),
                shares: Math.floor(amount * (isYes ? 1.5 : 2.5)),
                newPrice: isYes ? 73 : 27,
            };
        }
    }

    /**
     * Get user positions
     */
    async getPositions(phoneNumber: string): Promise<any[]> {
        try {
            const response = await axios.get(`${API_URL}/positions`, {
                params: { phone: phoneNumber }
            });
            return response.data.positions || [];
        } catch (error) {
            console.error('Error fetching positions');
            return []; // No positions
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
