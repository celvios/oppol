// Contract addresses (update after deployment)
export const CONTRACTS = {
    // Local Hardhat
    local: {
        predictionMarket: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        predictionMarketLMSR: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        predictionMarketMulti: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        mockUSDC: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    },
    // BSC Testnet (UNIFIED - Multi-Outcome Contract ✅)
    bscTestnet: {
        // All markets now use the multi-outcome contract (Polymarket-style)
        predictionMarket: '0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6',
        predictionMarketLMSR: '0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6',
        predictionMarketMulti: '0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6',
        mockUSDC: '0x5931e7b7a700037Fe62b876e28AD7F64dce14d11', // ✅ Redeployed 2026-01-15
        umaOracle: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd',
        zap: '0x315640C6eb0635B0A7717b8345b0FB4c2a10157D',
    },
    // BSC Mainnet
    bsc: {
        predictionMarket: '',
        usdc: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', // Real USDC on BSC
    },
};

// Network configuration
export const NETWORKS = {
    hardhat: {
        chainId: 1337,
        name: 'Hardhat',
        rpcUrl: 'http://127.0.0.1:8545',
    },
    bscTestnet: {
        chainId: 97,
        name: 'BSC Testnet',
        rpcUrl: 'https://bsc-testnet-rpc.publicnode.com',
    },
    bsc: {
        chainId: 56,
        name: 'BNB Chain',
        rpcUrl: 'https://bsc-dataseed.binance.org/',
    },
};

// Get current network (default to BSC Testnet for now)
export const getCurrentNetwork = () => {
    const env = process.env.NEXT_PUBLIC_NETWORK || 'bscTestnet';
    return NETWORKS[env as keyof typeof NETWORKS];
};

// Get contract addresses for current network
export const getContracts = () => {
    const env = process.env.NEXT_PUBLIC_NETWORK || 'bscTestnet';
    return CONTRACTS[env as keyof typeof CONTRACTS];
};
