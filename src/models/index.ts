import { query } from '../config/database';

const createTablesQuery = `
  -- Enable UUID extension
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  -- Users Table
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(50) UNIQUE,
    wallet_address VARCHAR(42),
    display_name VARCHAR(100),
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Comments Table
  CREATE TABLE IF NOT EXISTS comments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    market_id INTEGER NOT NULL,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- WhatsApp Users Table (for bot users)
  CREATE TABLE IF NOT EXISTS whatsapp_users (
    phone_number VARCHAR(20) PRIMARY KEY,
    username VARCHAR(100),
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Telegram Users Table (for Telegram bot users)
  CREATE TABLE IF NOT EXISTS telegram_users (
    telegram_id BIGINT PRIMARY KEY,
    username VARCHAR(100),
    wallet_address VARCHAR(42) UNIQUE NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    last_active TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Wallets Table
  CREATE TABLE IF NOT EXISTS wallets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    public_address VARCHAR(42) NOT NULL,
    encrypted_private_key TEXT NOT NULL,
    balance DECIMAL(18, 6) DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Auth Tokens Table (Magic Links)
  CREATE TABLE IF NOT EXISTS auth_tokens (
    token VARCHAR(255) PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    used BOOLEAN DEFAULT FALSE
  );

  -- User Positions Table (Track bets)
  CREATE TABLE IF NOT EXISTS positions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    market_id INTEGER NOT NULL,
    side VARCHAR(3) NOT NULL CHECK (side IN ('YES', 'NO')),
    shares DECIMAL(18, 6) NOT NULL,
    cost_basis DECIMAL(18, 6) NOT NULL,
    tx_hash VARCHAR(66),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Trades Table (Granular trade history for PnL)
  CREATE TABLE IF NOT EXISTS trades (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    market_id INTEGER NOT NULL,
    user_address VARCHAR(42) NOT NULL,
    side VARCHAR(3) NOT NULL CHECK (side IN ('YES', 'NO')),
    shares DECIMAL(18, 6) NOT NULL,
    price_per_share DECIMAL(18, 6) NOT NULL,
    total_cost DECIMAL(18, 6) NOT NULL,
    tx_hash VARCHAR(66),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Transactions Table (Deposits, Withdrawals, Bets)
  CREATE TABLE IF NOT EXISTS transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL CHECK (type IN ('DEPOSIT', 'WITHDRAW', 'BET', 'CLAIM')),
    amount DECIMAL(18, 6) NOT NULL,
    tx_hash VARCHAR(66),
    status VARCHAR(20) DEFAULT 'PENDING',
    metadata JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- WhatsApp Transactions Table (Bot-specific transactions)
  CREATE TABLE IF NOT EXISTS whatsapp_transactions (
    id SERIAL PRIMARY KEY,
    phone_number VARCHAR(20) REFERENCES whatsapp_users(phone_number),
    type VARCHAR(20) NOT NULL,
    market_id INTEGER,
    side VARCHAR(3),
    amount DECIMAL(18, 6) NOT NULL,
    tx_hash VARCHAR(66),
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Telegram Transactions Table (Telegram bot-specific transactions)
  CREATE TABLE IF NOT EXISTS telegram_transactions (
    id SERIAL PRIMARY KEY,
    telegram_id BIGINT REFERENCES telegram_users(telegram_id),
    type VARCHAR(20) NOT NULL,
    market_id INTEGER,
    outcome INTEGER,
    amount DECIMAL(18, 6) NOT NULL,
    shares DECIMAL(18, 6), -- Added for PnL calculation
    tx_hash VARCHAR(66),
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Price History Table (for charts)
  CREATE TABLE IF NOT EXISTS price_history (
    id SERIAL PRIMARY KEY,
    market_id INTEGER NOT NULL,
    price INTEGER NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Markets Metadata Table (Dynamic market data)
  CREATE TABLE IF NOT EXISTS markets (
    market_id INTEGER PRIMARY KEY,
    question TEXT NOT NULL,
    description TEXT,
    image TEXT,
    category VARCHAR(50),
    outcome_names JSONB, -- For multi-outcome support
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Market Metadata Table (Alternative name for compatibility)
  CREATE TABLE IF NOT EXISTS market_metadata (
    market_id INTEGER PRIMARY KEY,
    question TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    category_id VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Categories Table
  CREATE TABLE IF NOT EXISTS categories (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Create indexes for performance
  CREATE INDEX IF NOT EXISTS idx_positions_user_id ON positions(user_id);
  CREATE INDEX IF NOT EXISTS idx_positions_market_id ON positions(market_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
  CREATE INDEX IF NOT EXISTS idx_price_history_market_id ON price_history(market_id);
  CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON price_history(recorded_at);
  CREATE INDEX IF NOT EXISTS idx_whatsapp_wallet ON whatsapp_users(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_whatsapp_tx_phone ON whatsapp_transactions(phone_number);
  CREATE INDEX IF NOT EXISTS idx_whatsapp_tx_hash ON whatsapp_transactions(tx_hash);
  CREATE INDEX IF NOT EXISTS idx_telegram_wallet ON telegram_users(wallet_address);
  CREATE INDEX IF NOT EXISTS idx_telegram_tx_user ON telegram_transactions(telegram_id);
  CREATE INDEX IF NOT EXISTS idx_telegram_tx_hash ON telegram_transactions(tx_hash);
`;

export const initDatabase = async () => {
  try {
    console.log('Initializing Database Schema...');
    await query(createTablesQuery);

    // Migrations for existing tables
    await query(`
      ALTER TABLE users ADD COLUMN IF NOT EXISTS display_name VARCHAR(100);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      ALTER TABLE users ALTER COLUMN phone_number DROP NOT NULL;
      ALTER TABLE users ALTER COLUMN phone_number DROP NOT NULL;
      ALTER TABLE telegram_transactions ADD COLUMN IF NOT EXISTS shares DECIMAL(18, 6);
      ALTER TABLE whatsapp_users ADD COLUMN IF NOT EXISTS username VARCHAR(100);

      -- Migration for Comments (Replies)
      ALTER TABLE comments ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES comments(id) ON DELETE CASCADE;

      -- Migration for Markets (Add Missing Columns)
      ALTER TABLE markets ADD COLUMN IF NOT EXISTS resolved BOOLEAN DEFAULT FALSE;
      ALTER TABLE markets ADD COLUMN IF NOT EXISTS end_time TIMESTAMP WITH TIME ZONE;
      ALTER TABLE markets ADD COLUMN IF NOT EXISTS winning_outcome INTEGER;

      -- Create Comment Likes Table
      CREATE TABLE IF NOT EXISTS comment_likes (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        comment_id UUID REFERENCES comments(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        is_like BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(comment_id, user_id)
      );
    `);

    console.log('✅ Database Initialization Complete');
  } catch (error) {
    console.error('❌ Database Initialization Failed:', error);
    // We don't exit here so the app can still start if DB is transiently down, 
    // but for a strict startup you might want to throw.
  }
};
