// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title PredictionMarketLMSR
 * @dev Binary prediction market using LMSR (Logarithmic Market Scoring Rule)
 * Similar to early Polymarket implementation
 */
contract PredictionMarketLMSR is Ownable, ReentrancyGuard {
    IERC20 public immutable token;
    
    struct Market {
        string question;
        uint256 endTime;
        uint256 yesShares;      // Total YES shares sold
        uint256 noShares;       // Total NO shares sold
        uint256 liquidityParam; // 'b' parameter - controls price sensitivity
        bool resolved;
        bool outcome;
        uint256 subsidyPool;    // Platform's initial liquidity
    }
    
    struct Position {
        uint256 yesShares;
        uint256 noShares;
        bool claimed;
    }
    
    uint256 public marketCount;
    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => Position)) public positions;
    
    // Fee configuration (basis points: 100 = 1%)
    uint256 public platformFee = 100; // 1% default fee
    uint256 public accumulatedFees;
    address public feeRecipient;
    
    // Fixed-point math constants
    uint256 constant PRECISION = 1e18;
    uint256 constant MAX_EXPONENT = 100 * PRECISION;
    uint256 constant FEE_DENOMINATOR = 10000; // For basis points
    
    event MarketCreated(uint256 indexed marketId, string question, uint256 liquidity);
    event SharesPurchased(uint256 indexed marketId, address indexed user, bool isYes, uint256 shares, uint256 cost, uint256 fee);
    event MarketResolved(uint256 indexed marketId, bool outcome);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 amount);
    event FeesWithdrawn(address indexed recipient, uint256 amount);
    event FeeUpdated(uint256 oldFee, uint256 newFee);
    
    constructor(address _token) Ownable(msg.sender) {
        token = IERC20(_token);
        feeRecipient = msg.sender;
    }
    
    /**
     * @dev Create market with initial liquidity subsidy
     * @param _question Market question
     * @param _duration Duration in seconds
     * @param _liquidityParam Liquidity parameter (higher = less price movement)
     * @param _subsidy Initial platform subsidy for liquidity
     */
    function createMarket(
        string memory _question,
        uint256 _duration,
        uint256 _liquidityParam,
        uint256 _subsidy
    ) external onlyOwner returns (uint256) {
        require(_liquidityParam > 0, "Invalid liquidity param");
        
        // Transfer subsidy from owner
        if (_subsidy > 0) {
            require(token.transferFrom(msg.sender, address(this), _subsidy), "Subsidy transfer failed");
        }
        
        uint256 marketId = marketCount++;
        markets[marketId] = Market({
            question: _question,
            endTime: block.timestamp + _duration,
            yesShares: 0,
            noShares: 0,
            liquidityParam: _liquidityParam,
            resolved: false,
            outcome: false,
            subsidyPool: _subsidy
        });
        
        emit MarketCreated(marketId, _question, _liquidityParam);
        return marketId;
    }
    
    /**
     * @dev Buy YES or NO shares
     * @param _marketId Market ID
     * @param _isYes true for YES, false for NO
     * @param _shares Number of shares to buy
     * @param _maxCost Maximum willing to pay (slippage protection)
     */
    function buyShares(
        uint256 _marketId,
        bool _isYes,
        uint256 _shares,
        uint256 _maxCost
    ) external nonReentrant {
        Market storage market = markets[_marketId];
        require(block.timestamp < market.endTime, "Market ended");
        require(!market.resolved, "Market resolved");
        require(_shares > 0, "Shares must be > 0");
        
        // Calculate cost using LMSR
        uint256 cost = calculateCost(_marketId, _isYes, _shares);
        
        // Calculate and add fee
        uint256 fee = (cost * platformFee) / FEE_DENOMINATOR;
        uint256 totalCost = cost + fee;
        require(totalCost <= _maxCost, "Cost exceeds max");
        
        // Transfer payment (cost + fee)
        require(token.transferFrom(msg.sender, address(this), totalCost), "Transfer failed");
        
        // Accumulate fees
        accumulatedFees += fee;
        
        // Update market state
        if (_isYes) {
            market.yesShares += _shares;
            positions[_marketId][msg.sender].yesShares += _shares;
        } else {
            market.noShares += _shares;
            positions[_marketId][msg.sender].noShares += _shares;
        }
        
        emit SharesPurchased(_marketId, msg.sender, _isYes, _shares, cost, fee);
    }
    
    /**
     * @dev Calculate cost to buy shares using LMSR
     * Cost = b * ln(e^((q_yes + shares)/b) + e^(q_no/b)) - b * ln(e^(q_yes/b) + e^(q_no/b))
     */
    function calculateCost(uint256 _marketId, bool _isYes, uint256 _shares) public view returns (uint256) {
        Market storage market = markets[_marketId];
        uint256 b = market.liquidityParam;
        
        // Current cost function value
        uint256 currentCost = costFunction(market.yesShares, market.noShares, b);
        
        // New cost function value after purchase
        uint256 newYes = _isYes ? market.yesShares + _shares : market.yesShares;
        uint256 newNo = _isYes ? market.noShares : market.noShares + _shares;
        uint256 newCost = costFunction(newYes, newNo, b);
        
        return (newCost - currentCost) / PRECISION;
    }
    
    /**
     * @dev LMSR cost function: C(q) = b * ln(e^(q_yes/b) + e^(q_no/b))
     * Simplified using: C(q) = b * ln(2) + b * ln(cosh((q_yes - q_no)/(2b)))
     */
    function costFunction(uint256 qYes, uint256 qNo, uint256 b) internal pure returns (uint256) {
        // Simplified approximation for small markets
        // In production, use proper fixed-point exponential library
        
        if (qYes == 0 && qNo == 0) return 0;
        
        // Linear approximation for demo
        // Real implementation needs exp/ln functions
        uint256 total = qYes + qNo;
        uint256 diff = qYes > qNo ? qYes - qNo : qNo - qYes;
        
        // Cost ≈ total/2 + diff^2/(4*b)
        return (total * PRECISION) / 2 + (diff * diff * PRECISION) / (4 * b);
    }
    
    /**
     * @dev Get current price for YES (in basis points, 0-10000)
     * Price(YES) = e^(q_yes/b) / (e^(q_yes/b) + e^(q_no/b))
     */
    function getPrice(uint256 _marketId) external view returns (uint256) {
        Market storage market = markets[_marketId];
        
        if (market.yesShares == 0 && market.noShares == 0) {
            return 5000; // 50% if no trades
        }
        
        // Simplified: Price ≈ 0.5 + (q_yes - q_no)/(2*b)
        int256 diff = int256(market.yesShares) - int256(market.noShares);
        int256 priceShift = (diff * 5000) / int256(market.liquidityParam);
        int256 price = 5000 + priceShift;
        
        // Clamp to [0, 10000]
        if (price < 0) return 0;
        if (price > 10000) return 10000;
        return uint256(price);
    }
    
    /**
     * @dev Resolve market
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
     * @dev Claim winnings (winners get $1 per share)
     */
    function claimWinnings(uint256 _marketId) external nonReentrant {
        Market storage market = markets[_marketId];
        Position storage position = positions[_marketId][msg.sender];
        
        require(market.resolved, "Not resolved");
        require(!position.claimed, "Already claimed");
        
        uint256 winningShares = market.outcome ? position.yesShares : position.noShares;
        require(winningShares > 0, "No winnings");
        
        position.claimed = true;
        
        // Winners get $1 per share (in 6 decimals for USDC)
        uint256 payout = winningShares * 1e6;
        
        require(token.transfer(msg.sender, payout), "Transfer failed");
        emit WinningsClaimed(_marketId, msg.sender, payout);
    }
    
    /**
     * @dev Get user position
     */
    function getUserPosition(uint256 _marketId, address _user) 
        external 
        view 
        returns (uint256 yesShares, uint256 noShares, bool claimed) 
    {
        Position storage pos = positions[_marketId][_user];
        return (pos.yesShares, pos.noShares, pos.claimed);
    }
    
    // ============ FEE MANAGEMENT ============
    
    /**
     * @dev Withdraw accumulated fees to fee recipient
     */
    function withdrawFees() external {
        require(msg.sender == feeRecipient || msg.sender == owner(), "Not authorized");
        uint256 amount = accumulatedFees;
        require(amount > 0, "No fees to withdraw");
        
        accumulatedFees = 0;
        require(token.transfer(feeRecipient, amount), "Transfer failed");
        
        emit FeesWithdrawn(feeRecipient, amount);
    }
    
    /**
     * @dev Update platform fee (max 5%)
     */
    function setPlatformFee(uint256 _newFee) external onlyOwner {
        require(_newFee <= 500, "Fee cannot exceed 5%");
        uint256 oldFee = platformFee;
        platformFee = _newFee;
        emit FeeUpdated(oldFee, _newFee);
    }
    
    /**
     * @dev Update fee recipient address
     */
    function setFeeRecipient(address _newRecipient) external onlyOwner {
        require(_newRecipient != address(0), "Invalid address");
        feeRecipient = _newRecipient;
    }
    
    /**
     * @dev View pending fees
     */
    function pendingFees() external view returns (uint256) {
        return accumulatedFees;
    }
}
