import { query } from './config/database';

const USER_WALLET = "0x93Edd0429c6Ac4B3644A174Ade5E9d4412E43680";
const CUSTODIAL_WALLET = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
const BALANCE_AMOUNT = "1.992216439902026248";

async function updateUserBalance() {
    try {
        console.log(`Updating balance for user: ${USER_WALLET}`);
        
        const userResult = await query(
            'SELECT id FROM users WHERE LOWER(wallet_address) = $1',
            [USER_WALLET.toLowerCase()]
        );
        
        let userId;
        if (userResult.rows.length === 0) {
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
        
        const walletResult = await query(
            'SELECT id FROM wallets WHERE user_id = $1',
            [userId]
        );
        
        if (walletResult.rows.length === 0) {
            await query(
                'INSERT INTO wallets (user_id, public_address, balance, created_at) VALUES ($1, $2, $3, NOW())',
                [userId, CUSTODIAL_WALLET, BALANCE_AMOUNT]
            );
            console.log(`✅ Created custodial wallet record`);
        } else {
            await query(
                'UPDATE wallets SET public_address = $1, balance = $2, updated_at = NOW() WHERE user_id = $3',
                [CUSTODIAL_WALLET, BALANCE_AMOUNT, userId]
            );
            console.log(`✅ Updated custodial wallet record`);
        }
        
        console.log(`✅ User balance updated: ${BALANCE_AMOUNT} USDC`);
        
    } catch (error: any) {
        console.error("❌ Error:", error.message);
    }
}

updateUserBalance().catch(console.error);