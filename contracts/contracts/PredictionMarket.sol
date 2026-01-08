// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PredictionMarket
 * @dev Binary prediction market for OPOLL platform
 */
contract PredictionMarket is Ownable, ReentrancyGuard {
    IERC20 public immutable token; // USDC or stablecoin
    
    struct Market {
        string question;
        uint256 endTime;
        uint256 yesPool;
        uint256 noPool;
        bool resolved;
        bool outcome; // true = YES wins, false = NO wins
        uint256 totalYesShares;
        uint256 totalNoShares;
    }
    
    struct Position {
        uint256 yesShares;
        uint256 noShares;
        bool claimed;
    }
    
    uint256 public marketCount;
    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => Position)) public positions;
    
    event MarketCreated(uint256 indexed marketId, string question, uint256 endTime);
    event BetPlaced(uint256 indexed marketId, address indexed user, bool isYes, uint256 amount, uint256 shares);
    event MarketResolved(uint256 indexed marketId, bool outcome);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 amount);
    
    constructor(address _token) Ownable(msg.sender) {
        token = IERC20(_token);
    }
    
    /**
     * @dev Create a new prediction market
     */
    function createMarket(string memory _question, uint256 _duration) external onlyOwner returns (uint256) {
        uint256 marketId = marketCount++;
        markets[marketId] = Market({
            question: _question,
            endTime: block.timestamp + _duration,
            yesPool: 0,
            noPool: 0,
            resolved: false,
            outcome: false,
            totalYesShares: 0,
            totalNoShares: 0
        });
        
        emit MarketCreated(marketId, _question, block.timestamp + _duration);
        return marketId;
    }
    
    /**
     * @dev Place a bet on YES or NO
     */
    function placeBet(uint256 _marketId, bool _isYes, uint256 _amount) external nonReentrant {
        Market storage market = markets[_marketId];
        require(block.timestamp < market.endTime, "Market ended");
        require(!market.resolved, "Market resolved");
        require(_amount > 0, "Amount must be > 0");
        
        // Transfer tokens from user
        require(token.transferFrom(msg.sender, address(this), _amount), "Transfer failed");
        
        // Calculate shares using constant product formula
        uint256 shares = calculateShares(_marketId, _isYes, _amount);
        
        // Update pools and shares
        if (_isYes) {
            market.yesPool += _amount;
            market.totalYesShares += shares;
            positions[_marketId][msg.sender].yesShares += shares;
        } else {
            market.noPool += _amount;
            market.totalNoShares += shares;
            positions[_marketId][msg.sender].noShares += shares;
        }
        
        emit BetPlaced(_marketId, msg.sender, _isYes, _amount, shares);
    }
    
    /**
     * @dev Calculate shares based on AMM formula
     */
    function calculateShares(uint256 _marketId, bool _isYes, uint256 _amount) public view returns (uint256) {
        Market storage market = markets[_marketId];
        
        if (_isYes) {
            if (market.totalYesShares == 0) return _amount; // First bet
            // k = yesPool * totalYesShares (constant product)
            uint256 k = market.yesPool * market.totalYesShares;
            uint256 newPool = market.yesPool + _amount;
            uint256 newShares = k / newPool;
            return market.totalYesShares - newShares;
        } else {
            if (market.totalNoShares == 0) return _amount;
            uint256 k = market.noPool * market.totalNoShares;
            uint256 newPool = market.noPool + _amount;
            uint256 newShares = k / newPool;
            return market.totalNoShares - newShares;
        }
    }
    
    /**
     * @dev Resolve market (only owner/oracle)
     */
    function resolveMarket(uint256 _marketId, bool _outcome) external onlyOwner {
        Market storage market = markets[_marketId];
        require(block.timestamp >= market.endTime, "Market not ended");
        require(!market.resolved, "Already resolved");
        
        market.resolved = true;
        market.outcome = _outcome;
        
        emit MarketResolved(_marketId, _outcome);
    }
    
    /**
     * @dev Claim winnings
     */
    function claimWinnings(uint256 _marketId) external nonReentrant {
        Market storage market = markets[_marketId];
        Position storage position = positions[_marketId][msg.sender];
        
        require(market.resolved, "Market not resolved");
        require(!position.claimed, "Already claimed");
        
        uint256 payout = 0;
        
        if (market.outcome) {
            // YES won
            if (position.yesShares > 0) {
                uint256 totalPool = market.yesPool + market.noPool;
                payout = (position.yesShares * totalPool) / market.totalYesShares;
            }
        } else {
            // NO won
            if (position.noShares > 0) {
                uint256 totalPool = market.yesPool + market.noPool;
                payout = (position.noShares * totalPool) / market.totalNoShares;
            }
        }
        
        require(payout > 0, "No winnings");
        position.claimed = true;
        
        require(token.transfer(msg.sender, payout), "Transfer failed");
        emit WinningsClaimed(_marketId, msg.sender, payout);
    }
    
    /**
     * @dev Get current market odds (price of YES in percentage)
     */
    function getMarketOdds(uint256 _marketId) external view returns (uint256) {
        Market storage market = markets[_marketId];
        uint256 totalPool = market.yesPool + market.noPool;
        if (totalPool == 0) return 50; // 50% if no bets
        return (market.noPool * 100) / totalPool; // Simplified probability
    }
    
    /**
     * @dev Get user position
     */
    function getUserPosition(uint256 _marketId, address _user) external view returns (uint256 yesShares, uint256 noShares, bool claimed) {
        Position storage pos = positions[_marketId][_user];
        return (pos.yesShares, pos.noShares, pos.claimed);
    }
}
