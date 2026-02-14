// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

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
 * @title PredictionMarketMultiV2
 * @dev SIMPLIFIED Multi-outcome prediction market using LMSR
 *      V2 Features:
 *      - Auto-calculated liquidity (no complex parameters!)
 *      - Duration in days (not seconds)
 *      - No subsidy required
 *      - Market deletion after resolution
 *      - Admin-only market creation
 */
contract PredictionMarketMultiV2 is 
    Initializable, 
    OwnableUpgradeable, 
    ReentrancyGuardUpgradeable,
    UUPSUpgradeable 
{
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
        string image;               // URL/Path to market image
        string description;         // Market description/rules
        string[] outcomes;
        uint256[] shares;
        uint256 outcomeCount;
        uint256 endTime;
        uint256 liquidityParam;     // Auto-calculated in V2
        bool resolved;
        uint256 winningOutcome;
        uint256 subsidyPool;        // Kept for backwards compatibility
        bytes32 assertionId;
        bool assertionPending;
        address asserter;
        uint256 assertedOutcome;
        bool deleted;               // NEW: Track deleted markets
    }
    
    struct Position {
        mapping(uint256 => uint256) shares;
        bool claimed;
    }
    
    uint256 public marketCount;
    mapping(uint256 => Market) public markets;
    mapping(uint256 => mapping(address => Position)) internal positions;
    mapping(bytes32 => uint256) public assertionToMarket;
    
    // User Balances
    mapping(address => uint256) public userBalances;
    
    // NEW V2 VARIABLES - MUST BE AT END
    IERC20 public creationToken;
    uint256 public minCreationBalance;
    bool public publicCreation;
    uint256 public protocolFee;
    uint256 public accumulatedFees;

    // Fixed-point math
    uint256 constant PRECISION = 1e18;
    uint256 constant MAX_EXPONENT = 100 * PRECISION;

    // Events
    event MarketCreated(uint256 indexed marketId, string question, string image, string description, string[] outcomes, uint256 liquidity);
    event SharesPurchased(uint256 indexed marketId, address indexed user, uint256 outcomeIndex, uint256 shares, uint256 cost);
    event OutcomeAsserted(uint256 indexed marketId, address indexed asserter, uint256 outcome, bytes32 assertionId);
    event MarketResolvedEvent(uint256 indexed marketId, uint256 outcome);
    event WinningsClaimed(uint256 indexed marketId, address indexed user, uint256 amount);
    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event OperatorUpdated(address indexed operator, bool status);
    event MarketDeletedEvent(uint256 indexed marketId);
    
    // Custom Errors (Gas efficient)
    error MarketHasEnded(uint256 marketId);
    error MarketNotEnded(uint256 marketId);
    error MarketAlreadyResolved(uint256 marketId);
    error MarketNotResolved(uint256 marketId);
    error MarketIsDeleted(uint256 marketId);
    error InvalidOutcomeCount(uint256 provided);
    error InvalidOutcomeIndex(uint256 index, uint256 max);
    error InsufficientBalance(address user, uint256 required, uint256 available);
    error NotOperator(address caller);
    error ZeroShares();
    error CostExceedsMax(uint256 cost, uint256 maxCost);
    
    modifier onlyOperator() {
        if (!operators[msg.sender] && msg.sender != owner()) {
            revert NotOperator(msg.sender);
        }
        _;
    }
    
    modifier marketExists(uint256 _marketId) {
        if (markets[_marketId].deleted) {
            revert MarketIsDeleted(_marketId);
        }
        _;
    }
    
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address _token, address _oracle) public initializer {
        __Ownable_init(msg.sender);
        __ReentrancyGuard_init();
        __UUPSUpgradeable_init();
        
        token = IERC20(_token);
        oracle = OptimisticOracleV3Interface(_oracle);
        assertionBond = 500 * 1e6;
        protocolFee = 500; // 5% Default
    }
    
    // Required for UUPS upgrades
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
    
    function setOperator(address _operator, bool _status) external onlyOwner {
        operators[_operator] = _status;
        emit OperatorUpdated(_operator, _status);
    }

    function setCreationSettings(address _token, uint256 _minBalance, bool _public) external onlyOwner {
        creationToken = IERC20(_token);
        minCreationBalance = _minBalance;
        publicCreation = _public;
    }

    function setProtocolFee(uint256 _fee) external onlyOwner {
        require(_fee <= 1000, "Max fee 10%");
        protocolFee = _fee;
    }

    function claimFees() external onlyOwner {
        uint256 amount = accumulatedFees;
        require(amount > 0, "No fees");
        accumulatedFees = 0;
        require(token.transfer(owner(), amount), "Transfer failed");
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
        if (userBalances[msg.sender] < amount) {
            revert InsufficientBalance(msg.sender, amount, userBalances[msg.sender]);
        }
        userBalances[msg.sender] -= amount;
        require(token.transfer(msg.sender, amount), "Transfer failed");
        emit Withdrawn(msg.sender, amount);
    }
    
    /**
     * @dev SIMPLIFIED Create Market - V2 Version
     * @param _question The market question
     * @param _image URL/Path to market image
     * @param _description Market description/rules
     * @param _outcomes Array of outcome labels (2-10)
     * @param _durationDays Duration in DAYS (not seconds!)
     * 
     * NO liquidity parameter needed!
     * NO subsidy needed!
     */
    function createMarket(
        string memory _question,
        string memory _image,
        string memory _description,
        string[] memory _outcomes,
        uint256 _durationDays
    ) external virtual returns (uint256) {
        if (msg.sender != owner()) {
            require(publicCreation || address(creationToken) != address(0), "Public creation disabled");
            if (address(creationToken) != address(0)) {
                require(creationToken.balanceOf(msg.sender) >= minCreationBalance, "Insufficient creation token balance");
            }
        }
        if (_outcomes.length < MIN_OUTCOMES || _outcomes.length > MAX_OUTCOMES) {
            revert InvalidOutcomeCount(_outcomes.length);
        }
        
        uint256 marketId = marketCount++;
        Market storage market = markets[marketId];
        
        market.question = _question;
        market.image = _image;
        market.description = _description;
        market.outcomeCount = _outcomes.length;
        market.endTime = block.timestamp + (_durationDays * 1 days);
        
        // AUTO-CALCULATE liquidity: 100 USDC per outcome
        market.liquidityParam = _outcomes.length * 100 * 1e6; // Match USDC decimals
        market.subsidyPool = 0; // No subsidy in V2
        
        // Initialize arrays
        for (uint256 i = 0; i < _outcomes.length; i++) {
            market.outcomes.push(_outcomes[i]);
            market.shares.push(0);
        }
        
        emit MarketCreated(marketId, _question, _image, _description, _outcomes, market.liquidityParam);
        return marketId;
    }
    
    /**
     * @dev LEGACY Create Market - V1 Compatibility
     * Kept for backwards compatibility with existing scripts
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
        if (_outcomes.length < MIN_OUTCOMES || _outcomes.length > MAX_OUTCOMES) {
            revert InvalidOutcomeCount(_outcomes.length);
        }
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
        
        for (uint256 i = 0; i < _outcomes.length; i++) {
            market.outcomes.push(_outcomes[i]);
            market.shares.push(0);
        }
        
        emit MarketCreated(marketId, _question, _image, _description, _outcomes, _liquidityParam);
        return marketId;
    }
    
    /**
     * @dev NEW: Delete a resolved market
     * Can only delete markets that have been resolved for at least 30 days
     * Frees up storage and provides gas refund
     */
    function deleteMarket(uint256 _marketId) external onlyOwner {
        Market storage market = markets[_marketId];
        
        if (!market.resolved) {
            revert MarketNotResolved(_marketId);
        }
        
        require(
            block.timestamp > market.endTime + 30 days,
            "Must wait 30 days after resolution"
        );
        
        market.deleted = true;
        
        emit MarketDeletedEvent(_marketId);
    }
    
    function assertOutcome(uint256 _marketId, uint256 _outcomeIndex) 
        external 
        marketExists(_marketId) 
    {
        Market storage market = markets[_marketId];
        
        if (block.timestamp < market.endTime) {
            revert MarketNotEnded(_marketId);
        }
        if (market.resolved) {
            revert MarketAlreadyResolved(_marketId);
        }
        require(!market.assertionPending, "Assertion pending");
        
        if (_outcomeIndex >= market.outcomeCount) {
            revert InvalidOutcomeIndex(_outcomeIndex, market.outcomeCount - 1);
        }
        
        bytes memory claim = abi.encodePacked(
            "Market '", market.question, "' resolved as: ",
            market.outcomes[_outcomeIndex]
        );
        
        if (userBalances[msg.sender] < assertionBond) {
            revert InsufficientBalance(msg.sender, assertionBond, userBalances[msg.sender]);
        }
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
    
    function settleMarket(uint256 _marketId) external marketExists(_marketId) {
        Market storage market = markets[_marketId];
        require(market.assertionPending, "No assertion pending");
        if (market.resolved) {
            revert MarketAlreadyResolved(_marketId);
        }
        
        oracle.settleAssertion(market.assertionId);
        
        OptimisticOracleV3Interface.Assertion memory assertion = oracle.getAssertion(market.assertionId);
        require(assertion.settled, "Not settled yet");
        
        market.resolved = true;
        market.assertionPending = false;
        
        if (assertion.assertedTruthfully) {
            market.winningOutcome = market.assertedOutcome;
        }
        
        emit MarketResolvedEvent(_marketId, market.winningOutcome);
    }
    
    function resolveMarket(uint256 _marketId, uint256 _outcomeIndex) 
        external 
        onlyOwner 
        marketExists(_marketId) 
    {
        Market storage market = markets[_marketId];
        
        if (block.timestamp < market.endTime) {
            revert MarketNotEnded(_marketId);
        }
        if (market.resolved) {
            revert MarketAlreadyResolved(_marketId);
        }
        if (_outcomeIndex >= market.outcomeCount) {
            revert InvalidOutcomeIndex(_outcomeIndex, market.outcomeCount - 1);
        }

        market.resolved = true;
        market.winningOutcome = _outcomeIndex;
        market.assertionPending = false;
        
        emit MarketResolvedEvent(_marketId, _outcomeIndex);
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
                userBalances[market.asserter] += assertionBond;
            }
            
            emit MarketResolvedEvent(marketId, market.winningOutcome);
        }
    }
    
    function buyShares(uint256 _marketId, uint256 _outcomeIndex, uint256 _shares, uint256 _maxCost) 
        external 
        nonReentrant 
        marketExists(_marketId) 
    {
        Market storage market = markets[_marketId];
        
        if (block.timestamp >= market.endTime) {
            revert MarketHasEnded(_marketId);
        }
        if (market.resolved) {
            revert MarketAlreadyResolved(_marketId);
        }
        if (_outcomeIndex >= market.outcomeCount) {
            revert InvalidOutcomeIndex(_outcomeIndex, market.outcomeCount - 1);
        }
        if (_shares == 0) {
            revert ZeroShares();
        }
        
        uint256 cost = calculateCost(_marketId, _outcomeIndex, _shares);
        uint256 fee = (cost * protocolFee) / 10000;
        uint256 totalCost = cost + fee;
        
        if (totalCost > _maxCost) {
            revert CostExceedsMax(totalCost, _maxCost);
        }
        if (userBalances[msg.sender] < totalCost) {
            revert InsufficientBalance(msg.sender, totalCost, userBalances[msg.sender]);
        }
        
        userBalances[msg.sender] -= totalCost;
        accumulatedFees += fee;
        
        market.shares[_outcomeIndex] += _shares;
        positions[_marketId][msg.sender].shares[_outcomeIndex] += _shares;
        
        emit SharesPurchased(_marketId, msg.sender, _outcomeIndex, _shares, totalCost);
    }
    
    function buySharesFor(
        address _user,
        uint256 _marketId,
        uint256 _outcomeIndex,
        uint256 _shares,
        uint256 _maxCost
    ) external nonReentrant onlyOperator marketExists(_marketId) {
        require(_user != address(0), "Invalid user");
        Market storage market = markets[_marketId];
        
        if (block.timestamp >= market.endTime) {
            revert MarketHasEnded(_marketId);
        }
        if (market.resolved) {
            revert MarketAlreadyResolved(_marketId);
        }
        if (_outcomeIndex >= market.outcomeCount) {
            revert InvalidOutcomeIndex(_outcomeIndex, market.outcomeCount - 1);
        }
        if (_shares == 0) {
            revert ZeroShares();
        }
        
        uint256 cost = calculateCost(_marketId, _outcomeIndex, _shares);
        uint256 fee = (cost * protocolFee) / 10000;
        uint256 totalCost = cost + fee;
        
        if (totalCost > _maxCost) {
            revert CostExceedsMax(totalCost, _maxCost);
        }
        if (userBalances[_user] < totalCost) {
            revert InsufficientBalance(_user, totalCost, userBalances[_user]);
        }
        
        userBalances[_user] -= totalCost;
        accumulatedFees += fee;
        
        market.shares[_outcomeIndex] += _shares;
        positions[_marketId][_user].shares[_outcomeIndex] += _shares;
        
        emit SharesPurchased(_marketId, _user, _outcomeIndex, _shares, totalCost);
    }
    
    function calculateCost(uint256 _marketId, uint256 _outcomeIndex, uint256 _shares) 
        public 
        view 
        marketExists(_marketId) 
        returns (uint256) 
    {
        Market storage market = markets[_marketId];
        // PRECISION FIX: Scale 6-decimal liquidity to 18 decimals
        uint256 b = market.liquidityParam * 1e12; 
        
        uint256 costBefore = _lmsrCost(market.shares, b);
        
        uint256[] memory newShares = new uint256[](market.outcomeCount);
        for (uint256 i = 0; i < market.outcomeCount; i++) {
            newShares[i] = market.shares[i];
        }
        newShares[_outcomeIndex] += _shares;
        
        uint256 costAfter = _lmsrCost(newShares, b);
        
        return (costAfter - costBefore) / PRECISION;
    }
    
    function _lmsrCost(uint256[] memory shares, uint256 b) internal pure returns (uint256) {
        uint256 sumExp = 0;
        for (uint256 i = 0; i < shares.length; i++) {
            // b is already scaled to 18 decimals here
            sumExp += _exp((shares[i] * PRECISION) / b);
        }
        uint256 lnSum = _ln(sumExp);
        return (b * lnSum);
    }
    
    function getPrice(uint256 _marketId, uint256 _outcomeIndex) 
        external 
        view 
        marketExists(_marketId) 
        returns (uint256) 
    {
        Market storage market = markets[_marketId];
        // PRECISION FIX: Scale to 18 decimals
        uint256 b = market.liquidityParam * 1e12;
        
        // Check for 0 liquidity or 0 shares (initial state)
        bool allZero = true;
        for(uint256 i=0; i<market.outcomeCount; i++) {
            if(market.shares[i] != 0) {
                allZero = false;
                break;
            }
        }

        if (b == 0 || market.outcomeCount == 0 || allZero) {
            return 10000 / market.outcomeCount;
        }
        
        uint256 expThis = _exp((market.shares[_outcomeIndex] * PRECISION) / b);
        uint256 sumExp = 0;
        for (uint256 i = 0; i < market.outcomeCount; i++) {
            sumExp += _exp((market.shares[i] * PRECISION) / b);
        }
        
        return (expThis * 10000) / sumExp;
    }
    
    function getAllPrices(uint256 _marketId) 
        external 
        view 
        marketExists(_marketId) 
        returns (uint256[] memory) 
    {
        Market storage market = markets[_marketId];
        // PRECISION FIX: Scale to 18 decimals
        uint256 b = market.liquidityParam * 1e12;

        uint256[] memory prices = new uint256[](market.outcomeCount);
        
        // Check for 0 liquidity or 0 shares (initial state)
        bool allZero = true;
        for(uint256 i=0; i<market.outcomeCount; i++) {
            if(market.shares[i] != 0) {
                allZero = false;
                break;
            }
        }
        
        if (b == 0 || market.outcomeCount == 0 || allZero) {
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
    
    function claimWinnings(uint256 _marketId) external nonReentrant marketExists(_marketId) {
        Market storage market = markets[_marketId];
        Position storage position = positions[_marketId][msg.sender];
        
        if (!market.resolved) {
            revert MarketNotResolved(_marketId);
        }
        require(!position.claimed, "Already claimed");
        
        uint256 winningShares = position.shares[market.winningOutcome];
        require(winningShares > 0, "No winnings");
        
        position.claimed = true;
        uint256 payout = winningShares;
        
        require(token.transfer(msg.sender, payout), "Transfer failed");
        emit WinningsClaimed(_marketId, msg.sender, payout);
    }
    
    // === View Functions ===
    
    function getUserPosition(uint256 _marketId, address _user) 
        external 
        view 
        marketExists(_marketId) 
        returns (uint256[] memory shares, bool claimed) 
    {
        Market storage market = markets[_marketId];
        Position storage pos = positions[_marketId][_user];
        
        shares = new uint256[](market.outcomeCount);
        for (uint256 i = 0; i < market.outcomeCount; i++) {
            shares[i] = pos.shares[i];
        }
        
        return (shares, pos.claimed);
    }
    
    function getMarketOutcomes(uint256 _marketId) 
        external 
        view 
        marketExists(_marketId) 
        returns (string[] memory) 
    {
        return markets[_marketId].outcomes;
    }
    
    function getMarketShares(uint256 _marketId) 
        external 
        view 
        marketExists(_marketId) 
        returns (uint256[] memory) 
    {
        return markets[_marketId].shares;
    }
    
    function getMarketBasicInfo(uint256 _marketId) 
        external 
        view 
        marketExists(_marketId) 
        returns (
            string memory question,
            string memory image,
            string memory description,
            uint256 outcomeCount,
            uint256 endTime,
            uint256 liquidityParam,
            bool resolved,
            uint256 winningOutcome
        ) 
    {
        Market storage market = markets[_marketId];
        return (
            market.question,
            market.image,
            market.description,
            market.outcomeCount,
            market.endTime,
            market.liquidityParam,
            market.resolved,
            market.winningOutcome
        );
    }
    
    function getMarketStatus(uint256 _marketId) 
        external 
        view 
        marketExists(_marketId) 
        returns (
            bool ended, 
            bool assertionPending, 
            bool resolved, 
            uint256 winningOutcome, 
            address asserter, 
            bytes32 assertionId
        ) 
    {
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
}
