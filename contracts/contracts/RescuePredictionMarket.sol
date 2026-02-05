// SPDX-License-Identifier: MIT
pragma solidity ^0.8.22;

import "./PredictionMarketMulti.sol";

contract RescuePredictionMarket is PredictionMarketMulti {
    
    /**
     * @dev Rescue funds from user balance to admin (for migration/recovery)
     */
    function rescueFunds(address user, uint256 amount) external onlyOwner {
        require(userBalances[user] >= amount, "Insufficient balance");
        userBalances[user] -= amount;
        require(token.transfer(msg.sender, amount), "Transfer failed");
    }
}
