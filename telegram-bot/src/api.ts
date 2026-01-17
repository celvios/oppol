import axios from 'axios';

const API_URL = process.env.API_URL || 'http://localhost:3001';

export interface Market {
    market_id: number;
    question: string;
    description: string;
    image_url?: string;
    category_id?: string;
    outcomes?: string[];
    prices?: number[];
    outcomeCount?: number;
    endTime?: number;
    liquidityParam?: string;
    resolved?: boolean;
    winningOutcome?: number;
}

export interface BetResponse {
    success: boolean;
    transactionHash?: string;
    message?: string;
}

export class API {
    static async getActiveMarkets(): Promise<Market[]> {
        try {
            const { data } = await axios.get(`${API_URL}/api/markets?t=${Date.now()}`);
            console.log('Markets response:', data);
            return data.success ? data.markets : [];
        } catch (error: any) {
            console.error('Failed to fetch markets:', error.message);
            throw error;
        }
    }

    static async getMarket(id: number): Promise<Market | null> {
        try {
            const { data } = await axios.get(`${API_URL}/api/markets/${id}?t=${Date.now()}`);
            console.log('Market response:', data);
            return data.success ? data.market : null;
        } catch (error: any) {
            console.error('Failed to fetch market:', error.message);
            throw error;
        }
    }

    static async placeBet(telegramId: number, marketId: number, outcome: number, amount: number): Promise<BetResponse> {
        try {
            const { data } = await axios.post(`${API_URL}/api/telegram/bet`, {
                telegramId,
                marketId,
                outcome,
                amount
            });
            console.log('Bet response:', data);
            return data;
        } catch (error: any) {
            console.error('Failed to place bet:', error.message);
            // Extract the error message from the API response if available
            const apiMessage = error.response?.data?.message;
            if (apiMessage) {
                throw new Error(apiMessage);
            }
            throw error;
        }
    }

    static async getOrCreateUser(telegramId: number, username?: string): Promise<any> {
        try {
            const { data } = await axios.post(`${API_URL}/api/telegram/user`, {
                telegramId,
                username
            });
            return data;
        } catch (error: any) {
            console.error('Failed to get/create user:', error.message);
            throw error;
        }
    }

    static async getUserBalance(telegramId: number): Promise<number> {
        try {
            const { data } = await axios.get(`${API_URL}/api/telegram/balance/${telegramId}`);
            return data.balance || 0;
        } catch (error: any) {
            console.error('Failed to get balance:', error.message);
            return 0;
        }
    }

    static async withdraw(telegramId: number, toAddress: string, amount: number): Promise<BetResponse> {
        try {
            const { data } = await axios.post(`${API_URL}/api/telegram/withdraw`, {
                telegramId,
                toAddress,
                amount
            });
            console.log('Withdraw response:', data);
            return data;
        } catch (error: any) {
            console.error('Failed to withdraw:', error.message);
            throw error;
        }
    }
}
