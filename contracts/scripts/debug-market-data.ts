
import { ethers } from "ethers";

const RPC_URL = "https://bsc-rpc.publicnode.com";
const MARKET_ADDR = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
const MARKET_ID = 1;

async function main() {
    console.log(`Checking market ${MARKET_ID} at ${MARKET_ADDR}...`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // 1. Get Code
    const code = await provider.getCode(MARKET_ADDR);
    console.log(`Contract size: ${code.length} bytes`);
    if (code === '0x') {
        console.error("No contract code at address!");
        return;
    }

    // 2. Raw Call
    const abiSignature = "getMarketBasicInfo(uint256)";
    const selector = ethers.id(abiSignature).slice(0, 10);
    const iface = new ethers.AbiCoder();
    const args = iface.encode(["uint256"], [MARKET_ID]);
    const data = selector + args.slice(2);

    console.log(`Calling with data: ${data}`);

    try {
        const result = await provider.call({
            to: MARKET_ADDR,
            data: data
        });

        console.log(`Raw Result: ${result}`);

        if (result === '0x') {
            console.log("Returned empty data.");
            return;
        }

        // 3. Decode with Old ABI
        try {
            const oldAbi = ['function getMarketBasicInfo(uint256) view returns (string question, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome)'];
            const ifaceOld = new ethers.Interface(oldAbi);
            const decodedOld = ifaceOld.decodeFunctionResult("getMarketBasicInfo", result);
            console.log("\n--- Decoded with OLD ABI ---");
            console.log("Question:", decodedOld.question);
            console.log("OutcomeCount:", decodedOld.outcomeCount.toString());
            console.log("EndTime:", decodedOld.endTime.toString());
            console.log("Liquidity:", decodedOld.liquidityParam.toString());
            console.log("Resolved:", decodedOld.resolved);
            console.log("WinningOutcome:", decodedOld.winningOutcome.toString());
        } catch (e) {
            console.log("\nFailed to decode with OLD ABI:", e.message);
        }

        // 4. Decode with New ABI
        try {
            const newAbi = ['function getMarketBasicInfo(uint256) view returns (string question, string image, string description, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome)'];
            const ifaceNew = new ethers.Interface(newAbi);
            const decodedNew = ifaceNew.decodeFunctionResult("getMarketBasicInfo", result);
            console.log("\n--- Decoded with NEW ABI ---");
            console.log("Question:", decodedNew.question);
            console.log("Image:", decodedNew.image);
            console.log("Description:", decodedNew.description);
            console.log("OutcomeCount:", decodedNew.outcomeCount.toString());
            console.log("EndTime:", decodedNew.endTime.toString());
            console.log("Liquidity:", decodedNew.liquidityParam.toString());
            console.log("Resolved:", decodedNew.resolved);
            console.log("WinningOutcome:", decodedNew.winningOutcome.toString());
        } catch (e) {
            console.log("\nFailed to decode with NEW ABI:", e.message);
        }

    } catch (e) {
        console.error("Call failed:", e);
    }
}

main().catch(console.error);
