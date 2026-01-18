// Contract addresses (update after deployment)
export const CONTRACTS = {
    // Local Hardhat
    local: {
        predictionMarket: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        predictionMarketLMSR: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        predictionMarketMulti: '0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512',
        mockUSDC: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
    },
    // BSC Testnet (UNIFIED - Multi-Outcome Contract ✅) - V2.1 Fixed LMSR UUPS
    bscTestnet: {
        // All markets now use the multi-outcome contract (Polymarket-style)
        predictionMarket: process.env.NEXT_PUBLIC_BSCTESTNET_MARKET_ADDRESS || '0x221C4CFADE97b5d3D8C1016C3FbAe3C23eC79772',
        predictionMarketLMSR: process.env.NEXT_PUBLIC_BSCTESTNET_MARKET_ADDRESS || '0x221C4CFADE97b5d3D8C1016C3FbAe3C23eC79772',
        predictionMarketMulti: process.env.NEXT_PUBLIC_BSCTESTNET_MARKET_ADDRESS || '0x221C4CFADE97b5d3D8C1016C3FbAe3C23eC79772',
        mockUSDC: process.env.NEXT_PUBLIC_BSCTESTNET_USDC_ADDRESS || '0xa7d8e3da8CAc0083B46584F416b98AB934a1Ed0b',
        umaOracle: process.env.NEXT_PUBLIC_BSCTESTNET_UMA_ORACLE_ADDRESS || '0x8CFc696db36429Ff2D0C601c523F88AE8c30D1cd',
        zap: process.env.NEXT_PUBLIC_BSCTESTNET_ZAP_ADDRESS || '0x315640C6eb0635B0A7717b8345b0FB4c2a10157D',
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
