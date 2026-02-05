import axios from 'axios';
import { Market, Position, UserData } from './types';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001/api';

export class API {
  static async getOrCreateUser(phoneNumber: string): Promise<UserData> {
    const { data } = await axios.post(`${API_BASE}/whatsapp/user`, { phone: phoneNumber });
    return data;
  }

  static async getUserBalance(phoneNumber: string): Promise<number> {
    const user = await this.getOrCreateUser(phoneNumber);
    const { data } = await axios.get(`${API_BASE}/balance/${user.user.wallet_address}`);
    return parseFloat(data.balances?.custodialWallet?.depositedInContract || '0');
  }

  static async getActiveMarkets(): Promise<Market[]> {
    const { data } = await axios.get(`${API_BASE}/markets`);
    return data.markets || [];
  }

  static async getMarket(marketId: number): Promise<Market | null> {
    try {
      const { data } = await axios.get(`${API_BASE}/markets/${marketId}`);
      return data.market;
    } catch {
      return null;
    }
  }

  static async placeBet(
    phoneNumber: string,
    marketId: number,
    outcomeIndex: number,
    amount: number
  ): Promise<{ success: boolean; transactionHash?: string; message?: string }> {
    const user = await this.getOrCreateUser(phoneNumber);
    const { data } = await axios.post(`${API_BASE}/bet`, {
      walletAddress: user.user.wallet_address,
      marketId,
      outcomeIndex,
      amount
    });
    return data;
  }

  static async withdraw(
    phoneNumber: string,
    toAddress: string,
    amount: number
  ): Promise<{ success: boolean; transactionHash?: string; message?: string }> {
    const user = await this.getOrCreateUser(phoneNumber);
    const { data } = await axios.post(`${API_BASE}/telegram/withdraw`, {
      telegramId: phoneNumber,
      toAddress,
      amount
    });
    return data;
  }

  static async getUserPositions(phoneNumber: string): Promise<Position[]> {
    const user = await this.getOrCreateUser(phoneNumber);
    const { data } = await axios.get(`${API_BASE}/telegram/positions/${phoneNumber}`);
    return data.positions || [];
  }
}
