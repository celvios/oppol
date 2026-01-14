export interface MarketMetadata {
    image: string;
    description: string;
    category: string;
}

export const MARKET_METADATA: Record<string, MarketMetadata> = {
    // CRYPTO
    "Will Bitcoin reach $150,000 by April 2026?": {
        image: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800",
        description: "Bitcoin is on a tear. With the halving behind us and institutional adoption growing, many analysts predict a surge to $150k. This market resolves YES if BTC/USD price touches $150,000 on major exchanges before April 1st, 2026.",
        category: "Crypto"
    },
    "Will Ethereum flip Bitcoin by market cap before 2027?": {
        image: "https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=800",
        description: "The flippening debate continues. With Ethereum's transition to PoS and growing DeFi ecosystem, could ETH overtake BTC in total market capitalization? Resolves YES if ETH market cap exceeds BTC for 7 consecutive days.",
        category: "Crypto"
    },

    // TECH
    "Will Apple release AR glasses in 2026?": {
        image: "https://images.unsplash.com/photo-1592478411213-6153e4ebc07d?w=800",
        description: "Rumors have circulated for years about Apple's dedicated AR glasses (Project Orion). This market tracks official announcements. Resolves YES if Apple makes the product available for purchase in 2026.",
        category: "Tech"
    },
    "Will AI replace 50% of software jobs by 2030?": {
        image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800",
        description: "AI coding assistants are getting powerful. Will they replace half of all software engineering jobs? Resolves YES if verified employment data shows 50%+ reduction in software developer positions by 2030.",
        category: "Tech"
    },
    "Will SpaceX land humans on Mars by 2028?": {
        image: "https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=800",
        description: "Elon Musk's ambitious timeline for Mars colonization. Will SpaceX successfully land humans on Mars before 2029? Resolves YES if confirmed human landing occurs.",
        category: "Tech"
    },

    // SPORTS
    "Will Messi win another Ballon d'Or in 2025?": {
        image: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800",
        description: "Lionel Messi continues to defy age. Will he claim another Ballon d'Or trophy in 2025? Resolves YES if Messi wins the 2025 Ballon d'Or award.",
        category: "Sports"
    },
    "Will an African team win the World Cup by 2030?": {
        image: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800",
        description: "African football has been rising. Morocco's 2022 performance showed what's possible. Will an African nation lift the World Cup trophy by 2030?",
        category: "Sports"
    },

    // POLITICS
    "Will Trump win the 2024 US Presidential Election?": {
        image: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800",
        description: "The 2024 race is heating up. Will Donald Trump return to the White House? Resolves YES if Trump wins the electoral college in November 2024.",
        category: "Politics"
    },
    "Will UK rejoin the EU by 2030?": {
        image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800",
        description: "Brexit sentiment is shifting. Will the UK reverse course and rejoin the European Union? Resolves YES if UK officially rejoins EU before 2030.",
        category: "Politics"
    },

    // ENTERTAINMENT
    "Will GTA 6 release in 2025?": {
        image: "https://images.unsplash.com/photo-1538481199705-c710c4e965fc?w=800",
        description: "The most anticipated game ever. Rockstar has been silent for years. Will GTA 6 finally launch in 2025? Resolves YES if game is officially released.",
        category: "Entertainment"
    },
    "Will Avatar 3 gross over $2 billion worldwide?": {
        image: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800",
        description: "James Cameron's Avatar franchise continues to break records. Will the third installment join the $2B club? Resolves YES if worldwide box office exceeds $2 billion.",
        category: "Entertainment"
    },

    // SCIENCE
    "Will fusion energy be commercially viable by 2030?": {
        image: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=800",
        description: "Nuclear fusion promises unlimited clean energy. Recent breakthroughs show promise. Will we see commercial fusion power plants by 2030?",
        category: "Science"
    },
    "Will a quantum computer break RSA-2048 by 2028?": {
        image: "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=800",
        description: "Quantum computing threatens current encryption. Will quantum computers crack RSA-2048 encryption before 2028? Resolves YES on verified successful decryption.",
        category: "Science"
    },

    // Fallback by ID
    "0": {
        image: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800",
        description: "Bitcoin's price action is the talk of the town. Will it break new all-time highs?",
        category: "Crypto"
    },
    "1": {
        image: "https://images.unsplash.com/photo-1592478411213-6153e4ebc07d?w=800",
        description: "Apple's next big thing? AR glasses could redefine computing.",
        category: "Tech"
    },
    "2": {
        image: "https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=800",
        description: "The flippening debate continues. Will Ethereum overtake Bitcoin?",
        category: "Crypto"
    },
    "3": {
        image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800",
        description: "AI is transforming the workforce. Will it replace half of software jobs?",
        category: "Tech"
    },
    "4": {
        image: "https://images.unsplash.com/photo-1614728894747-a83421e2b9c9?w=800",
        description: "SpaceX aims for Mars. Will humans land on the red planet soon?",
        category: "Tech"
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
        image: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800",
        description: "A prediction market tracking this future event. Analyzes market sentiment and probability.",
        category: "General"
    };
}
