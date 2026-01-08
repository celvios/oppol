import { query } from '../config/database';

const createTablesQuery = `
  -- Enable UUID extension
  CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

  -- Users Table
  CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phone_number VARCHAR(50) UNIQUE NOT NULL,
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
