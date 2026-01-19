// Secure configuration utility
export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

export function getOptionalEnv(key: string, defaultValue: string = ''): string {
  return process.env[key] || defaultValue;
}

export const CONFIG = {
  // Server
  PORT: getOptionalEnv('PORT', '3001'),
  NODE_ENV: getOptionalEnv('NODE_ENV', 'development'),

  // Database
  DATABASE_URL: getRequiredEnv('DATABASE_URL'),

  // Blockchain
  RPC_URL: getRequiredEnv('BNB_RPC_URL'),
  WSS_URL: getOptionalEnv('BNB_WSS_URL'),
  CHAIN_ID: parseInt(getOptionalEnv('CHAIN_ID', '56')),

  // Contracts
  MARKET_CONTRACT: getRequiredEnv('MARKET_CONTRACT'),
  USDC_CONTRACT: process.env.USDC_CONTRACT || '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // BSC Mainnet USDC
  MULTI_MARKET_ADDRESS: getRequiredEnv('MULTI_MARKET_ADDRESS'),

  // Security
  PRIVATE_KEY: getRequiredEnv('PRIVATE_KEY'),
  ENCRYPTION_KEY: getRequiredEnv('ENCRYPTION_KEY'),
  JWT_SECRET: getRequiredEnv('JWT_SECRET'),
  ADMIN_SECRET: getRequiredEnv('ADMIN_SECRET'),

  // CORS
  ALLOWED_ORIGINS: getOptionalEnv('ALLOWED_ORIGINS', '').split(',').filter(Boolean),
};