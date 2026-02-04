import axios from 'axios';
import dotenv from 'dotenv';
dotenv.config();

const API_URL = process.env.API_URL || 'http://localhost:3001';

export interface Market {
    market_id: number;
    question: string;
    description: string;
    outcomes?: string[];
    prices?: number[];
    outcomeCount?: number;
    endTime?: number;
    totalVolume?: string;
    resolved?: boolean;
    winningOutcome?: number;
}

export interface Position {
    marketId: number;
    question: string;
    outcome: number;
    outcomeName: string;
    shares: number;
    totalInvested: number;
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
            return data.success ? data.markets : [];
        } catch (error: any) {
            console.error('Failed to fetch markets:', error.message);
            throw error;
        }
    }

    static async getMarket(id: number): Promise<Market | null> {
        try {
            const { data } = await axios.get(`${API_URL}/api/markets/${id}?t=${Date.now()}`);
            return data.success ? data.market : null;
        } catch (error: any) {
            console.error('Failed to fetch market:', error.message);
            throw error;
        }
    }

    static async placeBet(phone: string, marketId: number, outcome: number, amount: number): Promise<BetResponse> {
        try {
            const { data } = await axios.post(`${API_URL}/api/whatsapp/bet`, {
                phone,
                marketId,
                outcome,
                amount
            });
            return data;
        } catch (error: any) {
            console.error('Failed to place bet:', error.message);
            const apiMessage = error.response?.data?.error || error.response?.data?.message;
            if (apiMessage) {
                throw new Error(apiMessage);
            }
            throw error;
        }
    }

    static async getOrCreateUser(phone: string, username?: string): Promise<any> {
        try {
            const { data } = await axios.post(`${API_URL}/api/whatsapp/user`, {
                phone,
                username
            });
            return data;
        } catch (error: any) {
            console.error('Failed to get/create user:', error.message);
            throw error;
        }
    }

    static async getUserBalance(phone: string): Promise<number> {
        try {
            // Encode phone properly as it may contain +
            const encodedPhone = encodeURIComponent(phone);
            const { data } = await axios.get(`${API_URL}/api/whatsapp/balance/${encodedPhone}`);
            return data.balance || 0;
        } catch (error: any) {
            console.error('Failed to get balance:', error.message);
            return 0;
        }
    }

    static async getUserPositions(phone: string): Promise<Position[]> {
        try {
            const encodedPhone = encodeURIComponent(phone);
            const { data } = await axios.get(`${API_URL}/api/whatsapp/positions/${encodedPhone}`);
            return data.success ? data.positions : [];
        } catch (error: any) {
            console.error('Failed to get positions:', error.message);
            return [];
        }
    }

    static async withdraw(phone: string, toAddress: string, amount: number): Promise<BetResponse> {
        try {
            const { data } = await axios.post(`${API_URL}/api/whatsapp/withdraw`, {
                phone,
                toAddress,
                amount
            });
            return data;
        } catch (error: any) {
            console.error('Failed to withdraw:', error.message);
            const apiMessage = error.response?.data?.error || error.response?.data?.message;
            if (apiMessage) throw new Error(apiMessage);
            throw error;
        }
    }
}
