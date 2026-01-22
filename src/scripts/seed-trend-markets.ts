
import pool from '../config/database';
import fs from 'fs';
import path from 'path';

// Artifacts directory
const ARTIFACTS_DIR = 'C:/Users/toluk/.gemini/antigravity/brain/fb99cd27-49fe-46fc-b769-5cd6a7ae22ae';

// Market Images
const IMAGES = {
    tech: 'market_tech_1769106763021.png',
    crypto: 'market_crypto_1769106780110.png',
    sports: 'market_sports_1769106796557.png',
    finance: 'market_finance_1769106817571.png'
};

const MARKETS = [
    {
        question: "Will GPT-6 be released by Q2 2026?",
        description: "Predicting the release timeline of the next major OpenAI model.",
        category: "Tech",
        imageKey: 'tech',
        outcomes: JSON.stringify(["Yes", "No"]),
        market_id: 1001 // Manually assigned locally to avoid conflict with contract IDs 0-100
    },
    {
        question: "Will Bitcoin pass $150k by March 2026?",
        description: "Bitcoin price prediction for Q1 2026.",
        category: "Crypto",
        imageKey: 'crypto',
        outcomes: JSON.stringify(["Yes", "No"]),
        market_id: 1002
    },
    {
        question: "Will the Chiefs win Super Bowl LX?",
        description: "Super Bowl 2026 winner prediction.",
        category: "Sports",
        imageKey: 'sports',
        outcomes: JSON.stringify(["Yes", "No"]),
        market_id: 1003
    },
    {
        question: "Will the US Federal Reserve cut rates in February 2026?",
        description: "Fed interest rate decision prediction.",
        category: "Finance",
        imageKey: 'finance',
        outcomes: JSON.stringify(["Cut", "Hold", "Hike"]),
        market_id: 1004
    }
];

async function seedTrendMarkets() {
    console.log('🚀 Seeding trend markets...');

    try {
        for (const market of MARKETS) {
            // Read image and convert to base64
            const imagePath = path.join(ARTIFACTS_DIR, IMAGES[market.imageKey as keyof typeof IMAGES]);
            let base64Image = '';

            try {
                const imageBuffer = fs.readFileSync(imagePath);
                base64Image = `data:image/png;base64,${imageBuffer.toString('base64')}`;
                console.log(`📸 Loaded image for ${market.category}`);
            } catch (err) {
                console.error(`⚠️ Could not read image for ${market.category} at ${imagePath}:`, err);
                // Continue with empty image or placeholder if failed
            }

            // Insert into markets table
            // Note: We use market_metadata table name in code? No, schema says `markets` table has everything.
            // Check index.ts: 
            // CREATE TABLE IF NOT EXISTS markets (...)

            const queryText = `
                INSERT INTO markets (market_id, question, description, image, category, outcome_names)
                VALUES ($1, $2, $3, $4, $5, $6)
                ON CONFLICT (market_id) DO UPDATE SET
                    question = EXCLUDED.question,
                    description = EXCLUDED.description,
                    image = EXCLUDED.image,
                    category = EXCLUDED.category,
                    outcome_names = EXCLUDED.outcome_names;
            `;

            await pool.query(queryText, [
                market.market_id,
                market.question,
                market.description,
                base64Image,
                market.category,
                market.outcomes
            ]);

            console.log(`✅ Seeded market: ${market.question}`);
        }

        console.log('✨ Trend markets seeding complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding markets:', error);
        process.exit(1);
    }
}

seedTrendMarkets();
