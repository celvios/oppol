import { Market } from './api';

const MARKETS_PER_PAGE = 5;

export function paginateMarkets(markets: Market[], page: number = 0) {
    const start = page * MARKETS_PER_PAGE;
    const end = start + MARKETS_PER_PAGE;
    const pageMarkets = markets.slice(start, end);
    const hasNext = end < markets.length;
    const hasPrev = page > 0;
    return { pageMarkets, hasNext, hasPrev, totalPages: Math.ceil(markets.length / MARKETS_PER_PAGE) };
}

export function buildMarketListText(markets: Market[], page: number, hasNext: boolean, hasPrev: boolean): string {
    let text = `📊 *Active Markets* (Page ${page + 1})\n\n`;

    markets.forEach((m, index) => {
        // Map 0-4 index to 1-5 for display
        const displayIndex = index + 1;
        const shortQ = m.question.length > 50 ? m.question.substring(0, 47) + '...' : m.question;
        text += `*${displayIndex}.* ${shortQ}\n`;
    });

    text += `\n_Reply with the number (1-${markets.length}) to select a market._\n`;

    if (hasNext || hasPrev) {
        text += `\n`;
        if (hasPrev) text += `*P* - Previous Page\n`;
        if (hasNext) text += `*N* - Next Page\n`;
    }

    text += `*M* - Main Menu`;

    return text;
}
