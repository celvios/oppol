import { query } from '../src/config/database';

const USER_WALLET = "0x93Edd0429c6Ac4B3644A174Ade5E9d4412E43680";

async function checkUserInDatabase() {
    console.log(`Checking database for wallet: ${USER_WALLET}\n`);

    try {
        // Check users table
        console.log("=== USERS TABLE ===");
        const userResult = await query(
            'SELECT * FROM users WHERE LOWER(wallet_address) = $1',
            [USER_WALLET.toLowerCase()]
        );
        
        if (userResult.rows.length > 0) {
            console.log("User found:");
            console.log(userResult.rows[0]);
            
            const userId = userResult.rows[0].id;
            
            // Check custodial wallets
            console.log("\n=== CUSTODIAL WALLETS ===");
            const walletResult = await query(
                'SELECT * FROM wallets WHERE user_id = $1',
                [userId]
            );
            
            if (walletResult.rows.length > 0) {
                console.log("Custodial wallet found:");
                console.log(walletResult.rows[0]);
            } else {
                console.log("No custodial wallet found");
            }
            
            // Check transactions/deposits
            console.log("\n=== TRANSACTIONS ===");
            const txResult = await query(
                'SELECT * FROM transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10',
                [userId]
            );
            
            if (txResult.rows.length > 0) {
                console.log("Recent transactions:");
                txResult.rows.forEach((tx, i) => {
                    console.log(`${i + 1}. ${tx.type} - ${tx.amount} - ${tx.status} - ${tx.created_at}`);
                });
            } else {
                console.log("No transactions found");
            }
            
        } else {
            console.log("User not found in database");
            
            // Check if there are any users with similar addresses
            console.log("\n=== SIMILAR ADDRESSES ===");
            const similarResult = await query(
                'SELECT wallet_address FROM users WHERE wallet_address ILIKE $1',
                [`%${USER_WALLET.slice(-8)}%`]
            );
            
            if (similarResult.rows.length > 0) {
                console.log("Similar wallet addresses found:");
                similarResult.rows.forEach(row => {
                    console.log(`- ${row.wallet_address}`);
                });
            }
        }
        
        // Check WhatsApp users table
        console.log("\n=== WHATSAPP USERS ===");
        const whatsappResult = await query(
            'SELECT * FROM whatsapp_users WHERE LOWER(wallet_address) = $1',
            [USER_WALLET.toLowerCase()]
        );
        
        if (whatsappResult.rows.length > 0) {
            console.log("WhatsApp user found:");
            console.log(whatsappResult.rows[0]);
        } else {
            console.log("No WhatsApp user found");
        }
        
    } catch (error) {
        console.error("Database error:", error.message);
        
        // If database connection fails, check if tables exist
        try {
            const tablesResult = await query(
                "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'"
            );
            console.log("\nAvailable tables:");
            tablesResult.rows.forEach(row => {
                console.log(`- ${row.table_name}`);
            });
        } catch (e) {
            console.log("Could not connect to database");
        }
    }
}

checkUserInDatabase().catch(console.error);