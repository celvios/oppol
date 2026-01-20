// Environment-driven configuration matching Render setup
// All values must be supplied via process.env

const getEnv = (key: string, fallback?: string): string => {
    const val = process.env[key];
    if (!val) {
        if (fallback) return fallback;
        console.warn(`⚠️ Missing env var: ${key}`);
        return '';
    }
    return val;
};

export const CONTRACTS = {
    predictionMarket: getEnv('NEXT_PUBLIC_MARKET_ADDRESS', '0xA7DEd30e8A292dAA8e75A8d288393f8e290f9717'),
    predictionMarketMulti: getEnv('NEXT_PUBLIC_MARKET_ADDRESS', '0xA7DEd30e8A292dAA8e75A8d288393f8e290f9717'),
    mockUSDC: getEnv('NEXT_PUBLIC_USDC_CONTRACT', '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'),
    usdc: getEnv('NEXT_PUBLIC_USDC_CONTRACT', '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'),
    zap: getEnv('NEXT_PUBLIC_ZAP_ADDRESS', ''),
    oracle: getEnv('NEXT_PUBLIC_ORACLE_ADDRESS', '')
};

export const NETWORK = {
    chainId: Number(process.env.NEXT_PUBLIC_CHAIN_ID || 56), // Default to BSC Mainnet
    name: process.env.NEXT_PUBLIC_NETWORK_NAME || 'BNB Smart Chain',
    rpcUrl: process.env.NEXT_PUBLIC_RPC_URL || 'https://bsc-rpc.publicnode.com',
    explorer: process.env.NEXT_PUBLIC_EXPLORER_URL || 'https://bscscan.com'
};

// Backwards compatibility alias
export const getContracts = () => CONTRACTS;
export const getCurrentNetwork = () => NETWORK;

