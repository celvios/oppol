import { analytics } from './analytics';

const ADMIN_PHONES = (process.env.ADMIN_PHONES || '').split(',').filter(Boolean);

export function isAdmin(phoneNumber: string): boolean {
  return ADMIN_PHONES.includes(phoneNumber);
}

export function getAdminCommands(): string {
  return `🔐 *Admin Commands*\n\n` +
    `*stats* - View bot statistics\n` +
    `*broadcast <message>* - Send to all users\n` +
    `*users* - View user count\n\n` +
    `Reply *menu* to go back`;
}

export function getStatsMessage(): string {
  const stats = analytics.getStats();
  
  return `📊 *Bot Statistics*\n\n` +
    `👥 Total Users: ${stats.totalUsers}\n` +
    `🟢 Active (24h): ${stats.activeUsers24h}\n` +
    `🎰 Total Bets: ${stats.totalBets}\n` +
    `💰 Total Volume: $${stats.totalVolume.toFixed(2)}\n` +
    `📨 Messages: ${stats.messagesProcessed}\n\n` +
    `Reply *menu* to go back`;
}

export interface BroadcastResult {
  success: number;
  failed: number;
}
