// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title OptimisticOracleV3Interface
 * @dev Simplified interface for UMA's Optimistic Oracle V3
 */
interface OptimisticOracleV3Interface {
    function assertTruth(
        bytes memory claim,
        address asserter,
        address callbackRecipient,
        address escalationManager,
        uint64 liveness,
        IERC20 currency,
        uint256 bond,
        bytes32 identifier,
        bytes32 domainId
    ) external returns (bytes32 assertionId);

    function settleAssertion(bytes32 assertionId) external;

    function getAssertion(bytes32 assertionId) external view returns (Assertion memory);

    struct Assertion {
        address asserter;
        bool settled;
        bool assertedTruthfully;
        uint64 assertionTime;
        uint64 expirationTime;
    }
}

/**
 * @title PredictionMarketUMA
 * @dev Binary prediction market using LMSR + UMA Optimistic Oracle V3 for resolution
 */
contract PredictionMarketUMA is Ownable, ReentrancyGuard {
    IERC20 public immutable token;
    OptimisticOracleV3Interface public immutable oracle;
    
    // UMA Configuration
    bytes32 public constant IDENTIFIER = bytes32("YES_OR_NO_QUERY");
    uint64 public constant ASSERTION_LIVENESS = 7200; // 2 hours
    uint256 public assertionBond = 100 * 1e18; // 100 tokens bond
    
    struct Market {
        string question;
        uint256 endTime;
        uint256 yesShares;
        uint256 noShares;
        uint256 liquidityParam;
        bool resolved;
        bool outcome;
        uint256 subsidyPool;
        bytes32 assertionId;      // UMA assertion ID
        bool assertionPending;    // Whether assertion is in progress
        address asserter;         // Who asserted the outcome
        bool assertedOutcome;     // What outcome was asserted
    }
    
    struct Position {
        uint256 yesShares;
        uint256 noShares;
        bool claimed;
    }
    
    uint256 public marketCount;
    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => Position)) public positions;
    mapping(bytes32 => uint256) public assertionToMarket; // Map assertion ID to market ID
    
    // User Balances (Deposited Funds)
    mapping(address => uint256) public userBalances;

    // Fixed-point math constants
    uint256 constant PRECISION = 1e18;
    uint256 constant MAX_EXPONENT = 100 * PRECISION;

    event MarketCreated(uint256 indexed marketId, string question, uint256 liquidity);
    event SharesPurchased(uint256 indexed marketId, address indexed user, bool isYes, uint256 shares, uint256 cost);
    event OutcomeAsserted(uint256 indexed marketId, address indexed asserter, bool outcome, bytes32 assertionId);
    event MarketResolved(uint256 indexed marketId, bool outcome);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 amount);
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    
    constructor(address _token, address _oracle) Ownable(msg.sender) {
        token = IERC20(_token);
        oracle = OptimisticOracleV3Interface(_oracle);
    }

    /**
     * @dev Deposit funds into the market contract
     */
    function deposit(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        userBalances[msg.sender] += amount;
        emit Deposited(msg.sender, amount);
    }

    /**
     * @dev Deposit funds on behalf of another user (for Zap contracts)
     */
    function depositFor(address beneficiary, uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(token.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        userBalances[beneficiary] += amount;
        emit Deposited(beneficiary, amount);
    }

    /**
     * @dev Withdraw funds from the market contract
     */
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be > 0");
        require(userBalances[msg.sender] >= amount, "Insufficient balance");
        userBalances[msg.sender] -= amount;
        require(token.transfer(msg.sender, amount), "Transfer failed");
        emit Withdrawn(msg.sender, amount);
    }
    
    /**
     * @dev Create market with initial liquidity subsidy
     */
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
            subsidyPool: _subsidy,
            assertionId: bytes32(0),
            assertionPending: false,
            asserter: address(0),
            assertedOutcome: false
        });
        
        emit MarketCreated(marketId, _question, _liquidityParam);
        return marketId;
    }
    
    /**
     * @dev Assert market outcome via UMA Optimistic Oracle
     * Anyone can call after market ends
     */
    function assertOutcome(uint256 _marketId, bool _outcome) external {
        Market storage market = markets[_marketId];
        require(block.timestamp >= market.endTime, "Market not ended");
        require(!market.resolved, "Already resolved");
        require(!market.assertionPending, "Assertion pending");
        
        // Build claim string
        bytes memory claim = abi.encodePacked(
            "Market '", market.question, "' resolved as: ",
            _outcome ? "YES" : "NO"
        );
        
        // Transfer bond from asserter (Direct transfer for bond)
        require(token.transferFrom(msg.sender, address(this), assertionBond), "Bond transfer failed");
        require(token.approve(address(oracle), assertionBond), "Approve failed");
        
        // Submit assertion to UMA
        bytes32 assertionId = oracle.assertTruth(
            claim,
            msg.sender,
            address(this),      // Callback recipient
            address(0),         // No escalation manager
            ASSERTION_LIVENESS,
            token,
            assertionBond,
            IDENTIFIER,
            bytes32(0)          // No domain ID
        );
        
        // Store assertion info
        market.assertionId = assertionId;
        market.assertionPending = true;
        market.asserter = msg.sender;
        market.assertedOutcome = _outcome;
        assertionToMarket[assertionId] = _marketId;
        
        emit OutcomeAsserted(_marketId, msg.sender, _outcome, assertionId);
    }
    
    /**
     * @dev Settle assertion and finalize market outcome
     * Called after liveness period ends
     */
    function settleMarket(uint256 _marketId) external {
        Market storage market = markets[_marketId];
        require(market.assertionPending, "No assertion pending");
        require(!market.resolved, "Already resolved");
        
        // Settle the assertion on UMA
        oracle.settleAssertion(market.assertionId);
        
        // Get result
        OptimisticOracleV3Interface.Assertion memory assertion = oracle.getAssertion(market.assertionId);
        require(assertion.settled, "Not settled yet");
        
        // Finalize market
        market.resolved = true;
        market.assertionPending = false;
        
        if (assertion.assertedTruthfully) {
            // Assertion was valid, use asserted outcome
            market.outcome = market.assertedOutcome;
        } else {
            // Assertion was disputed and failed, use opposite outcome
            market.outcome = !market.assertedOutcome;
        }
        
        emit MarketResolved(_marketId, market.outcome);
    }
    
    /**
     * @dev UMA callback when assertion is resolved (optional callback pattern)
     */
    function assertionResolvedCallback(
        bytes32 _assertionId,
        bool _assertedTruthfully
    ) external {
        require(msg.sender == address(oracle), "Only oracle");
        
        uint256 marketId = assertionToMarket[_assertionId];
        Market storage market = markets[marketId];
        
        if (!market.resolved && market.assertionPending) {
            market.resolved = true;
            market.assertionPending = false;
            market.outcome = _assertedTruthfully ? market.assertedOutcome : !market.assertedOutcome;
            
            emit MarketResolved(marketId, market.outcome);
        }
    }
    
    /**
     * @dev Buy outcome shares using LMSR pricing
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
        require(_shares > 0, "Zero shares");
        
        uint256 cost = calculateCost(_marketId, _isYes, _shares);
        require(cost <= _maxCost, "Cost exceeds max");
        
        // Use deposited balance
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
    
    /**
     * @dev Calculate cost using LMSR formula
     */
    function calculateCost(
        uint256 _marketId,
        bool _isYes,
        uint256 _shares
    ) public view returns (uint256) {
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
    
    /**
     * @dev LMSR cost function: C = b * ln(e^(q_yes/b) + e^(q_no/b))
     */
    function _lmsrCost(uint256 qYes, uint256 qNo, uint256 b) internal pure returns (uint256) {
        uint256 expYes = _exp((qYes * PRECISION) / b);
        uint256 expNo = _exp((qNo * PRECISION) / b);
        uint256 sum = expYes + expNo;
        uint256 lnSum = _ln(sum);
        return (b * lnSum);
    }
    
    /**
     * @dev Approximate e^x using Taylor series
     */
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
    
    /**
     * @dev Approximate ln(x) using series expansion
     */
    function _ln(uint256 x) internal pure returns (uint256) {
        require(x > 0, "ln(0)");
        
        if (x == PRECISION) return 0;
        
        uint256 result = 0;
        
        while (x >= 2 * PRECISION) {
            x = x / 2;
            result += 693147180559945309; // ln(2) * 1e18
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
    
    /**
     * @dev Get YES probability (0-10000 basis points)
     */
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
    
    /**
     * @dev Claim winnings after market is resolved
     */
    function claimWinnings(uint256 _marketId) external nonReentrant {
        Market storage market = markets[_marketId];
        Position storage position = positions[_marketId][msg.sender];
        
        require(market.resolved, "Not resolved");
        require(!position.claimed, "Already claimed");
        
        uint256 winningShares = market.outcome ? position.yesShares : position.noShares;
        require(winningShares > 0, "No winnings");
        
        position.claimed = true;
        
        // Winners get $1 per share (in token decimals)
        uint256 payout = winningShares;
        
        require(token.transfer(msg.sender, payout), "Transfer failed");
        emit WinningsClaimed(_marketId, msg.sender, payout);
    }
    
    /**
     * @dev Get user position
     */
    function getUserPosition(uint256 _marketId, address _user) 
        external view returns (uint256 yesShares, uint256 noShares, bool claimed) 
    {
        Position storage pos = positions[_marketId][_user];
        return (pos.yesShares, pos.noShares, pos.claimed);
    }
    
    /**
     * @dev Get market resolution status
     */
    function getMarketStatus(uint256 _marketId) external view returns (
        bool ended,
        bool assertionPending,
        bool resolved,
        bool outcome,
        address asserter,
        bytes32 assertionId
    ) {
        Market storage market = markets[_marketId];
        return (
            block.timestamp >= market.endTime,
            market.assertionPending,
            market.resolved,
            market.outcome,
            market.asserter,
            market.assertionId
        );
    }
    
    /**
     * @dev Update assertion bond (owner only)
     */
    function setAssertionBond(uint256 _bond) external onlyOwner {
        assertionBond = _bond;
    }
}
