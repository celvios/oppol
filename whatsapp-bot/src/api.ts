import axios from 'axios';
import { Market, Position, UserData } from './types';

const API_BASE = process.env.API_BASE_URL || 'http://localhost:3001/api';

export class API {
  static async getOrCreateUser(phoneNumber: string): Promise<UserData> {
    const url = `${API_BASE}/whatsapp/user`;
    console.log(`[API] POST ${url}`, { phone: phoneNumber });
    try {
      const { data } = await axios.post(url, { phone: phoneNumber });
      console.log(`[API] ✅ User data received:`, data);
      return data;
    } catch (error: any) {
      console.error(`[API] ❌ Failed to get/create user:`);
      console.error(`  URL: ${url}`);
      console.error(`  Status: ${error.response?.status}`);
      console.error(`  Error: ${error.message}`);
      console.error(`  Response:`, error.response?.data);
      throw error;
    }
  }

  static async getUserBalance(phoneNumber: string): Promise<number> {
    try {
      const user = await this.getOrCreateUser(phoneNumber);
      const url = `${API_BASE}/balance/${user.user.wallet_address}`;
      console.log(`[API] GET ${url}`);
      const { data } = await axios.get(url);
      const balance = parseFloat(data.balances?.custodialWallet?.depositedInContract || '0');
      console.log(`[API] ✅ Balance: $${balance}`);
      return balance;
    } catch (error: any) {
      console.error(`[API] ❌ Failed to get balance:`);
      console.error(`  Error: ${error.message}`);
      console.error(`  Status: ${error.response?.status}`);
      throw error;
    }
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
    const url = `${API_BASE}/whatsapp/withdraw`;
    const payload = { phone: phoneNumber, toAddress, amount };
    console.log(`[API] POST ${url}`, payload);
    try {
      const { data } = await axios.post(url, payload);
      console.log(`[API] ✅ Withdrawal successful:`, data);
      return data;
    } catch (error: any) {
      console.error(`[API] ❌ Failed to withdraw:`);
      console.error(`  URL: ${url}`);
      console.error(`  Status: ${error.response?.status}`);
      console.error(`  Error: ${error.message}`);
      console.error(`  Response:`, error.response?.data);
      throw error;
    }
  }

  static async getUserPositions(phoneNumber: string): Promise<Position[]> {
    const url = `${API_BASE}/whatsapp/positions/${phoneNumber}`;
    console.log(`[API] GET ${url}`);
    try {
      const { data } = await axios.get(url);
      console.log(`[API] ✅ Positions received:`, data.positions?.length || 0, 'positions');
      return data.positions || [];
    } catch (error: any) {
      console.error(`[API] ❌ Failed to get positions:`);
      console.error(`  URL: ${url}`);
      console.error(`  Status: ${error.response?.status}`);
      console.error(`  Error: ${error.message}`);
      console.error(`  Response:`, error.response?.data);
      throw error;
    }
  }
}
