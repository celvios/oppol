const { ethers } = require("hardhat");

async function main() {
    const PROXY = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
    const fs = require('fs');

    const startBlock = 46973000; // Market creation approx
    const contract = new ethers.Contract(PROXY, [
        "event SharesPurchased(uint256 indexed marketId, address indexed user, uint256 outcomeIndex, uint256 shares, uint256 totalCost)"
    ], ethers.provider);

    const filter = contract.filters.SharesPurchased(4);
    const currentBlock = await ethers.provider.getBlockNumber();

    const path = "C:/Users/toluk/Documents/oppol/shares_debug.txt";
    fs.writeFileSync(path, ""); // clear file
    console.log(`Searching for trades backwards from ${currentBlock} to ${startBlock}...`);

    for (let i = 0; i < 200; i++) { // Max 200 chunks of 5k = 1M blocks
        const to = currentBlock - (i * 5000);
        const from = to - 5000;

        if (from < startBlock) {
            console.log("Reached start block.");
            break;
        }

        try {
            // console.log(`Scanning ${from} to ${to}...`);
            const events = await contract.queryFilter(filter, from, to);

            if (events.length > 0) {
                let output = `\n=== FOUND ${events.length} TRADES IN BLOCK ${from}-${to} ===\n`;
                events.forEach(evt => {
                    const shares = evt.args[3];
                    const cost = evt.args[4];
                    output += `Shares: ${shares.toString()} (Raw)\n`;
                    output += `Cost: ${cost.toString()} (Raw)\n`;
                    output += `Implied Price: ${Number(cost) / Number(shares)}\n\n`;
                });
                fs.appendFileSync(path, output);
                console.log(`Found ${events.length} trades! Stopping.`);
                return; // Stop after finding trades to save time
            }
        } catch (e) {
            console.error(`Error scanning ${from}-${to}:`, e.message);
        }
    }
    console.log("Scan complete. No trades found?");
}

main();
