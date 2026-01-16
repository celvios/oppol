import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load env from root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_URL = process.env.API_URL || 'http://localhost:3001';
const ADMIN_SECRET = process.env.ADMIN_SECRET || 'admin123';

const MARKETS = [
    // CRYPTO
    {
        question: "Will Bitcoin hit $100k by Q4 2025?",
        description: "Predicting if BTC/USD will trade above $100,000 on major exchanges before Dec 31, 2025.",
        category: "Crypto",
        image: "https://images.unsplash.com/photo-1518546305927-5a555bb7020d?w=800",
        outcomes: ["Yes", "No"],
        initialLiquidity: 1000,
        durationHours: 365 * 24
    },
    {
        question: "Will Ethereum flip Bitcoin in market cap in 2025?",
        description: "The 'Flippening': Will ETH market cap exceed BTC market cap at any point in 2025?",
        category: "Crypto",
        image: "https://images.unsplash.com/photo-1622630998477-20aa696fab05?w=800",
        outcomes: ["Yes", "No"],
        initialLiquidity: 500,
        durationHours: 365 * 24
    },
    // SPORTS
    {
        question: "Who will win the 2026 World Cup?",
        description: "Winner of the FIFA World Cup 2026 hosted in North America.",
        category: "Sports",
        image: "https://images.unsplash.com/photo-1518091043644-c1d4457512c6?w=800",
        outcomes: ["Brazil", "France", "Argentina", "USA", "Other"],
        initialLiquidity: 2000,
        durationHours: 1.5 * 365 * 24
    },
    {
        question: "Will LeBron James retire before the 2026 season?",
        description: "Predicting if LeBron announces official retirement from the NBA before the 2026-2027 season starts.",
        category: "Sports",
        image: "https://images.unsplash.com/photo-1519861531473-920026393112?w=800",
        outcomes: ["Yes", "No"],
        initialLiquidity: 500,
        durationHours: 12 * 24
    },
    {
        question: "Winner of Super Bowl LIX (2025)?",
        description: "Which team will lift the Lombardi Trophy in Feb 2025?",
        category: "Sports",
        image: "https://images.unsplash.com/photo-1566577739112-5180d4bf9390?w=800",
        outcomes: ["Kansas City", "San Francisco", "Baltimore", "Detroit", "Other"],
        initialLiquidity: 1000,
        durationHours: 30 * 24
    },
    // POLITICS
    {
        question: "Will the US pass comprehensive AI regulation in 2025?",
        description: "Defining 'comprehensive' as a major federal bill signed into law specifically targeting AI safety.",
        category: "Politics",
        image: "https://images.unsplash.com/photo-1540910419868-474945984c71?w=800",
        outcomes: ["Yes", "No"],
        initialLiquidity: 800,
        durationHours: 12 * 30 * 24
    },
    {
        question: "Who will win the next UK General Election?",
        description: "Party with the most seats in Parliament.",
        category: "Politics",
        image: "https://images.unsplash.com/photo-1529107386315-e1a2ed48a620?w=800",
        outcomes: ["Labour", "Conservative", "Reform UK", "Lib Dem"],
        initialLiquidity: 750,
        durationHours: 365 * 24
    },
    // TECH
    {
        question: "Will SpaceX land humans on Mars by 2030?",
        description: "A successful soft landing of a crewed Starship on the Martian surface before Jan 1, 2030.",
        category: "Tech",
        image: "https://images.unsplash.com/photo-1517976487492-5750f3195933?w=800",
        outcomes: ["Yes", "No"],
        initialLiquidity: 1200,
        durationHours: 5 * 365 * 24
    },
    {
        question: "Will Apple launch a foldable iPhone in 2025?",
        description: "Official release (available for sale) of a foldable screen iPhone model in calendar year 2025.",
        category: "Tech",
        image: "https://images.unsplash.com/photo-1510557880182-3d4d3cba35a5?w=800",
        outcomes: ["Yes", "No"],
        initialLiquidity: 600,
        durationHours: 12 * 30 * 24
    },
    // POP CULTURE
    {
        question: "Who will win Album of the Year at the 2025 Grammys?",
        description: "Predicting the winner of the main category.",
        category: "Pop Culture",
        image: "https://images.unsplash.com/photo-1493225255756-d9584f8606e9?w=800",
        outcomes: ["Taylor Swift", "Beyoncé", "Billie Eilish", "Other"],
        initialLiquidity: 1000,
        durationHours: 2 * 30 * 24
    },
    {
        question: "Will GTA VI be released in 2025?",
        description: "Official public release of Grand Theft Auto VI before Dec 31, 2025.",
        category: "Pop Culture",
        image: "https://images.unsplash.com/photo-1552820728-8b83bb6b773f?w=800",
        outcomes: ["Yes", "No"],
        initialLiquidity: 1500,
        durationHours: 12 * 30 * 24
    },
    // FINANCE
    {
        question: "Will the Fed cut rates below 3% in 2025?",
        description: "Federal Funds Rate target range upper limit dropping below 3.00% at any FOMC meeting in 2025.",
        category: "Finance",
        image: "https://images.unsplash.com/photo-1611974765270-ca1258634369?w=800",
        outcomes: ["Yes", "No"],
        initialLiquidity: 900,
        durationHours: 12 * 30 * 24
    }
];

async function seed() {
    console.log(`🌱 Seeding ${MARKETS.length} markets to ${API_URL}...`);
    console.log(`🔑 Using Secret: ${ADMIN_SECRET}`);

    for (const [i, m] of MARKETS.entries()) {
        try {
            console.log(`\n[${i + 1}/${MARKETS.length}] Creating: "${m.question}"`);
            const res = await axios.post(`${API_URL}/api/admin/create-market`, m, {
                headers: { 'x-admin-secret': ADMIN_SECRET }
            });

            if (res.data.success) {
                console.log(`✅ Success! ID: ${res.data.marketId} (TX: ${res.data.txHash.slice(0, 10)}...)`);
            } else {
                console.error(`❌ Failed: ${res.data.error}`);
            }
        } catch (error: any) {
            console.error(`❌ Error seeding market "${m.question}":`, error.response?.data || error.message);
        }

        // Wait a bit between txs to avoid nonce issues or rate limits
        await new Promise(r => setTimeout(r, 2000));
    }
    console.log('\n✨ Seeding complete!');
}

seed();
