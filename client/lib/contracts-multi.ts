// Multi-Outcome Prediction Market Contract Configuration

export const MULTI_CONTRACTS = {
    // BSC Testnet - Strict Env
    bscTestnet: {
        predictionMarketMulti: process.env.NEXT_PUBLIC_BSCTESTNET_MARKET_ADDRESS || process.env.NEXT_PUBLIC_MARKET_ADDRESS || "0xA7DEd30e8A292dAA8e75A8d288393f8e290f9717",
        mockUSDC: process.env.NEXT_PUBLIC_BSCTESTNET_USDC_ADDRESS || process.env.NEXT_PUBLIC_USDC_ADDRESS || "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
        umaOracle: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
    },
    // Local Hardhat
    local: {
        predictionMarketMulti: "",
        mockUSDC: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    },
    // BSC Mainnet
    bsc: {
        predictionMarketMulti: process.env.NEXT_PUBLIC_MARKET_ADDRESS || "0xA7DEd30e8A292dAA8e75A8d288393f8e290f9717",
        usdc: process.env.NEXT_PUBLIC_USDC_CONTRACT || "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    },
};

export const getMultiContracts = () => {
    const env = process.env.NEXT_PUBLIC_NETWORK || 'bsc';
    return MULTI_CONTRACTS[env as keyof typeof MULTI_CONTRACTS];
};

// ABI for PredictionMarketMulti
export const PREDICTION_MARKET_MULTI_ABI = [
    'function marketCount() view returns (uint256)',
    'function getMarketBasicInfo(uint256 marketId) view returns (string question, string image, string description, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome)',
    'function getMarketOutcomes(uint256 marketId) view returns (string[])',
    'function getMarketShares(uint256 marketId) view returns (uint256[])',
    'function getAllPrices(uint256 marketId) view returns (uint256[])',
    'function getPrice(uint256 marketId, uint256 outcomeIndex) view returns (uint256)',
    'function calculateCost(uint256 marketId, uint256 outcomeIndex, uint256 shares) view returns (uint256)',
    'function buyShares(uint256 marketId, uint256 outcomeIndex, uint256 shares, uint256 maxCost)',
    'function getUserPosition(uint256 marketId, address user) view returns (uint256[] shares, bool claimed)',
    'function userBalances(address) view returns (uint256)',
    'function deposit(uint256 amount)',
    'function withdraw(uint256 amount)',
    'function claimWinnings(uint256 marketId)',
    'function getMarketStatus(uint256 marketId) view returns (bool ended, bool assertionPending, bool resolved, uint256 winningOutcome, address asserter, bytes32 assertionId)',
    'function createMarket(string question, string image, string description, string[] outcomes, uint256 durationDays) external returns (uint256)',
];
