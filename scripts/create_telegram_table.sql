-- Create telegram_users table if it doesn't exist
CREATE TABLE IF NOT EXISTS telegram_users (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT UNIQUE NOT NULL,
    username VARCHAR(255),
    wallet_address VARCHAR(42) NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    last_active TIMESTAMP DEFAULT NOW()
);

-- Create telegram_transactions table if it doesn't exist
CREATE TABLE IF NOT EXISTS telegram_transactions (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT NOT NULL,
    type VARCHAR(20) NOT NULL, -- 'BET', 'WITHDRAW', 'DEPOSIT'
    market_id INTEGER,
    outcome INTEGER,
    amount DECIMAL(18, 6),
    tx_hash VARCHAR(66),
    status VARCHAR(20) DEFAULT 'PENDING', -- 'PENDING', 'CONFIRMED', 'FAILED'
    created_at TIMESTAMP DEFAULT NOW(),
    FOREIGN KEY (telegram_id) REFERENCES telegram_users(telegram_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_telegram_users_telegram_id ON telegram_users(telegram_id);
CREATE INDEX IF NOT EXISTS idx_telegram_transactions_telegram_id ON telegram_transactions(telegram_id);
CREATE INDEX IF NOT EXISTS idx_telegram_transactions_type ON telegram_transactions(type);