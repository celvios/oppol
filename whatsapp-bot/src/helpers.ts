import { Market } from './types';

export function escapeMarkdown(text: string): string {
  if (!text) return '';
  return text.replace(/[_*[\]`]/g, '\\$&');
}

export function formatMarketList(markets: Market[], page: number = 0, pageSize: number = 10): string {
  const start = page * pageSize;
  const end = start + pageSize;
  const pageMarkets = markets.slice(start, end);

  if (pageMarkets.length === 0) {
    return '📊 *No markets available*\n\nCheck back later!';
  }

  let text = `📊 *Active Markets* (Page ${page + 1}/${Math.ceil(markets.length / pageSize)})\n\n`;

  pageMarkets.forEach((market, idx) => {
    const num = start + idx + 1;
    const price = market.prices?.[0] ? Math.round(market.prices[0]) : 50;
    const question = market.question.length > 50
      ? market.question.substring(0, 50) + '...'
      : market.question;
    text += `*${num}.* ${escapeMarkdown(question)}\n`;
    text += `   🟢 YES: ${price}% | 🔴 NO: ${100 - price}%\n\n`;
  });

  const hasMore = end < markets.length;
  const hasPrev = page > 0;

  text += `➡️ Reply with *number* to view market\n`;
  if (hasPrev && hasMore) {
    text += `➡️ Reply *prev* or *next* to navigate\n`;
  } else if (hasMore) {
    text += `➡️ Reply *next* for more markets\n`;
  } else if (hasPrev) {
    text += `➡️ Reply *prev* for previous page\n`;
  }
  text += `➡️ Reply *menu* to go back`;

  return text;
}

export function formatMarketDetails(market: Market): string {
  let text = `📊 *${escapeMarkdown(market.question)}*\n\n`;

  if (market.description) {
    const desc = market.description.length > 150
      ? market.description.substring(0, 150) + '...'
      : market.description;
    text += `${escapeMarkdown(desc)}\n\n`;
  }

  text += `📈 *Current Odds:*\n`;
  market.outcomes.forEach((outcome, i) => {
    const price = Math.round(market.prices?.[i] || 50);
    const emoji = i === 0 ? '🟢' : '🔴';
    text += `${emoji} *${outcome}*: ${price}%\n`;
  });

  const endDate = market.endTime
    ? new Date(market.endTime * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
    : 'TBD';

  const volume = market.totalVolume ? `$${market.totalVolume}` : 'N/A';

  text += `\n📈 *Volume:* ${volume}\n`;
  text += `⏰ *Ends:* ${endDate}\n\n`;

  // Add numbered options
  text += `*Choose outcome to bet:*\n`;
  market.outcomes.forEach((outcome, i) => {
    text += `${i + 1}. ${outcome}\n`;
  });
  text += `\nReply with *number* or *name*\nReply *menu* to go back`;

  return text;
}

export function validateAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

export function validateAmount(amount: string): number | null {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0) return null;
  return num;
}
