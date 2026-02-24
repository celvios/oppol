const { ethers } = require('ethers');

const rpcUrl = 'https://rpc.ankr.com/bsc/8696831c7e5da7cc66fb967d8f86b97ff978d69ebbf902a0ac5785375df17fc8';
const provider = new ethers.JsonRpcProvider(rpcUrl);

const USDT = '0x55d398326f99059fF775485246999027B3197955';
const USDC = '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d';
const wallet = '0x42501490f7c291b4B28110900c9Bd81f3B35B849';
const target = '0xd0A115Ea64B59F951B70276fCb65b4946465e3a9';

async function main() {
    console.log("Searching for Transfers from", wallet, "to", target);

    const transferEventSignature = ethers.id("Transfer(address,address,uint256)");
    const fromTopic = ethers.zeroPadValue(wallet, 32);
    const toTopic = ethers.zeroPadValue(target, 32);

    const latestBlock = await provider.getBlockNumber();
    console.log("Latest block:", latestBlock);

    for (const token of [USDT, USDC]) {
        console.log("Checking token:", token);
        let currentStart = latestBlock - 50000; // roughly ~1.5 days of blocks

        while (currentStart < latestBlock) {
            let currentEnd = Math.min(currentStart + 4999, latestBlock);
            process.stdout.write(`\rScanning ${currentStart} to ${currentEnd}...`);

            try {
                const logs = await provider.getLogs({
                    address: token,
                    fromBlock: currentStart,
                    toBlock: currentEnd,
                    topics: [transferEventSignature, fromTopic, toTopic]
                });

                if (logs.length > 0) {
                    console.log(`\nFound ${logs.length} transfers for token ${token}`);
                    for (const log of logs) {
                        const amount = ethers.formatUnits(log.data, 18);
                        console.log(`TX Hash: ${log.transactionHash} | Amount: ${amount}`);
                        const tx = await provider.getTransaction(log.transactionHash);
                        console.log("Transaction To:", tx.to);
                        console.log("Transaction Data:", tx.data.substring(0, 50) + '...');
                    }
                    return; // Stop after finding it
                }
            } catch (e) {
                console.log("\nError at block", currentStart, e.message);
                // optionally retry or reduce batch
            }
            currentStart = currentEnd + 1;
        }
        console.log("\nFinished scanning token", token);
    }
}

main().catch(console.error);
