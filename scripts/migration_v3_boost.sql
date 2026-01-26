-- Add creator column to markets (if not exists, though we track it in contract now, good to have in DB)
ALTER TABLE markets ADD COLUMN IF NOT EXISTS creator_address VARCHAR(42);

-- Add boost columns to markets
ALTER TABLE markets ADD COLUMN IF NOT EXISTS is_boosted BOOLEAN DEFAULT FALSE;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS boost_expires_at BIGINT DEFAULT 0;
ALTER TABLE markets ADD COLUMN IF NOT EXISTS boost_tier INT DEFAULT 0;

-- Create boost_requests table for audit trail
CREATE TABLE IF NOT EXISTS boost_requests (
    id SERIAL PRIMARY KEY,
    market_id INT REFERENCES markets(market_id),
    tx_hash VARCHAR(66) UNIQUE NOT NULL,
    tier_id INT NOT NULL,
    amount DECIMAL(18, 6) NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING', -- PENDING, CONFIRMED, FAILED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
