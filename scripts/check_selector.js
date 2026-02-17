const ethers = require('ethers');
const target = "0xdb42144d";

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
    "ReentrancyGuardReentrantCall()",
    "EnforcedPause()",
    "ExpectedPause()",
    "ValueMismatch()",
    "Revert()" // Generic?
];

console.log(`Checking against target: ${target}`);
let found = false;
errors.forEach(err => {
    const selector = ethers.id(err).slice(0, 10);
    if (selector === target) {
        console.log(`MATCH FOUND: ${selector} -> ${err}`);
        found = true;
    }
});

if (!found) {
    console.log("No match found in common errors.");
    // Try to guess based on signature?
    // db42144d might be a standard error
}
