const ethers = require('ethers');

const errors = [
    "MarketHasEnded(uint256)",
    "MarketNotEnded(uint256)",
    "MarketAlreadyResolved(uint256)",
    "MarketNotResolved(uint256)",
    "MarketIsDeleted(uint256)",
    "InvalidOutcomeCount(uint256)",
    "InvalidOutcomeIndex(uint256,uint256)",
    "InsufficientBalance(address,uint256,uint256)",
    "NotOperator(address)",
    "ZeroShares()",
    "CostExceedsMax(uint256,uint256)",
    "ERC20InsufficientBalance(address,uint256,uint256)",
    "ERC20InvalidSender(address)",
    "ERC20InvalidReceiver(address)",
    "ERC20InsufficientAllowance(address,uint256,uint256)",
    "ERC20InvalidApprover(address)",
    "ERC20InvalidSpender(address)",
    "OwnableUnauthorizedAccount(address)",
    "ReentrancyGuardReentrantCall()"
];

console.log("Calculated Selectors:");
errors.forEach(err => {
    const selector = ethers.id(err).slice(0, 10);
    console.log(`${selector} : ${err}`);
});
