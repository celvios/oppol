pragma solidity ^0.8.22;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

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
 * @title PredictionMarketMulti
 * @dev Multi-outcome prediction market using LMSR + UMA Optimistic Oracle V3
 *      Supports 2-10 outcomes per market
 */
contract PredictionMarketMulti is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable, UUPSUpgradeable {
    IERC20 public token;
    OptimisticOracleV3Interface public oracle;
    
    // UMA Configuration
    bytes32 public constant IDENTIFIER = bytes32("MULTIPLE_CHOICE_QUERY");
    uint64 public constant ASSERTION_LIVENESS = 7200; // 2 hours
    uint256 public assertionBond;
    
    // Limits
    uint256 public constant MIN_OUTCOMES = 2;
    uint256 public constant MAX_OUTCOMES = 10;
    
    // Operator (can execute trades on behalf of users)
    mapping(address => bool) public operators;
    
    struct Market {
        string question;
        string image;             // URL/Path to market image
        string description;       // Market description/rules
        string[] outcomes;        // ["Option A", "Option B", "Option C", ...]
        uint256[] shares;         // Shares purchased per outcome
        uint256 outcomeCount;     // Number of outcomes
        uint256 endTime;
        uint256 liquidityParam;   // LMSR b parameter
        bool resolved;
        uint256 winningOutcome;   // Index of winning outcome
        uint256 subsidyPool;
        // UMA integration
        bytes32 assertionId;
        bool assertionPending;
        address asserter;
        uint256 assertedOutcome;
    }
    
    struct Position {
        mapping(uint256 => uint256) shares;  // outcomeIndex => shares
        bool claimed;
    }
    
    uint256 public marketCount;
    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => Position)) internal positions;
    mapping(bytes32 => uint256) public assertionToMarket;
    
    // User Balances (Deposited Funds)
    mapping(address => uint256) public userBalances;

    // Fixed-point math constants
    uint256 constant PRECISION = 1e18;
    uint256 constant MAX_EXPONENT = 100 * PRECISION;

    event MarketCreated(uint256 indexed marketId, string question, string image, string description, string[] outcomes, uint256 liquidity);
    event SharesPurchased(uint256 indexed marketId, address indexed user, uint256 outcomeIndex, uint256 shares, uint256 cost);
    event OutcomeAsserted(uint256 indexed marketId, address indexed asserter, uint256 outcome, bytes32 assertionId);
    event MarketResolved(uint256 indexed marketId, uint256 outcome);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 amount);
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event OperatorUpdated(address indexed operator, bool status);
    
    modifier onlyOperator() {
        require(operators[msg.sender] || msg.sender == owner(), "Not operator");
        _;
    }
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _token, address _oracle) public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        
        token = IERC20(_token);
        oracle = OptimisticOracleV3Interface(_oracle);
        assertionBond = 500 * 1e6; // 500 tokens (6 decimals) initialization
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
    
    /**
     * @dev Create a multi-outcome market
     * @param _question The market question
     * @param _image URL/Path to market image
     * @param _description Market description/rules
     * @param _outcomes Array of outcome labels (2-10)
     * @param _duration Duration in seconds
     * @param _liquidityParam LMSR liquidity parameter
     * @param _subsidy Optional subsidy pool
     */
    function createMarket(
        string memory _question,
        string memory _image,
        string memory _description,
        string[] memory _outcomes,
        uint256 _duration,
        uint256 _liquidityParam,
        uint256 _subsidy
    ) external onlyOwner returns (uint256) {
        require(_outcomes.length >= MIN_OUTCOMES && _outcomes.length <= MAX_OUTCOMES, "Invalid outcome count");
        require(_liquidityParam > 0, "Invalid liquidity param");
        
        if (_subsidy > 0) {
            require(token.transferFrom(msg.sender, address(this), _subsidy), "Subsidy transfer failed");
        }
        
        uint256 marketId = marketCount++;
        Market storage market = markets[marketId];
        
        market.question = _question;
        market.image = _image;
        market.description = _description;
        market.outcomeCount = _outcomes.length;
        market.endTime = block.timestamp + _duration;
        market.liquidityParam = _liquidityParam;
        market.subsidyPool = _subsidy;
        
        // Initialize outcomes and shares arrays
        for (uint256 i = 0; i < _outcomes.length; i++) {
            market.outcomes.push(_outcomes[i]);
            market.shares.push(0);
        }
        
        emit MarketCreated(marketId, _question, _image, _description, _outcomes, _liquidityParam);
        return marketId;
    }
    
    /**
     * @dev Assert market outcome - bond deducted from portfolio balance
     */
    function assertOutcome(uint256 _marketId, uint256 _outcomeIndex) external {
        Market storage market = markets[_marketId];
        require(block.timestamp >= market.endTime, "Market not ended");
        require(!market.resolved, "Already resolved");
        require(!market.assertionPending, "Assertion pending");
        require(_outcomeIndex < market.outcomeCount, "Invalid outcome");
        
        bytes memory claim = abi.encodePacked(
            "Market '", market.question, "' resolved as: ",
            market.outcomes[_outcomeIndex]
        );
        
        // Deduct bond from portfolio balance
        require(userBalances[msg.sender] >= assertionBond, "Insufficient portfolio balance for bond");
        userBalances[msg.sender] -= assertionBond;

        require(token.approve(address(oracle), assertionBond), "Approve failed");
        
        bytes32 assertionId = oracle.assertTruth(
            claim,
            msg.sender,
            address(this),
            address(0),
            ASSERTION_LIVENESS,
            token,
            assertionBond,
            IDENTIFIER,
            bytes32(0)
        );
        
        market.assertionId = assertionId;
        market.assertionPending = true;
        market.asserter = msg.sender;
        market.assertedOutcome = _outcomeIndex;
        assertionToMarket[assertionId] = _marketId;
        
        emit OutcomeAsserted(_marketId, msg.sender, _outcomeIndex, assertionId);
    }
    
    function settleMarket(uint256 _marketId) external {
        Market storage market = markets[_marketId];
        require(market.assertionPending, "No assertion pending");
        require(!market.resolved, "Already resolved");
        
        oracle.settleAssertion(market.assertionId);
        
        OptimisticOracleV3Interface.Assertion memory assertion = oracle.getAssertion(market.assertionId);
        require(assertion.settled, "Not settled yet");
        
        market.resolved = true;
        market.assertionPending = false;
        
        if (assertion.assertedTruthfully) {
            market.winningOutcome = market.assertedOutcome;
        }
        // If disputed and wrong, market stays unresolved for new assertion
        
        emit MarketResolved(_marketId, market.winningOutcome);
    }
    
    /**
     * @dev Emergency/Admin Resolution - bypasses UMA oracle
     * Only callable by owner
     */
    function resolveMarket(uint256 _marketId, uint256 _outcomeIndex) external onlyOwner {
        Market storage market = markets[_marketId];
        require(block.timestamp >= market.endTime, "Market not ended");
        require(!market.resolved, "Already resolved");
        require(_outcomeIndex < market.outcomeCount, "Invalid outcome");

        market.resolved = true;
        market.winningOutcome = _outcomeIndex;
        // If there was a pending assertion, we essentially override it
        market.assertionPending = false;
        
        emit MarketResolved(_marketId, _outcomeIndex);
    }

    function assertionResolvedCallback(bytes32 _assertionId, bool _assertedTruthfully) external {
        require(msg.sender == address(oracle), "Only oracle");
        
        uint256 marketId = assertionToMarket[_assertionId];
        Market storage market = markets[marketId];
        
        if (!market.resolved && market.assertionPending) {
            market.resolved = true;
            market.assertionPending = false;
            
            if (_assertedTruthfully) {
                market.winningOutcome = market.assertedOutcome;
                // Return bond to asserter's portfolio
                userBalances[market.asserter] += assertionBond;
            }
            
            emit MarketResolved(marketId, market.winningOutcome);
        }
    }
    
    /**
     * @dev Buy shares for a specific outcome
     */
    function buyShares(uint256 _marketId, uint256 _outcomeIndex, uint256 _shares, uint256 _maxCost) external nonReentrant {
        Market storage market = markets[_marketId];
        require(block.timestamp < market.endTime, "Market ended");
        require(!market.resolved, "Market resolved");
        require(_outcomeIndex < market.outcomeCount, "Invalid outcome");
        require(_shares > 0, "Zero shares");
        
        uint256 cost = calculateCost(_marketId, _outcomeIndex, _shares);
        require(cost <= _maxCost, "Cost exceeds max");
        
        require(userBalances[msg.sender] >= cost, "Insufficient deposited balance");
        userBalances[msg.sender] -= cost;
        
        market.shares[_outcomeIndex] += _shares;
        positions[_marketId][msg.sender].shares[_outcomeIndex] += _shares;
        
        emit SharesPurchased(_marketId, msg.sender, _outcomeIndex, _shares, cost);
    }
    
    /**
     * @dev Buy shares on behalf of a user (custodial trading)
     */
    function buySharesFor(
        address _user,
        uint256 _marketId,
        uint256 _outcomeIndex,
        uint256 _shares,
        uint256 _maxCost
    ) external nonReentrant onlyOperator {
        require(_user != address(0), "Invalid user");
        Market storage market = markets[_marketId];
        require(block.timestamp < market.endTime, "Market ended");
        require(!market.resolved, "Market resolved");
        require(_outcomeIndex < market.outcomeCount, "Invalid outcome");
        require(_shares > 0, "Zero shares");
        
        uint256 cost = calculateCost(_marketId, _outcomeIndex, _shares);
        require(cost <= _maxCost, "Cost exceeds max");
        
        require(userBalances[_user] >= cost, "Insufficient deposited balance");
        userBalances[_user] -= cost;
        
        market.shares[_outcomeIndex] += _shares;
        positions[_marketId][_user].shares[_outcomeIndex] += _shares;
        
        emit SharesPurchased(_marketId, _user, _outcomeIndex, _shares, cost);
    }
    
    /**
     * @dev Calculate cost to buy shares using LMSR
     */
    function calculateCost(uint256 _marketId, uint256 _outcomeIndex, uint256 _shares) public view returns (uint256) {
        Market storage market = markets[_marketId];
        uint256 b = market.liquidityParam;
        
        uint256 costBefore = _lmsrCost(market.shares, b);
        
        // Create a copy with updated shares
        uint256[] memory newShares = new uint256[](market.outcomeCount);
        for (uint256 i = 0; i < market.outcomeCount; i++) {
            newShares[i] = market.shares[i];
        }
        newShares[_outcomeIndex] += _shares;
        
        uint256 costAfter = _lmsrCost(newShares, b);
        
        return (costAfter - costBefore) / PRECISION;
    }
    
    /**
     * @dev LMSR cost function: b * ln(sum of exp(q_i / b))
     */
    function _lmsrCost(uint256[] memory shares, uint256 b) internal pure returns (uint256) {
        uint256 sumExp = 0;
        for (uint256 i = 0; i < shares.length; i++) {
            sumExp += _exp((shares[i] * PRECISION) / b);
        }
        uint256 lnSum = _ln(sumExp);
        return (b * lnSum);
    }
    
    /**
     * @dev Get price for a specific outcome (0-10000 basis points)
     */
    function getPrice(uint256 _marketId, uint256 _outcomeIndex) external view returns (uint256) {
        Market storage market = markets[_marketId];
        uint256 b = market.liquidityParam;
        
        if (b == 0 || market.outcomeCount == 0) {
            return 10000 / market.outcomeCount; // Equal probability
        }
        
        uint256 expThis = _exp((market.shares[_outcomeIndex] * PRECISION) / b);
        uint256 sumExp = 0;
        for (uint256 i = 0; i < market.outcomeCount; i++) {
            sumExp += _exp((market.shares[i] * PRECISION) / b);
        }
        
        return (expThis * 10000) / sumExp;
    }
    
    /**
     * @dev Get all prices for a market
     */
    function getAllPrices(uint256 _marketId) external view returns (uint256[] memory) {
        Market storage market = markets[_marketId];
        uint256 b = market.liquidityParam;
        uint256[] memory prices = new uint256[](market.outcomeCount);
        
        if (b == 0 || market.outcomeCount == 0) {
            uint256 equalPrice = 10000 / market.outcomeCount;
            for (uint256 i = 0; i < market.outcomeCount; i++) {
                prices[i] = equalPrice;
            }
            return prices;
        }
        
        uint256 sumExp = 0;
        uint256[] memory exps = new uint256[](market.outcomeCount);
        for (uint256 i = 0; i < market.outcomeCount; i++) {
            exps[i] = _exp((market.shares[i] * PRECISION) / b);
            sumExp += exps[i];
        }
        
        for (uint256 i = 0; i < market.outcomeCount; i++) {
            prices[i] = (exps[i] * 10000) / sumExp;
        }
        
        return prices;
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
    
    function claimWinnings(uint256 _marketId) external nonReentrant {
        Market storage market = markets[_marketId];
        Position storage position = positions[_marketId][msg.sender];
        
        require(market.resolved, "Not resolved");
        require(!position.claimed, "Already claimed");
        
        uint256 winningShares = position.shares[market.winningOutcome];
        require(winningShares > 0, "No winnings");
        
        position.claimed = true;
        uint256 payout = winningShares;
        
        require(token.transfer(msg.sender, payout), "Transfer failed");
        emit WinningsClaimed(_marketId, msg.sender, payout);
    }
    
    // === View Functions ===
    
    function getUserPosition(uint256 _marketId, address _user) external view returns (uint256[] memory shares, bool claimed) {
        Market storage market = markets[_marketId];
        Position storage pos = positions[_marketId][_user];
        
        shares = new uint256[](market.outcomeCount);
        for (uint256 i = 0; i < market.outcomeCount; i++) {
            shares[i] = pos.shares[i];
        }
        
        return (shares, pos.claimed);
    }
    
    function getMarketOutcomes(uint256 _marketId) external view returns (string[] memory) {
        return markets[_marketId].outcomes;
    }
    
    function getMarketShares(uint256 _marketId) external view returns (uint256[] memory) {
        return markets[_marketId].shares;
    }
    
    function getMarketBasicInfo(uint256 _marketId) external view returns (
        string memory question,
        string memory image,
        string memory description,  // New return value
        uint256 outcomeCount,
        uint256 endTime,
        uint256 liquidityParam,
        bool resolved,
        uint256 winningOutcome
    ) {
        Market storage market = markets[_marketId];
        return (
            market.question,
            market.image,
            market.description,     // Return stored description
            market.outcomeCount,
            market.endTime,
            market.liquidityParam,
            market.resolved,
            market.winningOutcome
        );
    }
    
    function getMarketStatus(uint256 _marketId) external view returns (
        bool ended, bool assertionPending, bool resolved, uint256 winningOutcome, address asserter, bytes32 assertionId
    ) {
        Market storage market = markets[_marketId];
        return (
            block.timestamp >= market.endTime,
            market.assertionPending,
            market.resolved,
            market.winningOutcome,
            market.asserter,
            market.assertionId
        );
    }
    
    function setAssertionBond(uint256 _bond) external onlyOwner {
        assertionBond = _bond;
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
