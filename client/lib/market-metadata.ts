export interface MarketMetadata {
    image: string;
    description: string;
    category: string;
}

export const MARKET_METADATA: Record<string, MarketMetadata> = {
    // CRYPTO
    "Will Bitcoin reach $150,000 by April 2026?": {
        image: "/markets/bitcoin.png",
        description: "Bitcoin is on a tear. With the halving behind us and institutional adoption growing, many analysts predict a surge to $150k. This market resolves YES if BTC/USD price touches $150,000 on major exchanges before April 1st, 2026.",
        category: "Crypto"
    },
    "Will BTC reach $100k by end of 2026?": {
        image: "/markets/bitcoin.png",
        description: "Bitcoin's journey to six figures. Will it break the psychological $100,000 barrier by end of 2026?",
        category: "Crypto"
    },
    "Will Ethereum flip Bitcoin by market cap before 2027?": {
        image: "https://images.unsplash.com/photo-1622630998477-20aa696ecb05?w=800",
        description: "The flippening debate continues. With Ethereum's transition to PoS and growing DeFi ecosystem, could ETH overtake BTC in total market capitalization? Resolves YES if ETH market cap exceeds BTC for 7 consecutive days.",
        category: "Crypto"
    },

    // TECH
    "Will Apple release AR glasses in 2026?": {
        image: "/markets/apple.png",
        description: "Rumors have circulated for years about Apple's dedicated AR glasses (Project Orion). This market tracks official announcements. Resolves YES if Apple makes the product available for purchase in 2026.",
        category: "Tech"
    },
    "Which company releases consumer AR glasses first?": {
        image: "/markets/ar-glasses.png",
        description: "The AR glasses race. Apple, Meta, Google, or Samsung to bring consumer AR first?",
        category: "Tech"
    },
    "Will AI replace 50% of software jobs by 2030?": {
        image: "/markets/ai.png",
        description: "AI coding assistants are getting powerful. Will they replace half of all software engineering jobs? Resolves YES if verified employment data shows 50%+ reduction in software developer positions by 2030.",
        category: "Tech"
    },
    "Which AI company will lead benchmarks in 2026?": {
        image: "/markets/ai.png",
        description: "AI leadership race 2026. OpenAI, Google DeepMind, Anthropic, or Meta AI on top?",
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
    "Who will win Grammy Album of the Year 2026?": {
        image: "/markets/grammy.png",
        description: "Grammy Awards 2026 Album of the Year prediction. Drake, Taylor Swift, Kendrick, or The Weeknd?",
        category: "Entertainment"
    },
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
        image: "/markets/bitcoin.png",
        description: "Bitcoin's price action is the talk of the town. Will it break new all-time highs?",
        category: "Crypto"
    },
    "1": {
        image: "/markets/apple.png",
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

// Multi-outcome market metadata (new contract)
export const MULTI_MARKET_METADATA: Record<string, MarketMetadata> = {
    // CRYPTO
    "What will BTC price be at end of 2026?": {
        image: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800",
        description: "Bitcoin price prediction for the end of 2026. Choose from price brackets: Under $80k, $80k-$120k, $120k-$200k, or Over $200k.",
        category: "Crypto"
    },
    "Which L1 will have highest TVL in Q4 2026?": {
        image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800",
        description: "Layer 1 blockchain competition heats up. Which chain will dominate DeFi by Total Value Locked?",
        category: "Crypto"
    },
    "What will SOL price be at end of 2025?": {
        image: "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=800",
        description: "Solana's price trajectory through 2025. Will the 'Ethereum killer' reach new heights?",
        category: "Crypto"
    },
    // SPORTS
    "Who will win AFCON 2025?": {
        image: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800",
        description: "Africa Cup of Nations 2025. Nigeria, Morocco, Egypt, or Senegal to lift the trophy?",
        category: "Sports"
    },
    "Who will win the 2026 FIFA World Cup?": {
        image: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800",
        description: "FIFA World Cup 2026 hosted in USA, Mexico, and Canada. Which nation will bring home the trophy?",
        category: "Sports"
    },
    // POLITICS
    "Who will win 2028 US Presidential Election?": {
        image: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800",
        description: "The 2028 US Presidential race. Will Republicans, Democrats, or an Independent take the White House?",
        category: "Politics"
    },
    "Which party wins UK next general election?": {
        image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800",
        description: "UK's next general election. Conservative, Labour, Liberal Democrats, or a surprise outcome?",
        category: "Politics"
    },
    // ENTERTAINMENT
    "Which movie will gross highest in 2026?": {
        image: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800",
        description: "Box office battle 2026. Will Avatar 4, Marvel, DC, or an Original IP dominate?",
        category: "Entertainment"
    },
    "Who will win Grammy Album of the Year 2026?": {
        image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800",
        description: "Grammy Awards 2026 Album of the Year prediction. Drake, Taylor Swift, Kendrick, or The Weeknd?",
        category: "Entertainment"
    },
    // TECH
    "Which AI company will lead benchmarks in 2026?": {
        image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800",
        description: "AI leadership race 2026. OpenAI, Google DeepMind, Anthropic, or Meta AI on top?",
        category: "Tech"
    },
    "Which company releases consumer AR glasses first?": {
        image: "https://images.unsplash.com/photo-1592478411213-6153e4ebc07d?w=800",
        description: "The AR glasses race. Apple, Meta, Google, or Samsung to bring consumer AR first?",
        category: "Tech"
    },
    // SCIENCE
    "What will global temperature anomaly be in 2026?": {
        image: "https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=800",
        description: "Climate change tracking. What will the global temperature anomaly be in 2026?",
        category: "Science"
    },
    // ID-based fallbacks for multi-outcome markets
    "multi_0": {
        image: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800",
        description: "Bitcoin price prediction for the end of 2026.",
        category: "Crypto"
    },
    "multi_1": {
        image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800",
        description: "Layer 1 blockchain TVL competition.",
        category: "Crypto"
    },
    "multi_2": {
        image: "https://images.unsplash.com/photo-1621761191319-c6fb62004040?w=800",
        description: "Solana's price trajectory.",
        category: "Crypto"
    },
    "multi_3": {
        image: "https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800",
        description: "Africa Cup of Nations 2025.",
        category: "Sports"
    },
    "multi_4": {
        image: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=800",
        description: "FIFA World Cup 2026.",
        category: "Sports"
    },
    "multi_5": {
        image: "https://images.unsplash.com/photo-1541872703-74c5e44368f9?w=800",
        description: "2028 US Presidential Election.",
        category: "Politics"
    },
    "multi_6": {
        image: "https://images.unsplash.com/photo-1513635269975-59663e0ac1ad?w=800",
        description: "UK next general election.",
        category: "Politics"
    },
    "multi_7": {
        image: "https://images.unsplash.com/photo-1478720568477-152d9b164e26?w=800",
        description: "Box office battle 2026.",
        category: "Entertainment"
    },
    "multi_8": {
        image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800",
        description: "Grammy Album of the Year 2026.",
        category: "Entertainment"
    },
    "multi_9": {
        image: "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800",
        description: "AI leadership race 2026.",
        category: "Tech"
    },
    "multi_10": {
        image: "https://images.unsplash.com/photo-1592478411213-6153e4ebc07d?w=800",
        description: "AR glasses race.",
        category: "Tech"
    },
    "multi_11": {
        image: "https://images.unsplash.com/photo-1611273426858-450d8e3c9fce?w=800",
        description: "Climate change tracking 2026.",
        category: "Science"
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

export function getMultiMarketMetadata(question: string, id: number): MarketMetadata {
    // Try exact match by question
    if (MULTI_MARKET_METADATA[question]) {
        return MULTI_MARKET_METADATA[question];
    }
    // Try ID match (as "multi_X")
    const multiKey = `multi_${id}`;
    if (MULTI_MARKET_METADATA[multiKey]) {
        return MULTI_MARKET_METADATA[multiKey];
    }
    // Default fallback
    return {
        image: "https://images.unsplash.com/photo-1639762681485-074b7f938ba0?w=800",
        description: "A multi-outcome prediction market tracking this future event.",
        category: "General"
    };
}
