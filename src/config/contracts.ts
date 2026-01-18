import dotenv from 'dotenv';

// Ensure env vars are loaded
dotenv.config();

export const CONFIG = {
    MARKET_CONTRACT: getRequiredEnv('MARKET_CONTRACT'),
    USDC_CONTRACT: getRequiredEnv('USDC_CONTRACT'),
    RPC_URL: process.env.BNB_RPC_URL || 'https://bsc-testnet-rpc.publicnode.com', // RPC can have a default public node
    MULTI_MARKET_ADDRESS: getRequiredEnv('MARKET_CONTRACT'), // Alias for compatibility
};

function getRequiredEnv(key: string): string {
    const value = process.env[key] || process.env['MULTI_MARKET_ADDRESS']; // Check alias
    if (!value) {
        throw new Error(`❌ FATAL CONFIG ERROR: Missing environment variable '${key}'. No hardcoded fallbacks allowed.`);
    }
    return value;
}

console.log('✅ Contract Configuration Loaded:');
console.log('   - Market:', CONFIG.MARKET_CONTRACT);
console.log('   - USDC:', CONFIG.USDC_CONTRACT);
