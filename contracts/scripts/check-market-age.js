const { ethers } = require("hardhat");

async function main() {
    const PROXY = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";

    const provider = new ethers.JsonRpcProvider(process.env.RPC_URL || "https://delicate-greatest-energy.bsc.quiknode.pro/97d400e0de1e7c8b3969827d8452f896270454d0/");

    const currentBlock = await provider.getBlockNumber();
    console.log(`Current Block: ${currentBlock}`);

    // BSC averages ~3 seconds per block
    // 17 days = 17 * 24 * 60 * 60 / 3 = ~490k blocks
    const blocksIn17Days = 17 * 24 * 60 * 60 / 3;
    console.log(`Blocks in 17 days: ~${Math.floor(blocksIn17Days)}`);

    const estimatedCreationBlock = currentBlock - Math.floor(blocksIn17Days);
    console.log(`Estimated Market 4 creation block: ~${estimatedCreationBlock}`);

    console.log(`\nTo find all trades, need to scan ~${Math.floor(blocksIn17Days)} blocks`);
    console.log(`At 2000 blocks per chunk = ${Math.ceil(blocksIn17Days / 2000)} RPC calls`);
    console.log(`At ~100ms per call = ${Math.ceil(blocksIn17Days / 2000 * 100 / 1000)}s total`);
}

main();
