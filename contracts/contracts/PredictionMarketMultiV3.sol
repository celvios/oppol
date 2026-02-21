// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./PredictionMarketMultiV2.sol";

/**
 * @title PredictionMarketMultiV3
 * @dev Adds creator fee splitting logic (8% Protocol / 2% Creator)
 */
contract PredictionMarketMultiV3 is PredictionMarketMultiV2 {
    
    // === NEW V3 STORAGE ===
    // Must be appended to the end to preserve V2 storage layout
    mapping(uint256 => address) public marketCreators;
    mapping(address => uint256) public creatorRewards;
    uint256 public creatorFeeBps; // Basis points for creator (e.g., 200 = 2%)

    // === V3.1 DUAL ACCESS STORAGE ===
    IERC20 public secondaryCreationToken;
    uint256 public secondaryMinBalance;

    // === V3.2 GASLESS CREATION STORAGE ===
    address public operator; // Backend wallet that pays gas

    event OperatorUpdated(address indexed newOperator);

    event CreatorFeePaid(uint256 indexed marketId, address indexed creator, uint256 amount);
    event CreatorRewardsClaimed(address indexed creator, uint256 amount);
    event CreatorFeeUpdated(uint256 newFeeBps);

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    modifier onlyOperatorOrOwner() {
        require(msg.sender == owner() || msg.sender == operator, "Not operator or owner");
        _;
    }

    /**
     * @dev Initialize V3 state variables
     * Should be called immediately after upgrade
     */
    function initializeV3() external onlyOwner {
        if (creatorFeeBps == 0) {
            creatorFeeBps = 200; // Default 2%
        }
        // Ensure protocol fee is at least total expected if not already set high enough
        // But we won't force it here, as admin might want to configure it separately.
    }

    /**
     * @dev Override createMarket to track the creator
     */
    function createMarketV3(
        string memory _question,
        string memory _image,
        string memory _description,
        string[] memory _outcomes,
        uint256 _durationMinutes
    ) external returns (uint256) {
        // Reuse V2 logic for creation (we call internal or public function from V2?)
        // V2 createMarket is external. We can't call it easily via super if it's external and we want to wrap it.
        // But we inherit it. If we declare same name, it overrides.
        // V2 `createMarket` (with durationDays) is external.
        
        // Actually, since V2 `createMarket` is external, we can't call `super.createMarket(...)`.
        // We have to largely replicate the logic OR rely on the fact that V2 logic does the heavy lifting
        // and we just add the mapping update.
        // BUT, we can't "hook" into V2's createMarket without overriding.
        
        // Let's copy the logic from V2 createMarket and add the creator tracking.
        // This is safe because we are replacing the logic for this function selector.
        
        if (msg.sender != owner()) {
            require(publicCreation || address(creationToken) != address(0), "Public creation disabled");
            
            bool hasPrimaryAccess = false;
            bool hasSecondaryAccess = false;

            if (address(creationToken) != address(0)) {
                if (creationToken.balanceOf(msg.sender) >= minCreationBalance) {
                    hasPrimaryAccess = true;
                }
            }

            if (address(secondaryCreationToken) != address(0)) {
                if (secondaryCreationToken.balanceOf(msg.sender) >= secondaryMinBalance) {
                    hasSecondaryAccess = true;
                }
            }

            require(hasPrimaryAccess || hasSecondaryAccess, "Insufficient creation token balance (NFT or BC400)");
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
        market.endTime = block.timestamp + (_durationMinutes * 1 minutes);
        market.liquidityParam = _outcomes.length * 100 * 1e6; // 100 USDC per outcome
        market.subsidyPool = 0;
        
        for (uint256 i = 0; i < _outcomes.length; i++) {
            market.outcomes.push(_outcomes[i]);
            market.shares.push(0);
        }
        
        // === V3 CHANGE ===
        marketCreators[marketId] = msg.sender;
        // ================
        
        emit MarketCreated(marketId, _question, _image, _description, _outcomes, market.liquidityParam);
        return marketId;
    }

    /**
     * @dev Override buyShares to implement Fee Splitting
     * 10% Total: 8% Protocol + 2% Creator
     */
    function buySharesV3(
        uint256 _marketId,
        uint256 _outcomeIndex,
        uint256 _shares,
        uint256 _maxCost
    ) external nonReentrant marketExists(_marketId) {
        Market storage market = markets[_marketId];
        
        if (block.timestamp >= market.endTime) revert MarketHasEnded(_marketId);
        if (market.resolved) revert MarketAlreadyResolved(_marketId);
        if (_outcomeIndex >= market.outcomeCount) revert InvalidOutcomeIndex(_outcomeIndex, market.outcomeCount - 1);
        if (_shares == 0) revert ZeroShares();
        
        uint256 cost = calculateCost(_marketId, _outcomeIndex, _shares);
        
        // Fee Calculation
        // protocolFee is strictly the Total Fee sent by user (e.g. 1000 bps = 10%)
        uint256 totalFee = (cost * protocolFee) / 10000;
        uint256 totalCost = cost + totalFee;
        
        if (totalCost > _maxCost) revert CostExceedsMax(totalCost, _maxCost);
        if (userBalances[msg.sender] < totalCost) revert InsufficientBalance(msg.sender, totalCost, userBalances[msg.sender]);
        
        // Deduct from user
        userBalances[msg.sender] -= totalCost;
        
        // === FEE SPLITTING ===
        address creator = marketCreators[_marketId];
        if (creator != address(0) && creator != owner()) {
            // Creator exists and is not owner
            uint256 creatorPortion = (cost * creatorFeeBps) / 10000; // 2%
            
            // Safety check: ensure creator portion doesn't exceed total fee
            if (creatorPortion > totalFee) {
                creatorPortion = totalFee;
            }
            
            uint256 protocolPortion = totalFee - creatorPortion;
            
            creatorRewards[creator] += creatorPortion;
            accumulatedFees += protocolPortion;
            
            emit CreatorFeePaid(_marketId, creator, creatorPortion);
        } else {
            // No creator or creator is owner -> 100% to protocol
            accumulatedFees += totalFee;
        }
        // =====================
        
        market.shares[_outcomeIndex] += _shares;
        positions[_marketId][msg.sender].shares[_outcomeIndex] += _shares;
        
        emit SharesPurchased(_marketId, msg.sender, _outcomeIndex, _shares, totalCost);
    }

    function setCreatorFee(uint256 _bps) external onlyOwner {
        require(_bps <= protocolFee, "Creator fee cannot exceed total protocol fee");
        creatorFeeBps = _bps;
        emit CreatorFeeUpdated(_bps);
    }

    function setSecondaryCreationSettings(address _token, uint256 _minBalance) external onlyOwner {
        secondaryCreationToken = IERC20(_token);
        secondaryMinBalance = _minBalance;
    }

    function setOperator(address _operator) external onlyOwner {
        operator = _operator;
        emit OperatorUpdated(_operator);
    }

    /**
     * @dev Override V2 createMarket to support dual access check
     */
    function createMarket(
        string memory _question,
        string memory _image,
        string memory _description,
        string[] memory _outcomes,
        uint256 _durationMinutes
    ) external virtual override returns (uint256) {
        if (msg.sender != owner()) {
            require(publicCreation || address(creationToken) != address(0), "Public creation disabled");
            
            bool hasPrimaryAccess = false;
            bool hasSecondaryAccess = false;

            if (address(creationToken) != address(0)) {
                if (creationToken.balanceOf(msg.sender) >= minCreationBalance) {
                    hasPrimaryAccess = true;
                }
            }

            if (address(secondaryCreationToken) != address(0)) {
                if (secondaryCreationToken.balanceOf(msg.sender) >= secondaryMinBalance) {
                    hasSecondaryAccess = true;
                }
            }

            require(hasPrimaryAccess || hasSecondaryAccess, "Insufficient creation token balance (NFT or BC400)");
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
        // V2/V3 logic: Duration in minutes
        market.endTime = block.timestamp + (_durationMinutes * 1 minutes);
        
        // AUTO-CALCULATE liquidity: 100 USDC per outcome
        market.liquidityParam = _outcomes.length * 100 * 1e6; // Match USDC decimals
        market.subsidyPool = 0; // No subsidy in V2
        
        // Initialize arrays
        for (uint256 i = 0; i < _outcomes.length; i++) {
            market.outcomes.push(_outcomes[i]);
            market.shares.push(0);
        }
        
        // V3: Track creator
        marketCreators[marketId] = msg.sender;
        
        emit MarketCreated(marketId, _question, _image, _description, _outcomes, market.liquidityParam);
        return marketId;
    }

    /**
     * @dev V3.2: Gasless Creation. Allows operator to create market FOR a user.
     * The user is recorded as the creator (receives fees).
     */
    function createMarketFor(
        address _creator,
        string memory _question,
        string memory _image,
        string memory _description,
        string[] memory _outcomes,
        uint256 _durationMinutes
    ) external onlyOperatorOrOwner returns (uint256) {
        if (_outcomes.length < MIN_OUTCOMES || _outcomes.length > MAX_OUTCOMES) {
            revert InvalidOutcomeCount(_outcomes.length);
        }
        
        uint256 marketId = marketCount++;
        Market storage market = markets[marketId];
        
        market.question = _question;
        market.image = _image;
        market.description = _description;
        market.outcomeCount = _outcomes.length;
        market.endTime = block.timestamp + (_durationMinutes * 1 minutes);
        market.liquidityParam = _outcomes.length * 100 * 1e6; // Auto-liquidity
        market.subsidyPool = 0;
        
        for (uint256 i = 0; i < _outcomes.length; i++) {
            market.outcomes.push(_outcomes[i]);
            market.shares.push(0);
        }
        
        // Record the SPECIFIED creator, not msg.sender (operator)
        marketCreators[marketId] = _creator;
        
        emit MarketCreated(marketId, _question, _image, _description, _outcomes, market.liquidityParam);
        return marketId;
    }

    function claimCreatorRewards() external nonReentrant {
        uint256 amount = creatorRewards[msg.sender];
        require(amount > 0, "No rewards");
        
        creatorRewards[msg.sender] = 0;
        require(token.transfer(msg.sender, amount), "Transfer failed");
        
        emit CreatorRewardsClaimed(msg.sender, amount);
    }

    /**
     * @dev Emergency: allows owner to withdraw any ERC20 token held by this contract.
     * Used to recover test funds or stuck tokens before/after relaunch.
     * @param _token  ERC20 token address (use USDC_CONTRACT for user deposit recovery)
     * @param _to     Recipient address (owner wallet)
     * @param _amount Amount in token's native decimals (use type(uint256).max for full balance)
     */
    function emergencyWithdraw(
        address _token,
        address _to,
        uint256 _amount
    ) external onlyOwner nonReentrant {
        require(_to != address(0), "Invalid recipient");
        IERC20 t = IERC20(_token);
        uint256 bal = t.balanceOf(address(this));
        uint256 amount = _amount > bal ? bal : _amount;
        require(amount > 0, "Nothing to withdraw");
        require(t.transfer(_to, amount), "Transfer failed");
        emit EmergencyWithdrawal(_token, _to, amount);
    }

    event EmergencyWithdrawal(address indexed token, address indexed to, uint256 amount);

}
