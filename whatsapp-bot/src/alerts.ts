import { PriceAlert } from './types';
import { API } from './api';

class AlertManager {
  private alerts: Map<string, PriceAlert[]> = new Map();
  private checkInterval: NodeJS.Timeout | null = null;

  add(alert: PriceAlert): void {
    const key = alert.phoneNumber;
    const existing = this.alerts.get(key) || [];
    existing.push(alert);
    this.alerts.set(key, existing);
  }

  remove(phoneNumber: string, marketId: number): void {
    const existing = this.alerts.get(phoneNumber) || [];
    const filtered = existing.filter(a => a.marketId !== marketId);
    this.alerts.set(phoneNumber, filtered);
  }

  getAlerts(phoneNumber: string): PriceAlert[] {
    return this.alerts.get(phoneNumber) || [];
  }

  clearAll(phoneNumber: string): void {
    this.alerts.delete(phoneNumber);
  }

  async checkAlerts(onAlert: (phoneNumber: string, message: string) => Promise<void>): Promise<void> {
    for (const [phoneNumber, alerts] of this.alerts.entries()) {
      for (const alert of alerts) {
        try {
          const market = await API.getMarket(alert.marketId);
          if (!market || !market.prices) continue;

          const currentPrice = market.prices[alert.outcome];
          const triggered = alert.direction === 'above' 
            ? currentPrice >= alert.targetPrice
            : currentPrice <= alert.targetPrice;

          if (triggered) {
            const outcomeName = market.outcomes[alert.outcome];
            const message = `🔔 *Price Alert!*\n\n` +
              `${market.question}\n\n` +
              `${outcomeName} is now at ${Math.round(currentPrice)}%\n` +
              `(Target: ${alert.direction} ${alert.targetPrice}%)\n\n` +
              `Reply *markets* to trade`;

            await onAlert(phoneNumber, message);
            this.remove(phoneNumber, alert.marketId);
          }
        } catch (error) {
          console.error('Alert check error:', error);
        }
      }
    }
  }

  startChecking(onAlert: (phoneNumber: string, message: string) => Promise<void>): void {
    if (this.checkInterval) return;
    
    // Check every 5 minutes
    this.checkInterval = setInterval(() => {
      this.checkAlerts(onAlert);
    }, 5 * 60 * 1000);
  }

  stopChecking(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }
}

export const alertManager = new AlertManager();
