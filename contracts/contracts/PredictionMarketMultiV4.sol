// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PredictionMarketMultiV3.sol";

/**
 * @title PredictionMarketMultiV4
 * @dev Adds data repair mechanisms and safety valves.
 */
contract PredictionMarketMultiV4 is PredictionMarketMultiV3 {
    
    event MarketDataFixed(uint256 indexed marketId, uint256 newLiquidityParam);
    
    /**
     * @dev Fix market liquidity parameter if it was set incorrectly.
     * Use this to repair markets showing 0% chance due to scaling issues.
     * @param marketId The market to fix
     * @param newLiquidityParam The new liquidity parameter (e.g. 200 * 1e6 for 2 outcomes)
     */
    function fixMarketLiquidity(uint256 marketId, uint256 newLiquidityParam) external onlyOwner {
        require(marketId < marketCount, "Invalid market ID");
        Market storage market = markets[marketId];
        market.liquidityParam = newLiquidityParam;
        emit MarketDataFixed(marketId, newLiquidityParam);
    }

    /**
     * @dev Emergency resolve a market if it's stuck or disputed.
     */
    function emergencyResolve(uint256 marketId, uint256 winningOutcome) external onlyOwner {
        require(marketId < marketCount, "Invalid market ID");
        Market storage market = markets[marketId];
        require(!market.resolved, "Already resolved");
        
        market.resolved = true;
        market.winningOutcome = winningOutcome;
        
        emit MarketResolvedEvent(marketId, winningOutcome);
    }

    /**
     * @dev Deduct a gas fee from a user's deposited balance and transfer it to the caller (operator/relayer).
     * This allows the relayer to recover Pimlico/BNB gas costs from any user's balance —
     * without requiring that user's private key. Works for both custodial (Google) and
     * external (MetaMask) wallet users.
     * @param user  The user whose balance is debited
     * @param amount  Gas fee in 18-decimal USDC
     */
    function sweepGasFeeFor(address user, uint256 amount) external onlyOperator {
        require(amount > 0, "Amount must be > 0");
        require(userBalances[user] >= amount, "Insufficient balance for gas fee");
        userBalances[user] -= amount;
        require(token.transfer(msg.sender, amount), "Gas fee transfer failed");
    }
}
