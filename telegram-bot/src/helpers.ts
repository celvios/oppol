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

export function buildMarketButtons(markets: Market[], page: number, hasNext: boolean, hasPrev: boolean) {
    const buttons = markets.map(m => [{
        text: `${m.question.substring(0, 60)}${m.question.length > 60 ? '...' : ''}`,
        callback_data: `market_${m.market_id}`
    }]);

    const navButtons = [];
    if (hasPrev) navButtons.push({ text: '⬅️ Previous', callback_data: `page_${page - 1}` });
    if (hasNext) navButtons.push({ text: 'Next ➡️', callback_data: `page_${page + 1}` });
    if (navButtons.length > 0) buttons.push(navButtons);

    buttons.push([{ text: '🔍 Search', callback_data: 'search' }]);
    buttons.push([{ text: '🔙 Back to Menu', callback_data: 'menu' }]);

    return buttons;
}

export function escapeMarkdown(text: string): string {
    if (!text) return '';
    // Escape characters that have special meaning in Markdown V1
    return text.replace(/[_*[\]`]/g, '\\$&');
}
