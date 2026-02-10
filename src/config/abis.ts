/**
 * ABI definitions for contracts
 */

export const MARKET_ABI = [
    "function marketCount() view returns (uint256)",
    "function getMarketBasicInfo(uint256) view returns (string question, string image, string description, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome)",
    "function getMarketOutcomes(uint256) view returns (string[])",
    "function getAllPrices(uint256) view returns (uint256[])",
    "function getMarketShares(uint256) view returns (uint256[])",
    "event SharesPurchased(uint256 indexed marketId, address indexed user, uint256 outcomeIndex, uint256 shares, uint256 cost)"
];
