// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract PredictionMarketV2 is Ownable, ReentrancyGuard {
    IERC20 public immutable token;
    
    mapping(address => bool) public operators;
    
    struct Market {
        string question;
        uint256 endTime;
        uint256 yesShares;
        uint256 noShares;
        uint256 liquidityParam;
        bool resolved;
        bool outcome;
        uint256 subsidyPool;
    }
    
    struct Position {
        uint256 yesShares;
        uint256 noShares;
        bool claimed;
    }
    
    uint256 public marketCount;
    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => Position)) public positions;
    mapping(address => uint256) public userBalances;

    uint256 constant PRECISION = 1e18;
    uint256 constant MAX_EXPONENT = 100 * PRECISION;

    event MarketCreated(uint256 indexed marketId, string question, uint256 liquidity);
    event SharesPurchased(uint256 indexed marketId, address indexed user, bool isYes, uint256 shares, uint256 cost);
    event MarketResolved(uint256 indexed marketId, bool outcome);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 amount);
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event OperatorUpdated(address indexed operator, bool status);
    
    modifier onlyOperator() {
        require(operators[msg.sender] || msg.sender == owner(), "Not operator");
        _;
    }
    
    constructor(address _token) Ownable(msg.sender) {
        token = IERC20(_token);
        operators[msg.sender] = true;
    }
    
    function setOperator(address _operator, bool _status) external onlyOwner {
        operators[_operator] = _status;
        emit OperatorUpdated(_operator, _status);
    }

    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        userBalances[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    function depositFor(address beneficiary, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        userBalances[beneficiary] += amount;
        emit Deposited(beneficiary, amount);
    }

    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(userBalances[msg.sender] >= amount, "Insufficient balance");
        userBalances[msg.sender] -= amount;
        require(token.transfer(msg.sender, amount), "Transfer failed");
        emit Withdrawn(msg.sender, amount);
    }
    
    function createMarket(
        string memory _question,
        uint256 _duration,
        uint256 _liquidityParam,
        uint256 _subsidy
    ) external onlyOwner returns (uint256) {
        require(_liquidityParam > 0, "Invalid liquidity param");
        
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

    function createMarket(string memory _question, uint256 _duration) external onlyOwner returns (uint256) {
        uint256 marketId = marketCount++;
        markets[marketId] = Market({
            question: _question,
            endTime: block.timestamp + _duration,
            yesShares: 0,
            noShares: 0,
            liquidityParam: 1000 * 1e6,
            resolved: false,
            outcome: false,
            subsidyPool: 0
        });
        
        emit MarketCreated(marketId, _question, 1000 * 1e6);
        return marketId;
    }
    
    function resolveMarket(uint256 _marketId, bool _outcome) external onlyOwner {
        Market storage market = markets[_marketId];
        require(block.timestamp >= market.endTime, "Market not ended");
        require(!market.resolved, "Already resolved");
        
        market.resolved = true;
        market.outcome = _outcome;
        
        emit MarketResolved(_marketId, _outcome);
    }
    
    function buyShares(uint256 _marketId, bool _isYes, uint256 _shares, uint256 _maxCost) external nonReentrant {
        Market storage market = markets[_marketId];
        require(block.timestamp < market.endTime, "Market ended");
        require(!market.resolved, "Market resolved");
        require(_shares > 0, "Zero shares");
        
        uint256 cost = calculateCost(_marketId, _isYes, _shares);
        require(cost <= _maxCost, "Cost exceeds max");
        
        require(userBalances[msg.sender] >= cost, "Insufficient deposited balance");
        userBalances[msg.sender] -= cost;
        
        Position storage pos = positions[_marketId][msg.sender];
        if (_isYes) {
            market.yesShares += _shares;
            pos.yesShares += _shares;
        } else {
            market.noShares += _shares;
            pos.noShares += _shares;
        }
        
        emit SharesPurchased(_marketId, msg.sender, _isYes, _shares, cost);
    }
    
    function buySharesFor(
        address _user,
        uint256 _marketId,
        bool _isYes,
        uint256 _shares,
        uint256 _maxCost
    ) external nonReentrant onlyOperator {
        require(_user != address(0), "Invalid user");
        Market storage market = markets[_marketId];
        require(block.timestamp < market.endTime, "Market ended");
        require(!market.resolved, "Market resolved");
        require(_shares > 0, "Zero shares");
        
        uint256 cost = calculateCost(_marketId, _isYes, _shares);
        require(cost <= _maxCost, "Cost exceeds max");
        
        require(userBalances[_user] >= cost, "Insufficient deposited balance");
        userBalances[_user] -= cost;
        
        Position storage pos = positions[_marketId][_user];
        if (_isYes) {
            market.yesShares += _shares;
            pos.yesShares += _shares;
        } else {
            market.noShares += _shares;
            pos.noShares += _shares;
        }
        
        emit SharesPurchased(_marketId, _user, _isYes, _shares, cost);
    }
    
    function calculateCost(uint256 _marketId, bool _isYes, uint256 _shares) public view returns (uint256) {
        Market storage market = markets[_marketId];
        uint256 b = market.liquidityParam;
        
        uint256 costBefore = _lmsrCost(market.yesShares, market.noShares, b);
        uint256 costAfter;
        
        if (_isYes) {
            costAfter = _lmsrCost(market.yesShares + _shares, market.noShares, b);
        } else {
            costAfter = _lmsrCost(market.yesShares, market.noShares + _shares, b);
        }
        
        return (costAfter - costBefore) / PRECISION;
    }
    
    function _lmsrCost(uint256 qYes, uint256 qNo, uint256 b) internal pure returns (uint256) {
        uint256 expYes = _exp((qYes * PRECISION) / b);
        uint256 expNo = _exp((qNo * PRECISION) / b);
        uint256 sum = expYes + expNo;
        uint256 lnSum = _ln(sum);
        return (b * lnSum);
    }
    
    function _exp(uint256 x) internal pure returns (uint256) {
        if (x > MAX_EXPONENT) x = MAX_EXPONENT;
        
        uint256 result = PRECISION;
        uint256 term = PRECISION;
        
        for (uint256 i = 1; i <= 12; i++) {
            term = (term * x) / (i * PRECISION);
            result += term;
        }
        
        return result;
    }
    
    function _ln(uint256 x) internal pure returns (uint256) {
        require(x > 0, "ln(0)");
        
        if (x == PRECISION) return 0;
        
        uint256 result = 0;
        
        while (x >= 2 * PRECISION) {
            x = x / 2;
            result += 693147180559945309;
        }
        
        if (x > PRECISION) {
            uint256 y = ((x - PRECISION) * PRECISION) / (x + PRECISION);
            uint256 y2 = (y * y) / PRECISION;
            
            result += 2 * y;
            uint256 term = y;
            for (uint256 i = 3; i <= 9; i += 2) {
                term = (term * y2) / PRECISION;
                result += (2 * term) / i;
            }
        }
        
        return result;
    }
    
    function getPrice(uint256 _marketId) external view returns (uint256) {
        Market storage market = markets[_marketId];
        uint256 b = market.liquidityParam;
        
        if (b == 0) return 5000;
        
        uint256 expYes = _exp((market.yesShares * PRECISION) / b);
        uint256 expNo = _exp((market.noShares * PRECISION) / b);
        
        int256 price = int256((expYes * 10000) / (expYes + expNo));
        if (price < 0) price = 0;
        if (price > 10000) price = 10000;
        
        return uint256(price);
    }
    
    function claimWinnings(uint256 _marketId) external nonReentrant {
        Market storage market = markets[_marketId];
        Position storage position = positions[_marketId][msg.sender];
        
        require(market.resolved, "Not resolved");
        require(!position.claimed, "Already claimed");
        
        uint256 winningShares = market.outcome ? position.yesShares : position.noShares;
        require(winningShares > 0, "No winnings");
        
        position.claimed = true;
        uint256 payout = winningShares;
        
        require(token.transfer(msg.sender, payout), "Transfer failed");
        emit WinningsClaimed(_marketId, msg.sender, payout);
    }
    
    function getUserPosition(uint256 _marketId, address _user) external view returns (uint256 yesShares, uint256 noShares, bool claimed) {
        Position storage pos = positions[_marketId][_user];
        return (pos.yesShares, pos.noShares, pos.claimed);
    }
}
