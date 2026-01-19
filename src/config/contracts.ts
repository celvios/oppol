import dotenv from 'dotenv';

// Ensure env vars are loaded
dotenv.config();

export const CONFIG = {
    MARKET_CONTRACT: getRequiredEnv('MARKET_CONTRACT'),
    USDC_CONTRACT: getRequiredEnv('USDC_CONTRACT'),
    RPC_URL: getRequiredEnv('BNB_RPC_URL'),
    MULTI_MARKET_ADDRESS: getRequiredEnv('MARKET_CONTRACT'),
};

function getRequiredEnv(key: string): string {
    const value = process.env[key] || process.env['MULTI_MARKET_ADDRESS'];
    if (!value) {
        throw new Error(`❌ FATAL CONFIG ERROR: Missing required environment variable '${key}'. Please set it in your .env file.`);
    }
    return value;
}

console.log('✅ Contract Configuration Loaded:');
console.log('   - Market:', CONFIG.MARKET_CONTRACT);
console.log('   - USDC:', CONFIG.USDC_CONTRACT);
