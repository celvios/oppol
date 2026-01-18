import { query } from '../src/config/database';

async function clearMarkets() {
    console.log('🗑️  Clearing all V1 markets from database...\n');

    try {
        // 1. Count existing markets
        const countResult = await query('SELECT COUNT(*) as count FROM markets');
        const existingCount = parseInt(countResult.rows[0]?.count || '0');
        console.log(`📊 Found ${existingCount} existing markets in database`);

        if (existingCount === 0) {
            console.log('✅ Database is already clean!');
            return;
        }

        // 2. Delete all markets
        console.log('\n🔄 Deleting all markets...');
        await query('DELETE FROM markets');
        console.log('✅ All markets deleted from database');

        // 3. Reset auto-increment (if using serial)
        console.log('\n🔄 Resetting sequences...');
        await query('ALTER SEQUENCE IF EXISTS markets_market_id_seq RESTART WITH 0');
        console.log('✅ Sequences reset');

        // 4. Verify deletion
        const verifyResult = await query('SELECT COUNT(*) as count FROM markets');
        const remainingCount = parseInt(verifyResult.rows[0]?.count || '0');

        console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`✨ Database Cleanup Complete!`);
        console.log(`   Deleted: ${existingCount} markets`);
        console.log(`   Remaining: ${remainingCount} markets`);
        console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

    } catch (error: any) {
        console.error('❌ Error clearing markets:', error.message);
        throw error;
    }
}

clearMarkets()
    .then(() => {
        console.log('🎉 Done!');
        process.exit(0);
    })
    .catch((error) => {
        console.error('💥 Fatal error:', error);
        process.exit(1);
    });
