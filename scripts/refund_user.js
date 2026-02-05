const { ethers } = require("ethers");
require("dotenv").config();

const RPCS = [
    "https://bsc-dataseed.binance.org/",
    "https://bsc-dataseed1.defibit.io/",
    "https://bsc-dataseed1.ninicoin.io/",
    "https://bsc-rpc.publicnode.com"
];

const TARGET_USER = "0x93Edd0429c6Ac4B3644A174Ade5E9d4412E43680";
const USDC_ADDR = "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d"; // BSC USDC
const AMOUNT = "2.0";

const ERC20_ABI = [
    "function transfer(address to, uint256 amount) returns (bool)",
    "function balanceOf(address account) view returns (uint256)",
    "function decimals() view returns (uint8)"
];

async function main() {
    console.log("Initializing refund script...");

    // Find working RPC
    let provider;
    for (const rpc of RPCS) {
        try {
            console.log("Trying RPC:", rpc);
            const tempProvider = new ethers.JsonRpcProvider(rpc);
            await tempProvider.getNetwork();
            provider = tempProvider;
            console.log("Connected to:", rpc);
            break;
        } catch (e) {
            console.log("Failed:", e.message);
        }
    }

    if (!provider) {
        console.error("Could not connect to any RPC.");
        return;
    }

    const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
    console.log("Admin Wallet:", wallet.address);

    const usdc = new ethers.Contract(USDC_ADDR, ERC20_ABI, wallet);

    // Check Admin Balance
    const adminBal = await usdc.balanceOf(wallet.address);
    console.log("Admin USDC Balance:", ethers.formatUnits(adminBal, 18));

    if (adminBal < ethers.parseUnits(AMOUNT, 18)) {
        console.error("Admin has insufficient funds to refund 2 USDC.");
        return;
    }

    console.log(`Refunding ${AMOUNT} USDC to ${TARGET_USER}...`);
    const tx = await usdc.transfer(TARGET_USER, ethers.parseUnits(AMOUNT, 18));
    console.log("Transaction sent:", tx.hash);

    await tx.wait();
    console.log("Refund Confirmed!");
}

main().catch(console.error);
