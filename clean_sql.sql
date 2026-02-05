-- Clean SQL to credit user's $1.99 USDC deposit

-- Step 1: Create user if doesn't exist
INSERT INTO users (wallet_address, created_at) 
VALUES ('0x93Edd0429c6Ac4B3644A174Ade5E9d4412E43680', NOW()) 
ON CONFLICT (wallet_address) DO NOTHING;

-- Step 2: Create custodial wallet record
INSERT INTO wallets (user_id, public_address, balance, created_at) 
VALUES (
    (SELECT id FROM users WHERE wallet_address = '0x93Edd0429c6Ac4B3644A174Ade5E9d4412E43680'),
    '0xe3Eb84D7e271A5C44B27578547f69C80c497355B',
    '1.992216439902026248',
    NOW()
) 
ON CONFLICT (user_id) DO UPDATE SET
    public_address = EXCLUDED.public_address,
    balance = EXCLUDED.balance;

-- Step 3: Verify the update
SELECT 
    u.wallet_address,
    w.public_address as custodial_wallet,
    w.balance
FROM users u
JOIN wallets w ON u.id = w.user_id
WHERE u.wallet_address = '0x93Edd0429c6Ac4B3644A174Ade5E9d4412E43680';