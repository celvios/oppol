const { ethers } = require("ethers");

const RPC_URL = "https://bsc-dataseed.binance.org/";
const MARKET_ADDRESS = "0xe3Eb84D7e271A5C44B27578547f69C80c497355B";
const BC400_ADDRESS = "0x61Fc93c7C070B32B1b1479B86056d8Ec1D7125BD";

const ABI = [
    "function creationToken() view returns (address)",
    "function minCreationBalance() view returns (uint256)",
    "function publicCreation() view returns (bool)"
];

const ERC20_ABI = [
    "function decimals() view returns (uint8)",
    "function symbol() view returns (string)"
];

const fs = require('fs');

async function main() {
    console.log(`Connecting to ${RPC_URL}...`);
    const provider = new ethers.JsonRpcProvider(RPC_URL);
    const contract = new ethers.Contract(MARKET_ADDRESS, ABI, provider);

    let output = "";
    const log = (msg) => { console.log(msg); output += msg + "\n"; };

    try {
        log(`Reading config from Market: ${MARKET_ADDRESS}`);

        const creationTokenAddr = await contract.creationToken();
        log(`Creation Token Address: ${creationTokenAddr}`);

        const minBalance = await contract.minCreationBalance();
        log(`Min Creation Balance: ${minBalance.toString()}`);

        const isPublic = await contract.publicCreation();
        log(`Public Creation Enabled: ${isPublic}`);

        if (creationTokenAddr.toLowerCase() === BC400_ADDRESS.toLowerCase()) {
            log("✅ Creation Token matches BC400 Address.");
        } else {
            log("❌ Creation Token DOES NOT match BC400 Address!");
            log(`Expected: ${BC400_ADDRESS}`);
        }

        // Check token details if address is valid
        if (creationTokenAddr !== ethers.ZeroAddress) {
            const tokenContract = new ethers.Contract(creationTokenAddr, ERC20_ABI, provider);
            try {
                const decimals = await tokenContract.decimals();
                const symbol = await tokenContract.symbol();
                log(`Creation Token: ${symbol} (${decimals} decimals)`);

                const requiredReadable = ethers.formatUnits(minBalance, decimals);
                log(`Required Balance (Readable): ${requiredReadable}`);
            } catch (e) {
                log(`Could not fetch token details: ${e.message}`);
            }
        }

        fs.writeFileSync('config_output.txt', output);

    } catch (error) {
        console.error("Error fetching config:", error);
        fs.writeFileSync('config_output.txt', `Error: ${error.message}`);
    }
}

main();
