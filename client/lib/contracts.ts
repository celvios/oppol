// Contract addresses (update after deployment)
export const CONTRACTS = {
    // Local Hardhat
    local: {
        predictionMarket: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', // Old AMM (deprecated)
        predictionMarketLMSR: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', // New LMSR ✅
        mockUSDC: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    },
    // BSC Testnet (DEPLOYED ✅ - With Zap System)
    bscTestnet: {
        predictionMarket: '0x57f3E8D7543ba4008708B80116aB7FAcc7D265e5',
        predictionMarketLMSR: '0x57f3E8D7543ba4008708B80116aB7FAcc7D265e5',
        mockUSDC: '0xA4FbcEe08b7AAA2F59D3469C0f28A32588740dc7',
        umaOracle: '0x930D7cebd451B334f9DdF3d89deC931CFf588195',
        zap: '0x358e8405FCC01Ea93a1422A667f62eec17Fb08cF7',
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
