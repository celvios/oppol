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

  static async getMarketsByCategory(category: string): Promise<Market[]> {
    const markets = await this.getActiveMarkets();
    return markets.filter(m => m.category_id === category || m.category === category);
  }

  static async getTrendingMarkets(): Promise<Market[]> {
    const markets = await this.getActiveMarkets();
    return markets
      .sort((a, b) => parseFloat(b.totalVolume || '0') - parseFloat(a.totalVolume || '0'))
      .slice(0, 10);
  }

  static async getEndingSoonMarkets(): Promise<Market[]> {
    const markets = await this.getActiveMarkets();
    const now = Date.now() / 1000;
    const in24h = now + 86400;
    return markets
      .filter(m => m.endTime > now && m.endTime < in24h)
      .sort((a, b) => a.endTime - b.endTime);
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
  ): Promise<{ success: boolean; transactionHash?: string; message?: string; shares?: number }> {
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
