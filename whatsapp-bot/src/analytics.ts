import { BotStats } from './types';

class Analytics {
  private stats: BotStats = {
    totalUsers: 0,
    activeUsers24h: 0,
    totalBets: 0,
    totalVolume: 0,
    messagesProcessed: 0
  };

  private activeUsers: Set<string> = new Set();
  private lastReset: number = Date.now();

  trackMessage(phoneNumber: string): void {
    this.stats.messagesProcessed++;
    this.activeUsers.add(phoneNumber);
    this.resetDaily();
  }

  trackUser(phoneNumber: string, isNew: boolean): void {
    if (isNew) {
      this.stats.totalUsers++;
    }
    this.activeUsers.add(phoneNumber);
  }

  trackBet(amount: number): void {
    this.stats.totalBets++;
    this.stats.totalVolume += amount;
  }

  getStats(): BotStats {
    return {
      ...this.stats,
      activeUsers24h: this.activeUsers.size
    };
  }

  private resetDaily(): void {
    const now = Date.now();
    if (now - this.lastReset > 24 * 60 * 60 * 1000) {
      this.activeUsers.clear();
      this.lastReset = now;
    }
  }
}

export const analytics = new Analytics();
