import dotenv from 'dotenv';

// Ensure env vars are loaded
dotenv.config();

function getEnv(key: string, fallback?: string): string {
    const value = process.env[key];
    if (!value) {
        if (fallback) return fallback;
        console.warn(`⚠️ Missing env var: ${key}`);
        return '';
    }
    return value;
}

export const CONFIG = {
    // Market contract - check multiple possible env var names
    MARKET_CONTRACT: getEnv('NEXT_PUBLIC_MARKET_ADDRESS') || getEnv('MARKET_CONTRACT') || getEnv('MARKET_ADDRESS') || getEnv('MULTI_MARKET_ADDRESS', ''),
    // USDC contract
    USDC_CONTRACT: getEnv('NEXT_PUBLIC_USDC_CONTRACT') || getEnv('USDC_CONTRACT') || getEnv('USDC_ADDRESS', '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'),
    // RPC URL - Use FREE public endpoints for backend to avoid quota issues
    // Priority order: env var > free public endpoints
    RPC_URL: getEnv('BNB_RPC_URL') ||
        getEnv('NEXT_PUBLIC_RPC_URL') ||
        'https://bsc-dataseed.bnbchain.org', // Official BSC public endpoint (no rate limit for light usage)
    // WebSocket URL
    WSS_URL: getEnv('BNB_WSS_URL'),
    // Chain ID
    CHAIN_ID: parseInt(getEnv('NEXT_PUBLIC_CHAIN_ID') || getEnv('CHAIN_ID', '56')),
    // Alias for backwards compatibility
    MULTI_MARKET_ADDRESS: getEnv('NEXT_PUBLIC_MARKET_ADDRESS') || getEnv('MARKET_CONTRACT') || getEnv('MARKET_ADDRESS') || getEnv('MULTI_MARKET_ADDRESS', ''),
};

console.log('✅ Contract Configuration Loaded:');
console.log('   - Market:', CONFIG.MARKET_CONTRACT);
console.log('   - USDC:', CONFIG.USDC_CONTRACT);
console.log('   - RPC:', CONFIG.RPC_URL);
console.log('   - Chain ID:', CONFIG.CHAIN_ID);
