import axios from 'axios';
import dotenv from 'dotenv';
import path from 'path';

// Load env from root
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const API_URL = process.env.API_URL || 'http://localhost:3001';
const ADMIN_SECRET = process.env.ADMIN_SECRET;

const MARKETS = [
    // 1. AUTOMOTIVE - Electric Vehicles
    {
        question: "Will Tesla lose its #1 position in global EV sales by 2026?",
        description: "Predicting if another manufacturer will surpass Tesla in total electric vehicle units sold globally by December 31, 2026.",
        category: "Automotive",
        image: "https://images.unsplash.com/photo-1593941707882-a5bba14938c7?w=800",
        outcomes: ["Yes - BYD", "Yes - VW", "Yes - Other", "No - Tesla Remains #1"],
        durationDays: 548 // ~18 months
    },

    // 2. SPACE - Moon Base
    {
        question: "Will a permanent lunar base be established by 2030?",
        description: "Predicting if a continuously inhabited facility will be operational on the Moon by December 31, 2030.",
        category: "Space",
        image: "https://images.unsplash.com/photo-1446776653964-20c1d3a81b06?w=800",
        outcomes: ["Yes", "No"],
        durationDays: 2190 // ~6 years
    },

    // 3. MUSIC - Grammy Awards
    {
        question: "Which artist will win Album of the Year at 2026 Grammys?",
        description: "Predicting the winner of the Album of the Year category at the 68th Annual Grammy Awards in 2026.",
        category: "Music",
        image: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=800",
        outcomes: ["Taylor Swift", "Beyoncé", "Drake", "Bad Bunny", "Billie Eilish", "Other"],
        durationDays: 456 // ~15 months
    },

    // 4. FOOD - Lab-Grown Meat
    {
        question: "Will lab-grown meat reach 10% of US meat market by 2028?",
        description: "Predicting if cultivated meat products will account for 10% or more of total meat sales in the United States by December 31, 2028.",
        category: "Food & Agriculture",
        image: "https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?w=800",
        outcomes: ["Yes", "No"],
        durationDays: 1278 // ~3.5 years
    },

    // 5. REAL ESTATE - Housing Market
    {
        question: "Will US median home prices drop below $350k in 2025?",
        description: "Predicting if the median home sale price in the United States will fall below $350,000 at any point during 2025.",
        category: "Real Estate",
        image: "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800",
        outcomes: ["Yes - Q1", "Yes - Q2", "Yes - Q3", "Yes - Q4", "No"],
        durationDays: 365 // 1 year
    },

    // 6. HEALTHCARE - Cancer Treatment
    {
        question: "Will mRNA cancer vaccines be FDA approved by 2027?",
        description: "Predicting if personalized mRNA-based cancer treatment vaccines will receive FDA approval for commercial use by December 31, 2027.",
        category: "Healthcare",
        image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800",
        outcomes: ["Yes", "No"],
        durationDays: 1095 // ~3 years
    },

    // 7. FASHION - Luxury Brands
    {
        question: "Which luxury brand will have highest market cap in 2026?",
        description: "Predicting which luxury fashion house will have the highest market capitalization as of December 31, 2026.",
        category: "Fashion",
        image: "https://images.unsplash.com/photo-1490481651871-ab68de25d43d?w=800",
        outcomes: ["LVMH", "Hermès", "Kering", "Richemont", "Prada", "Other"],
        durationDays: 730 // ~2 years
    },

    // 8. EDUCATION - Online Learning
    {
        question: "Will online degrees surpass traditional degrees in US by 2029?",
        description: "Predicting if more bachelor's degrees will be awarded through fully online programs than traditional on-campus programs in the US by 2029.",
        category: "Education",
        image: "https://images.unsplash.com/photo-1501504905252-473c47e087f8?w=800",
        outcomes: ["Yes", "No"],
        durationDays: 1642 // ~4.5 years
    },

    // 9. ENERGY - Nuclear Fusion
    {
        question: "Will commercial fusion power plant be operational by 2035?",
        description: "Predicting if a nuclear fusion power plant will be generating electricity for commercial grid use by December 31, 2035.",
        category: "Energy",
        image: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=800",
        outcomes: ["Yes", "No"],
        durationDays: 3650 // ~10 years
    },

    // 10. TRAVEL - Supersonic Flight
    {
        question: "Will commercial supersonic flights resume by 2027?",
        description: "Predicting if regularly scheduled supersonic passenger flights will be available for commercial booking by December 31, 2027.",
        category: "Travel & Aviation",
        image: "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?w=800",
        outcomes: ["Yes", "No"],
        durationDays: 1095 // ~3 years
    },

    // 11. SOCIAL MEDIA - Platform Wars
    {
        question: "Which social platform will have most daily active users in 2026?",
        description: "Predicting which social media platform will have the highest number of daily active users globally as of December 31, 2026.",
        category: "Social Media",
        image: "https://images.unsplash.com/photo-1611162617474-5b21e879e113?w=800",
        outcomes: ["TikTok", "Instagram", "Facebook", "YouTube", "X (Twitter)", "Other"],
        durationDays: 730 // ~2 years
    },

    // 12. ROBOTICS - Humanoid Robots
    {
        question: "Will humanoid robots be commercially available for home use by 2028?",
        description: "Predicting if general-purpose humanoid robots will be available for consumer purchase under $50,000 by December 31, 2028.",
        category: "Robotics",
        image: "https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=800",
        outcomes: ["Yes", "No"],
        durationDays: 1460 // ~4 years
    }
];

async function deployMarkets() {
    console.log(`\n🚀 Deploying ${MARKETS.length} V2 markets to ${API_URL}...`);
    console.log(`🔑 Using Admin Secret: ${ADMIN_SECRET}\n`);

    let successCount = 0;
    let failCount = 0;

    for (const [i, market] of MARKETS.entries()) {
        try {
            console.log(`\n[${i + 1}/${MARKETS.length}] Creating: "${market.question}"`);
            console.log(`   Category: ${market.category}`);
            console.log(`   Outcomes: ${market.outcomes.join(', ')}`);
            console.log(`   Duration: ${market.durationDays} days`);

            const res = await axios.post(`${API_URL}/api/admin/create-market-v2`, market, {
                headers: { 'x-admin-secret': ADMIN_SECRET },
                timeout: 60000
            });

            if (res.data.success) {
                console.log(`   ✅ SUCCESS! Market ID: ${res.data.marketId}`);
                console.log(`   📝 TX Hash: ${res.data.txHash.slice(0, 20)}...`);
                successCount++;
            } else {
                console.error(`   ❌ FAILED: ${res.data.error}`);
                failCount++;
            }
        } catch (error: any) {
            console.error(`   ❌ ERROR: ${error.response?.data?.error || error.message}`);
            if (error.response?.data) {
                console.error(`   📋 Response Data:`, JSON.stringify(error.response.data, null, 2));
            }
            if (error.code) {
                console.error(`   🔍 Error Code: ${error.code}`);
            }
            failCount++;
        }

        // Wait 3 seconds between transactions
        if (i < MARKETS.length - 1) {
            console.log(`   ⏳ Waiting 3 seconds before next market...`);
            await new Promise(r => setTimeout(r, 3000));
        }
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✨ Deployment Complete!`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📊 Total: ${MARKETS.length}`);
    console.log(`${'='.repeat(60)}\n`);
}

deployMarkets()
    .then(() => {
        console.log('🎉 All done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });
