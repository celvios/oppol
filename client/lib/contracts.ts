// Contract addresses (update after deployment)
export const CONTRACTS = {
    // Local Hardhat
    local: {
        predictionMarket: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', // Old AMM (deprecated)
        predictionMarketLMSR: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512', // New LMSR ✅
        mockUSDC: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    },
    // BSC Testnet (DEPLOYED ✅ - With UMA Oracle + Markets)
    bscTestnet: {
        predictionMarket: process.env.NEXT_PUBLIC_MARKET_ADDRESS || '0xbBE2811Ab064bd76667D49346a025530310AD03E', // New Custodial Contract
        predictionMarketLMSR: process.env.NEXT_PUBLIC_MARKET_ADDRESS || '0xbBE2811Ab064bd76667D49346a025530310AD03E', // Same
        mockUSDC: '0x792D979781F0E53A51D0cD837cd03827fA8d83A1', // Old USDC with your balance
        umaOracle: '0x337610d27c682E347C9cD60BD4b3b107C9d34dDd', // UMA OOv3
        zap: '0x315640C6eb0635B0A7717b8345b0FB4c2a10157D', // Old Zap
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
