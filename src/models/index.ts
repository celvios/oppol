import { query } from '../config/database';

const createTablesQuery = `
  -- Enable UUID extension
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  -- Users Table
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(50) UNIQUE NOT NULL,
    wallet_address VARCHAR(42),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
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

  -- Price History Table (for charts)
  CREATE TABLE IF NOT EXISTS price_history (
    id SERIAL PRIMARY KEY,
    market_id INTEGER NOT NULL,
    price INTEGER NOT NULL,
    recorded_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
  );

  -- Create indexes for performance
  CREATE INDEX IF NOT EXISTS idx_positions_user_id ON positions(user_id);
  CREATE INDEX IF NOT EXISTS idx_positions_market_id ON positions(market_id);
  CREATE INDEX IF NOT EXISTS idx_transactions_user_id ON transactions(user_id);
  CREATE INDEX IF NOT EXISTS idx_wallets_user_id ON wallets(user_id);
  CREATE INDEX IF NOT EXISTS idx_price_history_market_id ON price_history(market_id);
  CREATE INDEX IF NOT EXISTS idx_price_history_recorded_at ON price_history(recorded_at);
`;

export const initDatabase = async () => {
  try {
    console.log('Initializing Database Schema...');
    await query(createTablesQuery);
    console.log('✅ Database Initialization Complete');
  } catch (error) {
    console.error('❌ Database Initialization Failed:', error);
    // We don't exit here so the app can still start if DB is transiently down, 
    // but for a strict startup you might want to throw.
  }
};
