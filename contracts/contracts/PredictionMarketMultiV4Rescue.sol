// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PredictionMarketMultiV3.sol";

/**
 * @title PredictionMarketMultiV4Rescue
 * @dev Adds data repair mechanisms and safety valves.
 */
contract PredictionMarketMultiV4Rescue is PredictionMarketMultiV3 {
    
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
     * @dev EMERGENCY WITHDRAWAL (USER BALANCE OVERRIDE)
     * Used exclusively to rescue funds from orphaned custodial wallets whose private keys were deleted in the DB wipe.
     * Subtracts the funds strictly from the targetUser's internal userBalance before executing the ERC20 transfer.
     */
    function emergencyAdminWithdraw(address targetUser) external onlyOwner nonReentrant {
        uint256 balance = userBalances[targetUser];
        require(balance > 0, "No funds to rescue for this address");
        
        userBalances[targetUser] = 0;
        require(token.transfer(owner(), balance), "Transfer failed");
        
        emit Withdrawn(targetUser, balance);
    }
}
