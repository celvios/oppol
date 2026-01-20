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
    MARKET_CONTRACT: getEnv('MARKET_CONTRACT') || getEnv('MARKET_ADDRESS') || getEnv('MULTI_MARKET_ADDRESS', ''),
    // USDC contract - DO NOT fallback to market address!
    USDC_CONTRACT: getEnv('USDC_CONTRACT') || getEnv('USDC_ADDRESS', '0x87D45E316f5f1f2faffCb600c97160658B799Ee0'),
    // RPC URL - default to BSC Testnet
    RPC_URL: getEnv('BNB_RPC_URL', 'https://bsc-rpc.publicnode.com'),
    // Chain ID - default to BSC Testnet (97)
    CHAIN_ID: parseInt(getEnv('CHAIN_ID', '97')),
    // Alias for backwards compatibility
    MULTI_MARKET_ADDRESS: getEnv('MARKET_CONTRACT') || getEnv('MARKET_ADDRESS') || getEnv('MULTI_MARKET_ADDRESS', ''),
};

console.log('✅ Contract Configuration Loaded:');
console.log('   - Market:', CONFIG.MARKET_CONTRACT);
console.log('   - USDC:', CONFIG.USDC_CONTRACT);
console.log('   - RPC:', CONFIG.RPC_URL);
console.log('   - Chain ID:', CONFIG.CHAIN_ID);
