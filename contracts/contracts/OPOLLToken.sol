// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title OPOLLToken
 * @dev Platform governance token for OPOLL prediction market
 * Holders with 50M+ tokens can access admin features
 */
contract OPOLLToken is ERC20, Ownable {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000 * 10**18; // 1 billion tokens
    uint256 public constant ADMIN_THRESHOLD = 50_000_000 * 10**18; // 50 million tokens

    constructor() ERC20("OPOLL", "OPOLL") Ownable(msg.sender) {
        _mint(msg.sender, TOTAL_SUPPLY);
    }

    /**
     * @dev Check if an address qualifies as admin (50M+ tokens)
     */
    function isAdmin(address account) external view returns (bool) {
        return balanceOf(account) >= ADMIN_THRESHOLD;
    }

    /**
     * @dev Burn tokens (optional governance feature)
     */
    function burn(uint256 amount) external {
        _burn(msg.sender, amount);
    }
}
