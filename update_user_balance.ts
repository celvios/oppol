import { query } from '../src/config/database';

const USER_WALLET = "0x93Edd0429c6Ac4B3644A174Ade5E9d4412E43680";
const CUSTODIAL_WALLET = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
const BALANCE_AMOUNT = "1.992216439902026248"; // Actual USDC received from $2 deposit

async function updateUserBalance() {
    try {
        console.log(`Updating balance for user: ${USER_WALLET}`);
        
        // Check if user exists
        const userResult = await query(
            'SELECT id FROM users WHERE LOWER(wallet_address) = $1',
            [USER_WALLET.toLowerCase()]
        );
        
        let userId;
        if (userResult.rows.length === 0) {
            // Create user if doesn't exist
            const createResult = await query(
                'INSERT INTO users (wallet_address, created_at) VALUES ($1, NOW()) RETURNING id',
                [USER_WALLET]
            );
            userId = createResult.rows[0].id;
            console.log(`✅ Created new user with ID: ${userId}`);
        } else {
            userId = userResult.rows[0].id;
            console.log(`✅ Found existing user with ID: ${userId}`);
        }
        
        // Update or create custodial wallet record
        const walletResult = await query(
            'SELECT id FROM wallets WHERE user_id = $1',
            [userId]
        );
        
        if (walletResult.rows.length === 0) {
            // Create new wallet record
            await query(
                'INSERT INTO wallets (user_id, public_address, balance, created_at) VALUES ($1, $2, $3, NOW())',
                [userId, CUSTODIAL_WALLET, BALANCE_AMOUNT]
            );
            console.log(`✅ Created custodial wallet record: ${CUSTODIAL_WALLET}`);
        } else {
            // Update existing wallet record
            await query(
                'UPDATE wallets SET public_address = $1, balance = $2, updated_at = NOW() WHERE user_id = $3',
                [CUSTODIAL_WALLET, BALANCE_AMOUNT, userId]
            );
            console.log(`✅ Updated custodial wallet record: ${CUSTODIAL_WALLET}`);
        }
        
        console.log(`✅ User balance updated: ${BALANCE_AMOUNT} USDC`);
        
    } catch (error) {
        console.error("❌ Error updating user balance:", error.message);
    }
}

updateUserBalance().catch(console.error);