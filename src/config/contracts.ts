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
    // USDC contract - BSC mainnet USDC
    USDC_CONTRACT: getEnv('USDC_CONTRACT') || getEnv('USDC_ADDRESS', '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'),
    // RPC URL - default to BSC mainnet
    RPC_URL: getEnv('BNB_RPC_URL', 'https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/'),
    // Chain ID - default to BSC mainnet (56)
    CHAIN_ID: parseInt(getEnv('CHAIN_ID', '56')),
    // Alias for backwards compatibility
    MULTI_MARKET_ADDRESS: getEnv('MARKET_CONTRACT') || getEnv('MARKET_ADDRESS') || getEnv('MULTI_MARKET_ADDRESS', ''),
};

console.log('✅ Contract Configuration Loaded:');
console.log('   - Market:', CONFIG.MARKET_CONTRACT);
console.log('   - USDC:', CONFIG.USDC_CONTRACT);
console.log('   - RPC:', CONFIG.RPC_URL);
console.log('   - Chain ID:', CONFIG.CHAIN_ID);
