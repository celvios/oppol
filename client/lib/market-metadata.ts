export interface MarketMetadata {
    image: string;
    description: string;
}

export const MARKET_METADATA: Record<string, MarketMetadata> = {
    // Bitcoin Market
    "Will Bitcoin reach $150,000 by April 2026?": {
        image: "/markets/bitcoin.png",
        description: "Bitcoin is on a tear. With the halving behind us and institutional adoption growing, many analysts predict a surge to $150k. This market resolves YES if BTC/USD price touches $150,000 on major exchanges before April 1st, 2026."
    },
    // Apple Market
    "Will Apple release AR glasses in 2026?": {
        image: "/markets/apple.png",
        description: "Rumors have circulated for years about Apple's dedicated AR glasses (Project Orion). This market tracks official announcements. Resolves YES if Apple makes the product available for purchase in 2026."
    },
    // Fallback/Demo if ID based
    "0": {
        image: "/markets/bitcoin.png",
        description: "Bitcoin's price action is the talk of the town. Will it break new all-time highs?"
    },
    "1": {
        image: "/markets/apple.png",
        description: "Apple's next big thing? AR glasses could redefine computing."
    }
};

export function getMarketMetadata(question: string, id: number): MarketMetadata {
    // Try exact match matching question
    if (MARKET_METADATA[question]) {
        return MARKET_METADATA[question];
    }
    // Try ID match (as string)
    if (MARKET_METADATA[id.toString()]) {
        return MARKET_METADATA[id.toString()];
    }
    // Default fallback
    return {
        image: "/markets/bitcoin.png", // Default image
        description: "A prediction market tracking this future event. Analyzes market sentiment and probability."
    };
}
