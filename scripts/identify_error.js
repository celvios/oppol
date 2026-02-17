const ethers = require('ethers');

const target = "0xf0a78225";
const errors = [
    "CostExceedsMax(uint256,uint256)",
    "InvalidOutcomeIndex(uint256,uint256)",
    "InvalidOutcomeCount(uint256)",
    "MarketHasEnded(uint256)",
    "MarketNotEnded(uint256)",
    "MarketAlreadyResolved(uint256)"
];

console.log(`Target: ${target}`);
errors.forEach(err => {
    const selector = ethers.id(err).slice(0, 10);
    console.log(`${selector} : ${err}`);
    if (selector === target) {
        console.log(`MATCH FOUND: ${err}`);
    }
});
