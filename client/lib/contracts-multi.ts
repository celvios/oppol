// Multi-Outcome Prediction Market Contract Configuration

export const MULTI_CONTRACTS = {
    // BSC Testnet (DEPLOYED ✅)
    bscTestnet: {
        predictionMarketMulti: "0xB6a211822649a61163b94cf46e6fCE46119D3E1b",
        mockUSDC: "0x87D45E316f5f1f2faffCb600c97160658B799Ee0",
        umaOracle: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
    },
    // Local Hardhat
    local: {
        predictionMarketMulti: "",
        mockUSDC: "0x5FbDB2315678afecb367f032d93F642f64180aa3",
    },
    // BSC Mainnet (TODO)
    bsc: {
        predictionMarketMulti: "",
        usdc: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d",
    },
};

export const getMultiContracts = () => {
    const env = process.env.NEXT_PUBLIC_NETWORK || 'bscTestnet';
    return MULTI_CONTRACTS[env as keyof typeof MULTI_CONTRACTS];
};

// ABI for PredictionMarketMulti
export const PREDICTION_MARKET_MULTI_ABI = [
    'function marketCount() view returns (uint256)',
    'function getMarketBasicInfo(uint256 marketId) view returns (string question, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome)',
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
];
