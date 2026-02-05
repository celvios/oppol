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
    return '📊 *No markets available*\n\nCheck back later!\n\n〰️〰️〰️\n0: Menu';
  }

  let text = `📊 *Markets* (${page + 1}/${Math.ceil(markets.length / pageSize)})\n\n`;

  pageMarkets.forEach((market, idx) => {
    const num = start + idx + 1;
    const price = market.prices?.[0] ? Math.round(market.prices[0]) : 50;
    const question = market.question.length > 45
      ? market.question.substring(0, 42) + '...'
      : market.question;

    // Use number emojis for 1-10
    const numEmoji = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'][idx] || `${num}.`;

    text += `${numEmoji} ${escapeMarkdown(question)}\n`;
    text += `   YES ${price}% • NO ${100 - price}%\n\n`;
  });

  const hasMore = end < markets.length;
  const hasPrev = page > 0;

  text += `〰️〰️〰️\n`;

  if (hasPrev && hasMore) {
    text += `1-${pageMarkets.length}: View | prev | next | 0: Menu`;
  } else if (hasMore) {
    text += `1-${pageMarkets.length}: View | next | 0: Menu`;
  } else if (hasPrev) {
    text += `1-${pageMarkets.length}: View | prev | 0: Menu`;
  } else {
    text += `1-${pageMarkets.length}: View | 0: Menu`;
  }

  return text;
}

export function formatMarketDetails(market: Market): string {
  let text = `📊 *${escapeMarkdown(market.question)}*\n\n`;

  if (market.description) {
    const desc = market.description.length > 120
      ? market.description.substring(0, 117) + '...'
      : market.description;
    text += `${escapeMarkdown(desc)}\n\n`;
  }

  text += `📈 *Current Odds:*\n`;
  market.outcomes.forEach((outcome, i) => {
    const price = Math.round(market.prices?.[i] || 50);
    const emoji = i === 0 ? '🜢' : '🔴';
    text += `${emoji} ${outcome}: ${price}%\n`;
  });

  const endDate = market.endTime
    ? new Date(market.endTime * 1000).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })
    : 'TBD';

  const volume = market.totalVolume ? `$${market.totalVolume}` : 'N/A';

  text += `\n📈 Vol: ${volume} • ⏰ Ends: ${endDate}\n\n`;

  // Numbered betting options
  text += `*Bet on:*\n`;
  market.outcomes.forEach((outcome, i) => {
    text += `${i + 1}️⃣ ${outcome}\n`;
  });

  text += `\n〰️〰️〰️\n`;
  text += `1-${market.outcomes.length}: Bet | 0: Menu`;

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
