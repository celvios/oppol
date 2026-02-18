const { ethers } = require("ethers");

const RPC_URL = "https://bsc-dataseed.binance.org/";
const USDC_ADDR = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d";
const USDC_ABI = ["function balanceOf(address) view returns (uint256)"];

const OLD_WALLET = "0xbF6Bf031434e1612983c1bC1f92Ed2F904f5aAd9";
const NEW_WALLET_DETECTED = "0x40BbaF7FF828743A69Cc7A7a02e53ce06f86DFE0";
const CUSTODIAL_WALLET = "0xb18C08376D6B2C21122CA7174AFe31358E8131eD";
const ADMIN_WALLET = "0xa4B1B886f955b2342bC9bB4f77B80839357378b7"; // Faucet source

async function check() {
    try {
        const provider = new ethers.JsonRpcProvider(RPC_URL);
        const usdc = new ethers.Contract(USDC_ADDR, USDC_ABI, provider);

        const [balOld, balNew, balCustodial] = await Promise.all([
            usdc.balanceOf(OLD_WALLET),
            usdc.balanceOf(NEW_WALLET_DETECTED),
            usdc.balanceOf(CUSTODIAL_WALLET)
        ]);

        console.log(JSON.stringify({
            old_legacy: ethers.formatUnits(balOld, 18),
            new_detected: ethers.formatUnits(balNew, 18),
            custodial: ethers.formatUnits(balCustodial, 18)
        }, null, 2));
    } catch (e) {
        console.error(e);
    }
}

check();
