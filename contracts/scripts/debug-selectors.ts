import { ethers } from "ethers";

async function main() {
    // Function signatures to check
    const functions = [
        "createMarket(string,string[],uint256)",
        "createMarket(string,string[],uint256,uint256,uint256)",
        "buyShares(uint256,uint256,uint256,uint256)",
        "buySharesFor(address,uint256,uint256,uint256,uint256)"
    ];

    console.log("--- Functions ---");
    for (const f of functions) {
        const hash = ethers.id(f).slice(0, 10);
        console.log(`${hash} : ${f}`);
    }

    // Error signatures to check
    const errors = [
        "NotOperator(address)",
        "InsufficientBalance(address,uint256,uint256)",
        "InvalidOutcomeCount(uint256)",
        "MarketHasEnded(uint256)",
        "MarketNotEnded(uint256)",
        "MarketAlreadyResolved(uint256)",
        "MarketNotResolved(uint256)",
        "MarketIsDeleted(uint256)",
        "OwnableUnauthorizedAccount(address)", // OpenZeppelin 5.0
        "CostExceedsMax(uint256,uint256)"
    ];

    console.log("\n--- Errors ---");
    for (const e of errors) {
        const hash = ethers.id(e).slice(0, 10);
        console.log(`${hash} : ${e}`);
    }
}

main();
