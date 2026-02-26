// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

interface IUniswapV2Router02 {
    function swapExactTokensForTokens(
        uint amountIn,
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external returns (uint[] memory amounts);

    function swapExactETHForTokens(
        uint amountOutMin,
        address[] calldata path,
        address to,
        uint deadline
    ) external payable returns (uint[] memory amounts);

    function WETH() external pure returns (address);
}

interface IPredictionMarket {
    function depositFor(address beneficiary, uint256 amount) external;
}

contract Zap is Ownable {
    IPredictionMarket public market;
    IERC20 public usdc;
    IUniswapV2Router02 public router;

    constructor(address _market, address _usdc, address _router) Ownable(msg.sender) {
        market = IPredictionMarket(_market);
        usdc = IERC20(_usdc);
        router = IUniswapV2Router02(_router);
    }

    /**
     * @dev Update the market contract address (e.g. after a redeployment)
     */
    function setMarket(address _newMarket) external onlyOwner {
        require(_newMarket != address(0), "Invalid address");
        market = IPredictionMarket(_newMarket);
    }

    /**
     * @dev Update the USDC token address
     */
    function setUsdc(address _newUsdc) external onlyOwner {
        require(_newUsdc != address(0), "Invalid address");
        usdc = IERC20(_newUsdc);
    }

    /**
     * @dev Zap any ERC20 token into the Prediction Market (converts to USDC)
     * @param tokenIn The token to deposit (e.g. USDT)
     * @param amountIn The amount of tokenIn to deposit
     * @param minUSDC The minimum amount of USDC to receive (slippage protection)
     */
    function zapInToken(address tokenIn, uint256 amountIn, uint256 minUSDC) external {
        require(amountIn > 0, "Amount must be > 0");
        require(tokenIn != address(usdc), "Use direct deposit for USDC");

        // 1. Transfer tokens from user to Zap
        IERC20(tokenIn).transferFrom(msg.sender, address(this), amountIn);

        // 2. Approve Router to spend token
        IERC20(tokenIn).approve(address(router), amountIn);

        // 3. Swap Token -> USDC
        address[] memory path = new address[](2);
        path[0] = tokenIn;
        path[1] = address(usdc);

        router.swapExactTokensForTokens(
            amountIn,
            minUSDC,
            path,
            address(this),
            block.timestamp + 300
        );

        // 4. Get received USDC balance
        uint256 usdcBalance = usdc.balanceOf(address(this));
        require(usdcBalance > 0, "Swap failed to yield USDC");

        // 5. Approve Market to spend USDC
        usdc.approve(address(market), usdcBalance);

        // 6. Deposit into Market for User
        market.depositFor(msg.sender, usdcBalance);
    }

    /**
     * @dev Zap Native BNB into the Prediction Market (converts to USDC)
     * @param minUSDC The minimum amount of USDC to receive (slippage protection)
     */
    function zapInBNB(uint256 minUSDC) external payable {
        require(msg.value > 0, "Amount must be > 0");

        // 1. Swap BNB -> USDC
        address[] memory path = new address[](2);
        path[0] = router.WETH(); // WBNB
        path[1] = address(usdc); // USDC

        // router.swapExactETHForTokens{value: amount}(amountOutMin, path, to, deadline)
        router.swapExactETHForTokens{value: msg.value}(
            minUSDC,
            path,
            address(this),
            block.timestamp + 300
        );

        // 2. Get received USDC balance
        uint256 usdcBalance = usdc.balanceOf(address(this));
        require(usdcBalance > 0, "Swap failed to yield USDC");

        // 3. Approve Market to spend USDC
        usdc.approve(address(market), usdcBalance);

        // 4. Deposit into Market for User
        market.depositFor(msg.sender, usdcBalance);
    }

    /**
     * @dev Rescue tokens accidentally sent to this contract
     */
    function rescueToken(address token) external onlyOwner {
        uint256 balance = IERC20(token).balanceOf(address(this));
        IERC20(token).transfer(msg.sender, balance);
    }
}
