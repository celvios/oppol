import pool from '../config/database';

const DEFAULT_CATEGORIES = [
    'Crypto',
    'Tech',
    'Sports',
    'Politics',
    'Entertainment',
    'Science',
    'Finance',
    'Gaming',
    'Weather',
    'Culture'
];

async function seedCategories() {
    console.log('🌱 Seeding categories...');

    try {
        for (const category of DEFAULT_CATEGORIES) {
            try {
                await pool.query(
                    'INSERT INTO categories (name) VALUES ($1) ON CONFLICT (name) DO NOTHING',
                    [category]
                );
                console.log(`✅ Added category: ${category}`);
            } catch (err) {
                console.log(`⚠️  Category "${category}" already exists or error:`, err);
            }
        }

        console.log('✅ Category seeding complete!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error seeding categories:', error);
        process.exit(1);
    }
}

seedCategories();
