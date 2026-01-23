
const ethers = require("ethers");

const RPC_URL = "https://bsc-rpc.publicnode.com";

// Candidates
const CONTRACTS = {
    "V1_CORRECT": "0xe3Eb84D7e271A5C44B27578547f69C80c497355B",
    "FALLBACK_OLD": "0xf91Dd35bF428B0052CB63127931b4e49fe0fB7d6", // Was in src/app.ts
    "BSC_TESTNET": "0xA7DEd30e8A292dAA8e75A8d288393f8e290f9717", // Was in contracts-multi.ts
    "LATEST_DEPLOY": "0xB6a211822649a61163b94cf46e6fCE46119D3E1b" // Found in getMarket endpoint
};

const MARKET_ID = 0;

// V1 ABI (No image/desc)
const ABI_V1 = ['function getMarketBasicInfo(uint256) view returns (string question, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome)'];

// V2 ABI (With image/desc)
const ABI_V2 = ['function getMarketBasicInfo(uint256) view returns (string question, string image, string description, uint256 outcomeCount, uint256 endTime, uint256 liquidityParam, bool resolved, uint256 winningOutcome)'];

async function checkContract(name, address) {
    console.log(`\nTesting ${name}: ${address}`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);

    // 1. Check Code
    const code = await provider.getCode(address);
    if (code === '0x') {
        console.log("  -> No contract code (Not deployed on Mainnet)");
        return;
    }

    // 2. Raw Call
    const abiSignature = "getMarketBasicInfo(uint256)";
    const selector = ethers.id(abiSignature).slice(0, 10);
    const iface = new ethers.AbiCoder();
    const args = iface.encode(["uint256"], [MARKET_ID]);
    const data = selector + args.slice(2);

    try {
        const result = await provider.call({ to: address, data: data });
        console.log(`  -> Raw Result Length: ${result.length}`);

        // Try Decode V1
        try {
            const ifaceV1 = new ethers.Interface(ABI_V1);
            const d = ifaceV1.decodeFunctionResult("getMarketBasicInfo", result);
            console.log(`  -> Decoded V1: Count=${d.outcomeCount}, End=${d.endTime}, Resolved=${d.resolved}`);
        } catch (e) {
            console.log("  -> Failed V1 Decode");
        }

        // Try Decode V2
        try {
            const ifaceV2 = new ethers.Interface(ABI_V2);
            const d = ifaceV2.decodeFunctionResult("getMarketBasicInfo", result);
            console.log(`  -> Decoded V2: Count=${d.outcomeCount}, End=${d.endTime}, Resolved=${d.resolved}`);
        } catch (e) {
            console.log("  -> Failed V2 Decode");
        }

    } catch (e) {
        console.log(`  -> Call failed: ${e.message}`);
    }
}

async function main() {
    for (const [name, addr] of Object.entries(CONTRACTS)) {
        await checkContract(name, addr);
    }
}

main().catch(console.error);
